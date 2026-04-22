import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CameraCard from '../components/CameraCard';
import { sendPredictSnapshots } from '../api';
import { loadParkingSetupConfig, saveParkingSetupConfig } from '../services/parkingSetupConfig';

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
  const [availableDevices, setAvailableDevices] = useState([]);
  const [message, setMessage] = useState('No camera added yet. Click "Add camera" to start setup.');
  const [error, setError] = useState('');
  const cameraRefs = useRef({});

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

          return {
            cameraId: camera.id,
            cameraName: camera.name,
            image: snapshot,
          };
        })
        .filter(Boolean);

      if (!snapshots.length) {
        setMessage('Waiting for live camera feeds before sending snapshots.');
        return;
      }

      try {
        await sendPredictSnapshots(snapshots);
        setError('');
        setMessage(`Sent ${snapshots.length} camera snapshot${snapshots.length === 1 ? '' : 's'} to the backend.`);
      } catch (sendError) {
        setError(sendError.message || 'Unable to send snapshots to the backend.');
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [cameras]);

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

          <Link
            to="/"
            className="inline-flex w-fit rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Back to home
          </Link>
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
    </div>
  );
}

export default ParkingSetup;