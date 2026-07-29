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

function smoothBoundary(points: BoundaryPoint[]) {
  const sampled = points.filter((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return Math.hypot(point[0] - previous[0], point[1] - previous[1]) >= 0.0025;
  });
  const limited = sampled.length > 180
    ? sampled.filter((_, index) => index % Math.ceil(sampled.length / 180) === 0)
    : sampled;
  if (limited.length < 8) return points;

  return limited.map((point, index) => {
    const previous = limited[(index - 1 + limited.length) % limited.length];
    const next = limited[(index + 1) % limited.length];
    return [
      previous[0] * 0.15 + point[0] * 0.7 + next[0] * 0.15,
      previous[1] * 0.15 + point[1] * 0.7 + next[1] * 0.15,
    ] as BoundaryPoint;
  });
}

function boundaryPath(boundary: BoundaryPoint[]) {
  if (!boundary.length) return '';
  return `${boundary.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x * 100} ${y * 100}`).join(' ')} Z`;
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
  const drawingRef = useRef(false);
  const calibrationStartRef = useRef<BoundaryPoint[]>(DEFAULT_BOUNDARY);
  const [loaded, setLoaded] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [boundary, setBoundary] = useState<BoundaryPoint[]>(readBoundary);
  const [history, setHistory] = useState<BoundaryPoint[][]>([]);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
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
      if ((!calibrationMode || previewMode) && boundary.length >= 3) {
        clipToHourglass(displayContext, workWidth, workHeight, boundary);
      }
      displayContext.drawImage(workCanvas, 0, 0);
      displayContext.restore();
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [loaded, boundary, calibrationMode, previewMode]);

  function pointerPosition(event: React.PointerEvent<SVGSVGElement>): BoundaryPoint {
    const bounds = event.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    ];
  }

  function startDrawing(event: React.PointerEvent<SVGSVGElement>) {
    if (previewMode) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    setHistory((items) => [...items.slice(-4), boundary]);
    setBoundary([pointerPosition(event)]);
  }

  function continueDrawing(event: React.PointerEvent<SVGSVGElement>) {
    if (!drawingRef.current || previewMode) return;
    const point = pointerPosition(event);
    setBoundary((points) => {
      const previous = points[points.length - 1];
      if (previous && Math.hypot(point[0] - previous[0], point[1] - previous[1]) < 0.0025) return points;
      return [...points, point];
    });
  }

  function finishDrawing(event: React.PointerEvent<SVGSVGElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setBoundary((points) => points.length >= 8 ? smoothBoundary(points) : history[history.length - 1] ?? DEFAULT_BOUNDARY);
  }

  function openCalibration() {
    calibrationStartRef.current = boundary;
    setHistory([]);
    setPreviewMode(false);
    setCalibrationMode(true);
  }

  function cancelCalibration() {
    setBoundary(calibrationStartRef.current);
    setCalibrationMode(false);
    setPreviewMode(false);
  }

  function undoBoundary() {
    setHistory((items) => {
      const previous = items[items.length - 1];
      if (previous) setBoundary(previous);
      return items.slice(0, -1);
    });
  }

  function saveBoundary() {
    window.localStorage.setItem(BOUNDARY_STORAGE_KEY, JSON.stringify(boundary));
    setCalibrationMode(false);
    setPreviewMode(false);
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
          onClick={openCalibration}
          aria-label="Edit hourglass boundary"
        >
          <Pencil aria-hidden="true" />
          <span>Edit outline</span>
        </button>
      )}
      {calibrationMode && (
        <div className={`hourglass-calibration ${previewMode ? 'hourglass-calibration-preview' : ''}`} role="dialog" aria-label="Hourglass boundary calibration">
          <svg
            className="hourglass-calibration-path"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            onPointerDown={startDrawing}
            onPointerMove={continueDrawing}
            onPointerUp={finishDrawing}
            onPointerCancel={finishDrawing}
          >
            {boundary.length >= 2 && <path d={boundaryPath(boundary)} />}
          </svg>
          <div className="hourglass-calibration-actions">
            <span>{previewMode ? 'Previewing final crop' : 'Draw once around the complete outer edge'}</span>
            <button type="button" onClick={undoBoundary} disabled={!history.length}>Undo</button>
            <button type="button" onClick={() => { setHistory((items) => [...items, boundary]); setBoundary([]); }}>Clear</button>
            <button type="button" onClick={() => setPreviewMode((value) => !value)} disabled={boundary.length < 3}>{previewMode ? 'Draw again' : 'Preview'}</button>
            <button type="button" onClick={cancelCalibration}>Cancel</button>
            <button type="button" onClick={saveBoundary} disabled={boundary.length < 3}>Save boundary</button>
            <button type="button" onClick={copyBoundary}>Copy coordinates</button>
          </div>
        </div>
      )}
    </div>
  );
}
