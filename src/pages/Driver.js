import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { fetchNearbyParkingLots } from '../api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

const vacantParkingIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const fullParkingIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function RecenterMap({ center }) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
  }, [center, map]);

  return null;
}

function Driver() {
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [hasSearchedLocation, setHasSearchedLocation] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [parkingLots, setParkingLots] = useState([]);
  const [isLoadingParkingLots, setIsLoadingParkingLots] = useState(false);
  const [parkingLotError, setParkingLotError] = useState('');

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.');
      return;
    }

    if (hasSearchedLocation || isSearching) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setUserLocation(location);
        setCurrentLocation(location);
        setLocationError('');
      },
      (error) => {
        setLocationError(`Unable to get your location: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [hasSearchedLocation, isSearching]);

  const mapCenter = useMemo(() => {
    return currentLocation || userLocation || DEFAULT_CENTER;
  }, [currentLocation, userLocation]);

  useEffect(() => {
    const query = searchInput.trim();

    if (!query) {
      setSearchResults([]);
      setIsLoadingSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timerId = setTimeout(async () => {
      setIsLoadingSuggestions(true);

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Location suggestion fetch failed.');
        }

        const results = await response.json();
        setSearchResults(results.slice(0, 5));
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSearchResults([]);
        }
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timerId);
    };
  }, [searchInput]);

  useEffect(() => {
    if (!currentLocation) {
      setParkingLots([]);
      return undefined;
    }

    let isMounted = true;

    const fetchParkingLots = async () => {
      try {
        if (isMounted) {
          setIsLoadingParkingLots(true);
        }

        const lots = await fetchNearbyParkingLots(currentLocation);

        if (isMounted) {
          setParkingLots(lots);
          setParkingLotError('');
        }
      } catch (error) {
        if (isMounted) {
          setParkingLotError(error.message || 'Unable to fetch nearby parking lots.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingParkingLots(false);
        }
      }
    };

    fetchParkingLots();
    const intervalId = window.setInterval(fetchParkingLots, 10000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [currentLocation]);

  const applySelectedLocation = (result) => {
    const nextLocation = {
      lat: Number(result.lat),
      lng: Number(result.lon),
    };

    setSearchInput(result.display_name);
    setHasSearchedLocation(true);
    setCurrentLocation(nextLocation);
    setSearchResults([]);
    setLocationError('');
  };

  const handleSearchLocation = async (event) => {
    event.preventDefault();

    const query = searchInput.trim();
    if (!query) {
      setHasSearchedLocation(false);
      setSearchResults([]);
      if (userLocation) {
        setCurrentLocation(userLocation);
      }
      return;
    }

    if (searchResults.length) {
      applySelectedLocation(searchResults[0]);
      return;
    }

    setIsSearching(true);
    setLocationError('');

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );

      if (!response.ok) {
        throw new Error('Location search failed.');
      }

      const results = await response.json();

      if (!results.length) {
        setLocationError('No matching location found.');
        return;
      }

      const nextLocation = {
        lat: Number(results[0].lat),
        lng: Number(results[0].lon),
      };

      setHasSearchedLocation(true);
      setCurrentLocation(nextLocation);
      setSearchResults(results.slice(0, 5));
    } catch (error) {
      setLocationError(error.message || 'Something went wrong while searching.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex h-screen min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="mx-auto w-full max-w-6xl shrink-0 px-6 pb-4 pt-6">
        <p className="mb-2 inline-flex rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">
          Driver
        </p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Driver map</h1>
            <p className="mt-2 text-sm text-slate-300 sm:text-base">
              Search any place or use your live position as the active current location.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/"
              className="inline-flex w-fit rounded-xl bg-sky-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              Back to home
            </Link>

            <form onSubmit={handleSearchLocation} className="relative flex items-start gap-2">
              <div className="relative w-72">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search location"
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
                />

                {searchInput.trim() ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[1000] overflow-hidden rounded-xl border border-white/15 bg-slate-900/95 shadow-2xl backdrop-blur">
                    {isLoadingSuggestions ? (
                      <p className="px-3 py-2 text-xs text-slate-300">Searching suggestions...</p>
                    ) : searchResults.length ? (
                      searchResults.map((result) => (
                        <button
                          key={`${result.place_id}-${result.lat}-${result.lon}`}
                          type="button"
                          onClick={() => applySelectedLocation(result)}
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
              </div>

              <button
                type="submit"
                disabled={isSearching}
                className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-300 sm:text-sm">
          current_location:{' '}
          {currentLocation
            ? `${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`
            : 'Waiting for location access'}
        </p>
        <p className="mt-1 text-xs text-slate-300 sm:text-sm">
          Nearby lots: {parkingLots.length}
          {isLoadingParkingLots ? ' (refreshing...)' : ''}
        </p>
        {locationError ? <p className="mt-1 text-xs text-rose-300 sm:text-sm">{locationError}</p> : null}
        {parkingLotError ? <p className="mt-1 text-xs text-rose-300 sm:text-sm">{parkingLotError}</p> : null}
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 px-6 pb-6">
        <section className="h-full w-full min-h-[420px] overflow-hidden rounded-2xl border border-white/15">
          <MapContainer
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={14}
            scrollWheelZoom
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <RecenterMap center={mapCenter} />

            {userLocation ? (
              <Marker position={[userLocation.lat, userLocation.lng]}>
                <Popup>Your current location</Popup>
              </Marker>
            ) : null}

            {currentLocation ? (
              <Marker position={[currentLocation.lat, currentLocation.lng]}>
                <Popup>current_location</Popup>
              </Marker>
            ) : null}

            {parkingLots.map((parkingLot) => {
              const hasVacantSlots = parkingLot.vacantSlots > 0;

              return (
                <Marker
                  key={parkingLot.id}
                  position={[parkingLot.lat, parkingLot.lng]}
                  icon={hasVacantSlots ? vacantParkingIcon : fullParkingIcon}
                >
                  <Popup>
                    <div className="min-w-[160px] text-slate-900">
                      <p className="text-sm font-semibold">{parkingLot.name}</p>
                      <p className="text-xs">Vacant slots: {parkingLot.vacantSlots}</p>
                      <p className="text-xs">Coordinates: {parkingLot.lat.toFixed(6)}, {parkingLot.lng.toFixed(6)}</p>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1${
                          currentLocation
                            ? `&origin=${currentLocation.lat},${currentLocation.lng}`
                            : ''
                        }&destination=${parkingLot.lat},${parkingLot.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex rounded-md bg-sky-500 px-2.5 py-1 text-xs font-semibold text-slate-950 transition hover:bg-sky-400"
                      >
                        Navigate on Google Maps
                      </a>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </section>
      </main>
    </div>
  );
}

export default Driver;