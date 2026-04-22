const rawBackendBaseUrl = process.env.REACT_APP_BACKEND_BASE_URL || '';

export function getBackendBaseUrl() {
  return rawBackendBaseUrl.replace(/\/$/, '');
}

export async function sendPredictSnapshots(snapshots) {
  const baseUrl = getBackendBaseUrl();

  if (!baseUrl) {
    throw new Error('REACT_APP_BACKEND_BASE_URL is not set.');
  }

  const response = await fetch(`${baseUrl}/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      snapshots,
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
