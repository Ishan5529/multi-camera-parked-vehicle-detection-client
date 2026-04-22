const rawBackendBaseUrl = process.env.REACT_APP_BACKEND_BASE_URL || '';

export function getBackendBaseUrl() {
  return rawBackendBaseUrl.replace(/\/$/, '');
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

export async function sendPredictSnapshots(snapshots) {
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
