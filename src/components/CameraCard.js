import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { captureVideoFrame } from '../utils/captureVideoFrame';

function getPreviewDimensions(width, height) {
  const fallbackDimensions = { width: 240, height: 135 };

  if (!width || !height) {
    return fallbackDimensions;
  }

  const maxWidth = 600;
  const maxHeight = 600;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);

  return {
    width: Math.max(120, Math.round(width * scale)),
    height: Math.max(90, Math.round(height * scale)),
  };
}

function clampToUnit(value) {
  return Math.min(Math.max(value, 0), 1);
}

function getContainedVideoRect(containerWidth, containerHeight, videoWidth, videoHeight) {
  if (!containerWidth || !containerHeight || !videoWidth || !videoHeight) {
    return {
      left: 0,
      top: 0,
      width: containerWidth || 0,
      height: containerHeight || 0,
    };
  }

  const scale = Math.min(containerWidth / videoWidth, containerHeight / videoHeight);
  const width = videoWidth * scale;
  const height = videoHeight * scale;

  return {
    left: (containerWidth - width) / 2,
    top: (containerHeight - height) / 2,
    width,
    height,
  };
}

function getBoxFromPoints(startPoint, endPoint) {
  const x = Math.min(startPoint.x, endPoint.x);
  const y = Math.min(startPoint.y, endPoint.y);
  const width = Math.abs(endPoint.x - startPoint.x);
  const height = Math.abs(endPoint.y - startPoint.y);

  return {
    x: clampToUnit(x),
    y: clampToUnit(y),
    width: clampToUnit(width),
    height: clampToUnit(height),
  };
}

function getRelativePoint(event, containerElement, videoResolution) {
  if (!containerElement) {
    return null;
  }

  const rect = containerElement.getBoundingClientRect();

  if (!rect.width || !rect.height) {
    return null;
  }

  const containedRect = getContainedVideoRect(
    rect.width,
    rect.height,
    videoResolution.width,
    videoResolution.height,
  );

  if (!containedRect.width || !containedRect.height) {
    return null;
  }

  const localX = event.clientX - rect.left - containedRect.left;
  const localY = event.clientY - rect.top - containedRect.top;

  if (localX < 0 || localY < 0 || localX > containedRect.width || localY > containedRect.height) {
    return null;
  }

  return {
    x: clampToUnit(localX / containedRect.width),
    y: clampToUnit(localY / containedRect.height),
  };
}

function renderAnnotationBoxes(annotations, draftAnnotation) {
  return (
    <>
      {annotations.map((annotation) => (
        <div
          key={annotation.id}
          className="pointer-events-none absolute border-2 border-red-500 bg-transparent"
          style={{
            left: `${annotation.x * 100}%`,
            top: `${annotation.y * 100}%`,
            width: `${annotation.width * 100}%`,
            height: `${annotation.height * 100}%`,
          }}
        />
      ))}

      {draftAnnotation ? (
        <div
          className="pointer-events-none absolute border-2 border-red-500 bg-transparent"
          style={{
            left: `${draftAnnotation.x * 100}%`,
            top: `${draftAnnotation.y * 100}%`,
            width: `${draftAnnotation.width * 100}%`,
            height: `${draftAnnotation.height * 100}%`,
          }}
        />
      ) : null}
    </>
  );
}

