const rawBackendBaseUrl = process.env.REACT_APP_BACKEND_BASE_URL || '';

export function getBackendBaseUrl() {
  return rawBackendBaseUrl.replace(/\/$/, '');
}

export async function updateParkingConfiguration(config) {
  const baseUrl = getBackendBaseUrl();

  if (!baseUrl) {
    throw new Error('REACT_APP_BACKEND_BASE_URL is not set.');
  }

  const parkingLotName = String(config?.parkingLotName || '').trim();
  const parkingLotAddress = String(config?.parkingLotAddress || '').trim();
  const uuid = String(config?.configUuid || config?.uuid || '').trim();

  const response = await fetch(`${baseUrl}/update_config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uuid,
      configUuid: uuid,
      config_uuid: uuid,
      parkingLotName,
      parkingLotAddress,
      parking_lot_name: parkingLotName,
      parking_lot_address: parkingLotAddress,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to update parking configuration.');
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const responseUuid = (await response.text()).trim();
  return { uuid: responseUuid };
}

function normalizeCoordinates(annotations) {
  if (!Array.isArray(annotations)) {
    return [];
  }

  return annotations
    .map((annotation) => ({
      id: annotation?.id,
      label: annotation?.label,
      x: Number(annotation?.x),
      y: Number(annotation?.y),
      width: Number(annotation?.width),
      height: Number(annotation?.height),
      rotation: Number(annotation?.rotation) || 0,
    }))
    .filter((annotation) => [annotation.x, annotation.y, annotation.width, annotation.height].every(Number.isFinite));
}

function normalizeSnapshotsForPredict(snapshots) {
  if (!Array.isArray(snapshots)) {
    return [];
  }

  return snapshots
    .map((snapshot) => {
      if (!snapshot?.image) {
        return null;
      }

      const normalizedCoordinates = normalizeCoordinates(snapshot.annotations);

      return {
        cameraId: snapshot.cameraId,
        cameraName: snapshot.cameraName,
        image: snapshot.image,
        frame: snapshot.frame || null,
        annotations: normalizedCoordinates,
        coordinates: normalizedCoordinates,
      };
    })
    .filter(Boolean);
}

export async function sendPredictSnapshots(snapshots, configUuid) {
  const baseUrl = getBackendBaseUrl();

  if (!baseUrl) {
    throw new Error('REACT_APP_BACKEND_BASE_URL is not set.');
  }

  const normalizedSnapshots = normalizeSnapshotsForPredict(snapshots);

  const response = await fetch(`${baseUrl}/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uuid: configUuid,
      snapshots: normalizedSnapshots,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to send prediction snapshots.');
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return null;
}

function normalizeParkingLot(rawLot, index) {
  if (!rawLot || typeof rawLot !== 'object') {
    return null;
  }

  const lat = Number(rawLot.lat ?? rawLot.latitude ?? rawLot.parking_lat ?? rawLot.parkingLotLat);
  const lng = Number(rawLot.lng ?? rawLot.lon ?? rawLot.longitude ?? rawLot.parking_lng ?? rawLot.parkingLotLng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const name = String(rawLot.name ?? rawLot.parkingLotName ?? rawLot.parking_lot_name ?? `Parking lot ${index + 1}`);
  const vacantSlots = Number(rawLot.vacantSlots ?? rawLot.vacant_slots ?? rawLot.availableSlots ?? rawLot.available_slots ?? 0);

  return {
    id: String(rawLot.id ?? rawLot.uuid ?? rawLot.configUuid ?? `${name}-${index}`),
    name,
    lat,
    lng,
    vacantSlots: Number.isFinite(vacantSlots) ? vacantSlots : 0,
  };
}

export async function fetchNearbyParkingLots(currentLocation) {
  const baseUrl = getBackendBaseUrl();

  if (!baseUrl) {
    throw new Error('REACT_APP_BACKEND_BASE_URL is not set.');
  }

  const latitude = Number(currentLocation?.lat);
  const longitude = Number(currentLocation?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Current location coordinates are invalid.');
  }

  const response = await fetch(`${baseUrl}/fetch_parking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      lat: latitude,
      lng: longitude,
      latitude,
      longitude,
      current_location: {
        lat: latitude,
        lng: longitude,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to fetch nearby parking lots.');
  }

  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    return [];
  }

  const payload = await response.json();
  const lots = payload?.parkingLots || payload?.parking_lots || payload?.lots || payload?.data || [];

  if (!Array.isArray(lots)) {
    return [];
  }

  return lots.map(normalizeParkingLot).filter(Boolean);
}
