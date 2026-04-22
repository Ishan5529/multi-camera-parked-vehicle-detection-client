const PARKING_SETUP_STORAGE_KEY = 'parking_setup_cameras_v1';

function normalizeAnnotations(annotations) {
  if (!Array.isArray(annotations)) {
    return [];
  }

  return annotations
    .map((annotation, index) => {
      const x = Number(annotation?.x);
      const y = Number(annotation?.y);
      const width = Number(annotation?.width);
      const height = Number(annotation?.height);

      if (![x, y, width, height].every(Number.isFinite)) {
        return null;
      }

      const clampedX = Math.min(Math.max(x, 0), 1);
      const clampedY = Math.min(Math.max(y, 0), 1);
      const clampedWidth = Math.min(Math.max(width, 0), 1 - clampedX);
      const clampedHeight = Math.min(Math.max(height, 0), 1 - clampedY);

      return {
        id: annotation?.id || `annotation-${Date.now()}-${index}`,
        x: clampedX,
        y: clampedY,
        width: clampedWidth,
        height: clampedHeight,
      };
    })
    .filter(Boolean);
}

function normalizeCamera(camera, index) {
  return {
    id: camera?.id || `camera-${Date.now()}-${index}`,
    index,
    name: camera?.name || `Camera ${index + 1}`,
    deviceId: camera?.deviceId || '',
    annotations: normalizeAnnotations(camera?.annotations),
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
