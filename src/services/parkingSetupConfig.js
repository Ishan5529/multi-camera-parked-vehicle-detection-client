const PARKING_SETUP_STORAGE_KEY = 'parking_setup_cameras_v1';

function normalizeCamera(camera, index) {
  return {
    id: camera?.id || `camera-${Date.now()}-${index}`,
    index,
    name: camera?.name || `Camera ${index + 1}`,
    deviceId: camera?.deviceId || '',
  };
}

export function loadParkingSetupConfig() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(PARKING_SETUP_STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.map((camera, index) => normalizeCamera(camera, index));
  } catch (error) {
    return [];
  }
}

export function saveParkingSetupConfig(cameras) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const sanitizedCameras = Array.isArray(cameras)
    ? cameras.map((camera, index) => normalizeCamera(camera, index))
    : [];

  window.localStorage.setItem(PARKING_SETUP_STORAGE_KEY, JSON.stringify(sanitizedCameras));
}
