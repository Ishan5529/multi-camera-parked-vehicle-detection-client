import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import CameraCard from '../components/CameraCard';
import { sendPredictSnapshots, updateParkingConfiguration } from '../api';
import {
  loadParkingLotConfig,
  loadParkingSetupConfig,
  saveParkingLotConfig,
  saveParkingSetupConfig,
} from '../services/parkingSetupConfig';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

function parseCoordinateAddress(value) {
  const match = String(value || '')
    .trim()
    .match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);

  if (!match) {
    return null;
  }

  const lat = Number(match[1]);
  const lng = Number(match[2]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function formatCoordinates(coordinates) {
  return `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`;
}

function RecenterMap({ center }) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
  }, [center, map]);

  return null;
}

function MapClickHandler({ onSelectPoint }) {
  useMapEvents({
    click(event) {
      onSelectPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  return null;
}

function createCamera(id, index) {
  return {
    id,
    index,
    name: `Camera ${index + 1}`,
    deviceId: '',
    annotations: [],
  };
}

function createCameraId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function ParkingSetup() {
  const [cameras, setCameras] = useState(() => loadParkingSetupConfig());
  const [parkingLotConfig, setParkingLotConfig] = useState(() => loadParkingLotConfig());
  const [selectedPoint, setSelectedPoint] = useState(() => parseCoordinateAddress(loadParkingLotConfig().parkingLotAddress));
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [pickerUserLocation, setPickerUserLocation] = useState(null);
  const [pickerSearchInput, setPickerSearchInput] = useState('');
  const [pickerSearchResults, setPickerSearchResults] = useState([]);
  const [pickerSearchError, setPickerSearchError] = useState('');
  const [isLoadingPickerResults, setIsLoadingPickerResults] = useState(false);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [message, setMessage] = useState('No camera added yet. Click "Add camera" to start setup.');
  const [error, setError] = useState('');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configFormError, setConfigFormError] = useState('');
  const [configFormMessage, setConfigFormMessage] = useState('');
  const cameraRefs = useRef({});

  const pickerMapCenter = useMemo(() => {
    return selectedPoint || pickerUserLocation || DEFAULT_CENTER;
  }, [selectedPoint, pickerUserLocation]);

  useEffect(() => {
    saveParkingSetupConfig(cameras);

    if (!cameras.length) {
      setError('');
      setMessage('No camera added yet. Click "Add camera" to start setup.');
    }
  }, [cameras]);

  useEffect(() => {
    let isMounted = true;

    async function loadVideoDevices() {
      if (!navigator.mediaDevices?.enumerateDevices) {
        return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === 'videoinput');

      if (isMounted) {
        setAvailableDevices(videoDevices);
      }
    }

    loadVideoDevices();

    navigator.mediaDevices?.addEventListener?.('devicechange', loadVideoDevices);

    return () => {
      isMounted = false;
      navigator.mediaDevices?.removeEventListener?.('devicechange', loadVideoDevices);
    };
  }, []);

  useEffect(() => {
    if (!parkingLotConfig.configUuid) {
      setError('');
      setMessage('Save parking lot configurations first to start camera polling.');
      return undefined;
    }

    if (!cameras.length) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      const snapshots = cameras
        .map((camera) => {
          const cameraRef = cameraRefs.current[camera.id];

          if (!cameraRef?.captureSnapshot) {
            return null;
          }

          const snapshot = cameraRef.captureSnapshot();

          if (!snapshot) {
            return null;
          }

          if (typeof snapshot === 'string') {
            return {
              cameraId: camera.id,
              cameraName: camera.name,
              image: snapshot,
              frame: null,
              annotations: [],
            };
          }

          return {
            cameraId: camera.id,
            cameraName: camera.name,
            image: snapshot.image,
            frame: snapshot.frame,
            annotations: snapshot.annotations,
          };
        })
        .filter(Boolean);

      if (!snapshots.length) {
        setMessage('Waiting for live camera feeds before sending snapshots.');
        return;
      }

      try {
        await sendPredictSnapshots(snapshots, parkingLotConfig.configUuid);
        setError('');
        setMessage(`Sent ${snapshots.length} camera snapshot${snapshots.length === 1 ? '' : 's'} to the backend.`);
      } catch (sendError) {
        setError(sendError.message || 'Unable to send snapshots to the backend.');
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [cameras, parkingLotConfig.configUuid]);

  useEffect(() => {
    if (!isMapPickerOpen || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setPickerUserLocation(location);
        setSelectedPoint((currentPoint) => {
          if (currentPoint || String(parkingLotConfig.parkingLotAddress || '').trim()) {
            return currentPoint;
          }

          handleConfigFieldChange('parkingLotAddress', formatCoordinates(location));
          return location;
        });
      },
      () => {
        setPickerUserLocation(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  }, [isMapPickerOpen, parkingLotConfig.parkingLotAddress]);

  useEffect(() => {
    const query = pickerSearchInput.trim();

    if (!isMapPickerOpen || !query) {
      setPickerSearchResults([]);
      setIsLoadingPickerResults(false);
      return;
    }

    const controller = new AbortController();
    const timerId = setTimeout(async () => {
      setIsLoadingPickerResults(true);
      setPickerSearchError('');

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Unable to search locations on map.');
        }

        const results = await response.json();
        setPickerSearchResults(results.slice(0, 5));
      } catch (searchError) {
        if (searchError.name !== 'AbortError') {
          setPickerSearchResults([]);
          setPickerSearchError(searchError.message || 'Unable to search locations on map.');
        }
      } finally {
        setIsLoadingPickerResults(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timerId);
    };
  }, [isMapPickerOpen, pickerSearchInput]);

  function handleConfigFieldChange(field, value) {
    setParkingLotConfig((currentConfig) => ({
      ...currentConfig,
      [field]: value,
    }));

    if (configFormError) {
      setConfigFormError('');
    }
  }

  function updateSelectedPoint(nextPoint) {
    setSelectedPoint(nextPoint);
    handleConfigFieldChange('parkingLotAddress', formatCoordinates(nextPoint));
  }

  function handlePickerSearchSelection(result) {
    const nextPoint = {
      lat: Number(result.lat),
      lng: Number(result.lon),
    };

    updateSelectedPoint(nextPoint);
    setPickerSearchInput(result.display_name);
    setPickerSearchResults([]);
    setPickerSearchError('');
  }

  async function saveConfigurations(event) {
    event.preventDefault();

    const parkingLotName = parkingLotConfig.parkingLotName.trim();
    const parkingLotAddress = parkingLotConfig.parkingLotAddress.trim();

    if (!parkingLotName || !parkingLotAddress) {
      setConfigFormError('Parking lot name and address are required.');
      return;
    }

    setIsSavingConfig(true);
    setConfigFormError('');
    setConfigFormMessage('');

    try {
      const response = await updateParkingConfiguration({
        parkingLotName,
        parkingLotAddress,
        configUuid: parkingLotConfig.configUuid || '',
      });

      const receivedUuid = String(response?.uuid || response?.configUuid || '').trim();

      if (!receivedUuid) {
        throw new Error('Backend did not return a uuid.');
      }

      const nextConfig = {
        parkingLotName,
        parkingLotAddress,
        configUuid: receivedUuid,
      };

      setParkingLotConfig(nextConfig);
      saveParkingLotConfig(nextConfig);
      setConfigFormMessage('Configurations saved successfully.');
      setIsConfigModalOpen(false);
      setMessage('Configuration saved. Polling will begin once live camera feeds are available.');
      setError('');
    } catch (saveError) {
      setConfigFormError(saveError.message || 'Unable to save parking lot configurations.');
    } finally {
      setIsSavingConfig(false);
    }
  }

  function addCamera() {
    setCameras((currentCameras) => {
      const nextIndex = currentCameras.length;
      const newCamera = createCamera(createCameraId(), nextIndex);

      return [...currentCameras, newCamera];
    });
  }

  function updateCamera(cameraId, updates) {
    setCameras((currentCameras) =>
      currentCameras.map((camera) =>
        camera.id === cameraId ? { ...camera, ...updates } : camera,
      ),
    );
  }

  function removeCamera(cameraId) {
    setCameras((currentCameras) => {
      const nextCameras = currentCameras.filter((camera) => camera.id !== cameraId);

      if (cameraRefs.current[cameraId]) {
        delete cameraRefs.current[cameraId];
      }

      return nextCameras.map((camera, index) => ({
        ...camera,
        index,
        name: camera.name || `Camera ${index + 1}`,
      }));
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Parking Setup
            </p>
            <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Camera setup and prediction monitoring</h1>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              Add one or more camera feeds, select the source for each feed, and the page will send snapshots to the backend every 5 seconds.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setConfigFormError('');
                setConfigFormMessage('');
                setIsConfigModalOpen(true);
              }}
              className="inline-flex w-fit rounded-xl border border-sky-400/50 bg-sky-500/10 px-5 py-3 font-semibold text-sky-200 transition hover:bg-sky-500/20"
            >
              Configurations
            </button>

            <Link
              to="/"
              className="inline-flex w-fit rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Back to home
            </Link>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Connected cameras</h2>
              <p className="mt-1 text-sm text-slate-400">{message}</p>
              {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
            </div>

            <button
              type="button"
              onClick={addCamera}
              className="rounded-xl bg-sky-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              Add camera
            </button>
          </div>

          <div className="mt-6 space-y-5">
            {cameras.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/20 bg-slate-900/40 p-8 text-center">
                <p className="text-lg font-semibold text-slate-200">No camera view is configured yet.</p>
                <p className="mt-2 text-sm text-slate-400">
                  Use the <span className="font-semibold text-sky-300">Add camera</span> button to create the first camera configuration.
                </p>
              </div>
            ) : null}

            {cameras.map((camera) => (
              <CameraCard
                key={camera.id}
                ref={(node) => {
                  if (node) {
                    cameraRefs.current[camera.id] = node;
                  } else {
                    delete cameraRefs.current[camera.id];
                  }
                }}
                camera={camera}
                availableDevices={availableDevices}
                onCameraChange={updateCamera}
                onRemove={removeCamera}
              />
            ))}
          </div>
        </section>
      </main>

      {isConfigModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-8">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-white">Parking lot configurations</h3>
                <p className="mt-1 text-sm text-slate-300">
                  Save this once to receive and store the backend uuid required for polling.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="rounded-lg border border-white/15 px-3 py-1 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={saveConfigurations}>
              <div>
                <label htmlFor="parking-lot-name" className="mb-2 block text-sm font-semibold text-slate-200">
                  Parking lot name
                </label>
                <input
                  id="parking-lot-name"
                  type="text"
                  value={parkingLotConfig.parkingLotName}
                  onChange={(event) => handleConfigFieldChange('parkingLotName', event.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-2.5 text-slate-100 outline-none transition focus:border-sky-400"
                  placeholder="e.g. Downtown Lot A"
                  required
                />
              </div>

              <div>
                <label htmlFor="parking-lot-address" className="mb-2 block text-sm font-semibold text-slate-200">
                  Parking lot address
                </label>
                <button
                  id="parking-lot-address"
                  type="button"
                  onClick={() => {
                    setPickerSearchError('');
                    setPickerSearchInput('');
                    setPickerSearchResults([]);
                    setIsMapPickerOpen(true);
                  }}
                  className="flex min-h-20 w-full items-center justify-between rounded-xl border border-white/15 bg-slate-950 px-4 py-2.5 text-left text-slate-100 outline-none transition hover:border-sky-400"
                >
                  <span className="text-sm text-slate-100">
                    {parkingLotConfig.parkingLotAddress || 'Click to select coordinates from map'}
                  </span>
                  <span className="ml-4 rounded-lg bg-sky-500 px-3 py-1 text-xs font-semibold text-slate-950">Open map</span>
                </button>
                <p className="mt-2 text-xs text-slate-400">
                  Click to open the map, search a location, then click on the map to pick parking lot coordinates.
                </p>
              </div>

              {parkingLotConfig.configUuid ? (
                <p className="text-xs text-emerald-300">Saved uuid: {parkingLotConfig.configUuid}</p>
              ) : null}

              {configFormError ? <p className="text-sm text-rose-300">{configFormError}</p> : null}
              {configFormMessage ? <p className="text-sm text-emerald-300">{configFormMessage}</p> : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="rounded-xl border border-white/15 px-4 py-2 font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="rounded-xl bg-sky-500 px-5 py-2 font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSavingConfig ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isMapPickerOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 px-4 py-8">
          <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-white">Pick parking lot location</h3>
                <p className="mt-1 text-sm text-slate-300">Search and click on the map to set coordinate address.</p>
              </div>

              <button
                type="button"
                onClick={() => setIsMapPickerOpen(false)}
                className="rounded-lg border border-white/15 px-3 py-1 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mb-3 flex flex-col gap-2">
              <input
                type="text"
                value={pickerSearchInput}
                onChange={(event) => setPickerSearchInput(event.target.value)}
                placeholder="Search location on map"
                className="w-full rounded-xl border border-white/20 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
              />

              {pickerSearchInput.trim() ? (
                <div className="max-h-44 overflow-y-auto rounded-xl border border-white/15 bg-slate-950/95">
                  {isLoadingPickerResults ? (
                    <p className="px-3 py-2 text-xs text-slate-300">Searching suggestions...</p>
                  ) : pickerSearchResults.length ? (
                    pickerSearchResults.map((result) => (
                      <button
                        key={`${result.place_id}-${result.lat}-${result.lon}`}
                        type="button"
                        onClick={() => handlePickerSearchSelection(result)}
                        className="block w-full border-b border-white/10 px-3 py-2 text-left text-xs text-slate-100 transition hover:bg-slate-800/90 last:border-b-0"
                      >
                        {result.display_name}
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-xs text-slate-300">No matches</p>
                  )}
                </div>
              ) : null}
              {pickerSearchError ? <p className="text-xs text-rose-300">{pickerSearchError}</p> : null}
            </div>

            <div className="h-[420px] overflow-hidden rounded-xl border border-white/15">
              <MapContainer center={[pickerMapCenter.lat, pickerMapCenter.lng]} zoom={15} scrollWheelZoom className="h-full w-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
                <RecenterMap center={pickerMapCenter} />
                <MapClickHandler onSelectPoint={updateSelectedPoint} />

                {selectedPoint ? <Marker position={[selectedPoint.lat, selectedPoint.lng]} /> : null}
              </MapContainer>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-300">
                Selected coordinates:{' '}
                {selectedPoint ? formatCoordinates(selectedPoint) : 'No point selected yet'}
              </p>
              <button
                type="button"
                onClick={() => setIsMapPickerOpen(false)}
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                Use selected coordinates
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ParkingSetup;