const PARKING_SETUP_STORAGE_KEY = 'parking_setup_cameras_v1';
const PARKING_LOT_CONFIG_STORAGE_KEY = 'parking_lot_config_v1';

function normalizeRotation(value) {
  const rotation = Number(value);

  if (!Number.isFinite(rotation)) {
    return 0;
  }

  return ((rotation % 360) + 360) % 360;
}

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
        rotation: normalizeRotation(annotation?.rotation),
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

function sanitizeParkingLotConfig(config) {
  return {
    parkingLotName: String(config?.parkingLotName || '').trim(),
    parkingLotAddress: String(config?.parkingLotAddress || '').trim(),
    configUuid: String(config?.configUuid || '').trim(),
  };
}

export function loadParkingLotConfig() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return sanitizeParkingLotConfig();
  }

  try {
    const rawValue = window.localStorage.getItem(PARKING_LOT_CONFIG_STORAGE_KEY);

    if (!rawValue) {
      return sanitizeParkingLotConfig();
    }

    const parsedValue = JSON.parse(rawValue);
    return sanitizeParkingLotConfig(parsedValue);
  } catch (error) {
    return sanitizeParkingLotConfig();
  }
}

export function saveParkingLotConfig(config) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const sanitizedConfig = sanitizeParkingLotConfig(config);
  window.localStorage.setItem(PARKING_LOT_CONFIG_STORAGE_KEY, JSON.stringify(sanitizedConfig));
}
