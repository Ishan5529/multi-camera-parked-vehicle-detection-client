import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { captureVideoFrame } from '../utils/captureVideoFrame';

const CameraCard = forwardRef(function CameraCard({ camera, onCameraChange, onRemove, availableDevices }, ref) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('Ready to connect');
  const [error, setError] = useState('');

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
        }

        setStatus('Camera live');
      } catch (cameraError) {
        setError(cameraError.message || 'Unable to connect camera');
        setStatus('Camera connection failed');
      }
    }

    connectCamera();

    return () => {
      isMounted = false;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [camera.deviceId]);

  useImperativeHandle(ref, () => ({
    captureSnapshot() {
      return captureVideoFrame(videoRef.current);
    },
  }));

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-slate-950/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Camera {camera.index + 1}</p>
          <h3 className="mt-2 text-xl font-bold text-white">{camera.name}</h3>
          <p className="mt-1 text-sm text-slate-400">{status}</p>
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
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="h-72 w-full object-cover"
          />
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
  );
});

export default CameraCard;
