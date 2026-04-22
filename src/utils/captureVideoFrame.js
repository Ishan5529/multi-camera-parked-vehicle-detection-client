function normalizeRotation(value) {
  const rotation = Number(value);

  if (!Number.isFinite(rotation)) {
    return 0;
  }

  return ((rotation % 360) + 360) % 360;
}

function drawAnnotations(context, canvasWidth, canvasHeight, annotations) {
  if (!Array.isArray(annotations) || annotations.length === 0) {
    return;
  }

  annotations.forEach((annotation, index) => {
    const x = Number(annotation?.x) * canvasWidth;
    const y = Number(annotation?.y) * canvasHeight;
    const width = Number(annotation?.width) * canvasWidth;
    const height = Number(annotation?.height) * canvasHeight;

    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      return;
    }

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const rotationRadians = (normalizeRotation(annotation?.rotation) * Math.PI) / 180;

    context.save();
    context.translate(centerX, centerY);
    context.rotate(rotationRadians);

    context.strokeStyle = '#ef4444';
    context.lineWidth = Math.max(2, canvasWidth * 0.0035);
    context.strokeRect(-width / 2, -height / 2, width, height);

    context.fillStyle = 'rgba(2, 6, 23, 0.85)';
    context.fillRect(-width / 2 + 4, -height / 2 + 4, 50, 18);
    context.fillStyle = '#fecaca';
    context.font = 'bold 12px sans-serif';
    context.fillText(`Box ${index + 1}`, -width / 2 + 8, -height / 2 + 17);

    context.restore();
  });
}

export function captureVideoFrame(videoElement, options = {}) {
  const { annotations = [] } = options;

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
  drawAnnotations(context, canvas.width, canvas.height, annotations);
  return canvas.toDataURL('image/jpeg', 0.85);
}
