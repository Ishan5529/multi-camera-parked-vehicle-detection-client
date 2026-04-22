export function captureVideoFrame(videoElement) {
  if (!videoElement || videoElement.readyState < 2) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;

  if (!canvas.width || !canvas.height) {
    return null;
  }

  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}