const CameraCard = forwardRef(function CameraCard({ camera, onCameraChange, onRemove, availableDevices }, ref) {
  const videoRef = useRef(null);
  const modalVideoRef = useRef(null);
  const modalViewportRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('Ready to connect');
  const [error, setError] = useState('');
  const [videoResolution, setVideoResolution] = useState({ width: 0, height: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStartPoint, setDrawStartPoint] = useState(null);
  const [draftAnnotation, setDraftAnnotation] = useState(null);
  const [modalViewportSize, setModalViewportSize] = useState({ width: 0, height: 0 });
  const annotations = Array.isArray(camera.annotations) ? camera.annotations : [];
  const previewDimensions = getPreviewDimensions(videoResolution.width, videoResolution.height);
  const modalDimensions = getPreviewDimensions(videoResolution.width, videoResolution.height);
  const modalWidth = Math.min(modalDimensions.width * 2.2, 1100);
  const modalHeight = Math.min(modalDimensions.height * 2.2, 760);

  const previewContainedRect = getContainedVideoRect(
    previewDimensions.width,
    previewDimensions.height,
    videoResolution.width,
    videoResolution.height,
  );

  const modalContainedRect = getContainedVideoRect(
    modalViewportSize.width,
    modalViewportSize.height,
    videoResolution.width,
    videoResolution.height,
  );

  useEffect(() => {
    let isMounted = true;

    async function connectCamera() {
      setError('');

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('Camera access is not supported in this browser');
        return;
      }

      try {
        setStatus('Connecting camera...');

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        const constraints = camera.deviceId
          ? { video: { deviceId: { exact: camera.deviceId } }, audio: false }
          : { video: true, audio: false };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          if (videoRef.current.videoWidth && videoRef.current.videoHeight) {
            setVideoResolution({
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight,
            });
          }
        }

        if (modalVideoRef.current) {
          modalVideoRef.current.srcObject = stream;
          await modalVideoRef.current.play();
        }

        setStatus('Camera live');
      } catch (cameraError) {
        setError(cameraError.message || 'Unable to connect camera');
        setStatus('Camera connection failed');
      }
    }

    connectCamera();

    function handleLoadedMetadata() {
      if (!videoRef.current) {
        return;
      }

      setVideoResolution({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
      });
    }

    const activeVideoElement = videoRef.current;
    activeVideoElement?.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      isMounted = false;
      activeVideoElement?.removeEventListener('loadedmetadata', handleLoadedMetadata);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [camera.deviceId]);

  useEffect(() => {
    if (!isModalOpen || !modalVideoRef.current || !streamRef.current) {
      return;
    }

    modalVideoRef.current.srcObject = streamRef.current;
    modalVideoRef.current.play().catch(() => {
      // Ignore autoplay errors because the stream is already active in the inline preview.
    });
  }, [isModalOpen]);

  useEffect(() => {
    if (!isModalOpen || !modalViewportRef.current || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;
      setModalViewportSize({ width, height });
    });

    observer.observe(modalViewportRef.current);

    return () => observer.disconnect();
  }, [isModalOpen]);

  useImperativeHandle(ref, () => ({
    captureSnapshot() {
      return captureVideoFrame(videoRef.current);
    },
  }));

  function createAnnotationId() {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `annotation-${Date.now()}-${Math.random()}`;
  }

  function startDrawing(event) {
    if (event.button !== 0) {
      return;
    }

    const point = getRelativePoint(event, modalViewportRef.current, videoResolution);

    if (!point) {
      return;
    }

    setIsDrawing(true);
    setDrawStartPoint(point);
    setDraftAnnotation({ x: point.x, y: point.y, width: 0, height: 0 });
  }

  function moveDrawing(event) {
    if (!isDrawing || !drawStartPoint) {
      return;
    }

    const point = getRelativePoint(event, modalViewportRef.current, videoResolution);

    if (!point) {
      return;
    }

    setDraftAnnotation(getBoxFromPoints(drawStartPoint, point));
  }

  function finishDrawing(event) {
    if (!isDrawing || !drawStartPoint) {
      return;
    }

    const point = getRelativePoint(event, modalViewportRef.current, videoResolution);
    const nextBox = point ? getBoxFromPoints(drawStartPoint, point) : null;

    if (nextBox && nextBox.width > 0.01 && nextBox.height > 0.01) {
      onCameraChange(camera.id, {
        annotations: [...annotations, { ...nextBox, id: createAnnotationId() }],
      });
    }

    setIsDrawing(false);
    setDrawStartPoint(null);
    setDraftAnnotation(null);
  }

  function clearAnnotations() {
    onCameraChange(camera.id, { annotations: [] });
  }

  function closeModal() {
    setIsDrawing(false);
    setDrawStartPoint(null);
    setDraftAnnotation(null);
    setIsModalOpen(false);
  }

  return (
    <>
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Camera {camera.index + 1}</p>
          <h3 className="mt-2 text-xl font-bold text-white">{camera.name}</h3>
          <p className="mt-1 text-sm text-slate-400">{status}</p>
          {videoResolution.width > 0 && videoResolution.height > 0 ? (
            <p className="mt-1 text-xs text-slate-500">{videoResolution.width} x {videoResolution.height}</p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">{annotations.length} annotation{annotations.length === 1 ? '' : 's'}</p>
          {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
        </div>

        <button
          type="button"
          onClick={() => onRemove(camera.id)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-200"
        >
          Remove
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div
          className="relative cursor-zoom-in overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80"
          style={{ width: `${previewDimensions.width}px`, height: `${previewDimensions.height}px` }}
          onClick={() => setIsModalOpen(true)}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-contain"
          />
          <div
            className="pointer-events-none absolute"
            style={{
              left: `${previewContainedRect.left}px`,
              top: `${previewContainedRect.top}px`,
              width: `${previewContainedRect.width}px`,
              height: `${previewContainedRect.height}px`,
            }}
          >
            {renderAnnotationBoxes(annotations, null)}
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-300">
            Camera name
            <input
              type="text"
              value={camera.name}
              onChange={(event) => onCameraChange(camera.id, { name: event.target.value })}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-sky-400"
              placeholder="Front gate camera"
            />
          </label>

          <label className="block text-sm font-medium text-slate-300">
            Video device
            <select
              value={camera.deviceId}
              onChange={(event) => onCameraChange(camera.id, { deviceId: event.target.value })}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none ring-0 focus:border-sky-400"
            >
              <option value="">Default camera</option>
              {availableDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || device.deviceId}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4">
          <div className="w-full max-w-[1280px] rounded-3xl border border-white/10 bg-slate-900/90 p-5 shadow-2xl shadow-black/60">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Annotation mode</p>
                <h4 className="mt-1 text-lg font-bold text-white">{camera.name}</h4>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={clearAnnotations}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-amber-400/50 hover:bg-amber-500/10 hover:text-amber-200"
                >
                  Clear boxes
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-sm text-slate-300">
                Draw tool: click and drag on the video to add a box. Added boxes stay visible in preview and are saved in configuration.
              </p>

              <div
                ref={modalViewportRef}
                className="relative mx-auto overflow-hidden rounded-2xl border border-white/10 bg-black"
                style={{ width: `${modalWidth}px`, height: `${modalHeight}px`, maxWidth: '92vw', maxHeight: '78vh' }}
                onMouseDown={startDrawing}
                onMouseMove={moveDrawing}
                onMouseUp={finishDrawing}
                onMouseLeave={finishDrawing}
              >
                <video
                  ref={modalVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-contain"
                />
                <div
                  className="absolute cursor-crosshair"
                  style={{
                    left: `${modalContainedRect.left}px`,
                    top: `${modalContainedRect.top}px`,
                    width: `${modalContainedRect.width}px`,
                    height: `${modalContainedRect.height}px`,
                  }}
                >
                  {renderAnnotationBoxes(annotations, draftAnnotation)}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
});

export default CameraCard;
