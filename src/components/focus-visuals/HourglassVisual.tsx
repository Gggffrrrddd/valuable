import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import type { FocusVisualProps } from './types';

interface HourglassProps extends FocusVisualProps {
  duration: number;
  running: boolean;
}

const VIDEO_DURATION = 1799.9;
const TARGET_FRAME_MS = 1000 / 18;
const WORKING_WIDTH = 520;
const BOUNDARY_STORAGE_KEY = 'valuable-hourglass-boundary-v1';

type BoundaryPoint = [number, number];

const DEFAULT_BOUNDARY: BoundaryPoint[] = [
  [0.274, 0.057], [0.5, 0.057], [0.736, 0.057], [0.756, 0.095],
  [0.703, 0.245], [0.636, 0.382], [0.555, 0.473], [0.505, 0.51],
  [0.555, 0.565], [0.636, 0.664], [0.703, 0.805], [0.756, 0.943],
  [0.736, 0.945], [0.5, 0.945], [0.274, 0.945], [0.244, 0.943],
  [0.297, 0.805], [0.364, 0.664], [0.445, 0.565], [0.495, 0.51],
  [0.445, 0.473], [0.364, 0.382], [0.297, 0.245], [0.244, 0.095],
];

function readBoundary(): BoundaryPoint[] {
  if (typeof window === 'undefined') return DEFAULT_BOUNDARY;
  try {
    const saved = JSON.parse(window.localStorage.getItem(BOUNDARY_STORAGE_KEY) ?? '');
    if (!Array.isArray(saved) || saved.length < 3) return DEFAULT_BOUNDARY;
    return saved.map(([x, y]) => [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))]);
  } catch {
    return DEFAULT_BOUNDARY;
  }
}

function clipToHourglass(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, height: number, boundary: BoundaryPoint[]) {
  const first = boundary[0];
  context.beginPath();
  context.moveTo(first[0] * width, first[1] * height);
  boundary.slice(1).forEach(([x, y]) => context.lineTo(x * width, y * height));
  context.closePath();
  context.clip();
}

export default function HourglassVisual({ progress, duration, running }: HourglassProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoEndedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [boundary, setBoundary] = useState<BoundaryPoint[]>(readBoundary);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const complete = progress >= 1;
  const playbackRate = VIDEO_DURATION / duration;

  const handleEnded = () => {
    videoEndedRef.current = true;
    setVideoEnded(true);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !loaded) return;

    if (running && !videoEndedRef.current && !complete) {
      if (progress === 0) video.currentTime = 0;
      video.playbackRate = playbackRate;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [running, loaded, playbackRate, progress, complete, videoEnded]);

  useEffect(() => {
    if (progress === 0) {
      videoEndedRef.current = false;
      setVideoEnded(false);
    }
  }, [progress]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !loaded || !complete) return;
    video.pause();
  }, [complete, loaded]);

  useEffect(() => {
    const video = videoRef.current;
    const displayCanvas = canvasRef.current;
    if (!video || !displayCanvas || !loaded) return;

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) return;

    const workWidth = Math.min(WORKING_WIDTH, sourceWidth);
    const workHeight = Math.max(1, Math.round(workWidth * sourceHeight / sourceWidth));
    const workCanvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(workWidth, workHeight)
      : document.createElement('canvas');
    workCanvas.width = workWidth;
    workCanvas.height = workHeight;

    const workContext = workCanvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    const displayContext = displayCanvas.getContext('2d');
    if (!workContext || !displayContext) return;

    displayCanvas.width = workWidth;
    displayCanvas.height = workHeight;

    let frameId = 0;
    let lastFrame = 0;

    const draw = (now: number) => {
      frameId = requestAnimationFrame(draw);
      if (now - lastFrame < TARGET_FRAME_MS || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      lastFrame = now;

      workContext.drawImage(video, 0, 0, workWidth, workHeight);
      displayContext.clearRect(0, 0, workWidth, workHeight);
      displayContext.save();
      if (!calibrationMode) clipToHourglass(displayContext, workWidth, workHeight, boundary);
      displayContext.drawImage(workCanvas, 0, 0);
      displayContext.restore();
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [loaded, boundary, calibrationMode]);

  function movePoint(index: number, event: React.PointerEvent<SVGCircleElement>) {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const bounds = svg.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    setBoundary((points) => points.map((point, pointIndex) => pointIndex === index ? [x, y] : point));
  }

  function saveBoundary() {
    window.localStorage.setItem(BOUNDARY_STORAGE_KEY, JSON.stringify(boundary));
    setCalibrationMode(false);
  }

  function copyBoundary() {
    navigator.clipboard?.writeText(JSON.stringify(boundary));
  }

  return (
    <div className={`hybrid-hourglass ${complete ? 'hybrid-hourglass-complete' : ''}`} role="img" aria-label={`Hourglass ${Math.round(progress * 100)} percent complete`}>
      <div className="hourglass-ambient" />
      {!loaded && <div className="hourglass-loading" />}
      <video
        ref={videoRef}
        className="hourglass-video"
        crossOrigin="anonymous"
        preload="auto"
        muted
        playsInline
        src="https://res.cloudinary.com/dcydj6gao/video/upload/v1785294925/project_video_1_rdj9o6.mp4"
        onLoadedData={() => setLoaded(true)}
        onEnded={handleEnded}
        aria-hidden="true"
      />
      <canvas ref={canvasRef} className="hourglass-canvas" aria-hidden="true" />
      {duration > 0 && !calibrationMode && (
        <button
          type="button"
          className="hourglass-calibration-trigger"
          onClick={() => setCalibrationMode(true)}
          aria-label="Edit hourglass boundary"
        >
          <Pencil aria-hidden="true" />
          <span>Edit outline</span>
        </button>
      )}
      {calibrationMode && (
        <div className="hourglass-calibration" role="dialog" aria-label="Hourglass boundary calibration">
          <svg className="hourglass-calibration-path" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points={boundary.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')} />
            {boundary.map(([x, y], index) => (
              <circle
                key={index}
                cx={x * 100}
                cy={y * 100}
                r="1.25"
                onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) movePoint(index, event);
                }}
              />
            ))}
          </svg>
          <div className="hourglass-calibration-actions">
            <span>Drag each marker to the hourglass edge</span>
            <button type="button" onClick={() => setBoundary(DEFAULT_BOUNDARY)}>Reset</button>
            <button type="button" onClick={() => setCalibrationMode(false)}>Cancel</button>
            <button type="button" onClick={saveBoundary}>Save boundary</button>
            <button type="button" onClick={copyBoundary}>Copy coordinates</button>
          </div>
        </div>
      )}
    </div>
  );
}
