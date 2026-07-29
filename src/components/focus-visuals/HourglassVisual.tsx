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

export type BoundaryPoint = [number, number];

// Hourglass outline designed for quadraticCurveTo pairing:
// index 0 = moveTo, then odd = control, even = endpoint.
const DEFAULT_TEMPLATE: BoundaryPoint[] = [
  [0.500,0.000],
  [0.462,0.003],
  [0.420,0.010],
  [0.378,0.024],
  [0.340,0.048],
  [0.312,0.086],
  [0.298,0.138],
  [0.300,0.198],
  [0.316,0.266],
  [0.344,0.338],
  [0.382,0.408],
  [0.430,0.472],

  [0.468,0.522],
  [0.490,0.552],
  [0.495,0.575],
  [0.490,0.600],

  [0.470,0.628],
  [0.440,0.660],
  [0.402,0.705],
  [0.365,0.758],
  [0.335,0.815],
  [0.315,0.875],
  [0.308,0.930],
  [0.318,0.972],
  [0.352,0.995],

  [0.500,1.000],

  [0.648,0.995],
  [0.682,0.972],
  [0.692,0.930],
  [0.685,0.875],
  [0.665,0.815],
  [0.635,0.758],
  [0.598,0.705],
  [0.560,0.660],
  [0.530,0.628],

  [0.510,0.600],
  [0.505,0.575],
  [0.510,0.552],
  [0.532,0.522],

  [0.570,0.472],
  [0.618,0.408],
  [0.656,0.338],
  [0.684,0.266],
  [0.700,0.198],
  [0.702,0.138],
  [0.688,0.086],
  [0.660,0.048],
  [0.622,0.024],
  [0.580,0.010],
  [0.538,0.003],
  [0.500,0.000],
];

const DEFAULT_BOUNDARY: BoundaryPoint[] = DEFAULT_TEMPLATE;

interface TemplateTransform {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  width: number;
}

const DEFAULT_TRANSFORM: TemplateTransform = { x: 0, y: 0, scale: 1, rotate: 0, width: 1 };

function readBoundary(): BoundaryPoint[] {
  if (typeof window === 'undefined') return DEFAULT_BOUNDARY;
  try {
    const saved = JSON.parse(window.localStorage.getItem(BOUNDARY_STORAGE_KEY) ?? '');
    if (!Array.isArray(saved) || saved.length < 3) return DEFAULT_BOUNDARY;
    return saved.map(([x, y]: number[]) => [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))]);
  } catch {
    return DEFAULT_BOUNDARY;
  }
}

function applyTransform(points: BoundaryPoint[], t: TemplateTransform): BoundaryPoint[] {
  const cx = 0.5;
  const cy = 0.5;
  const rad = (t.rotate * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return points.map(([x, y]) => {
    const dx = (x - cx) * t.scale * t.width;
    const dy = (y - cy) * t.scale;
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return [Math.max(0, Math.min(1, cx + rx + t.x)), Math.max(0, Math.min(1, cy + ry + t.y))];
  });
}

function pathData(points: BoundaryPoint[]) {
  if (!points.length) return '';
  let d = `M ${points[0][0] * 100} ${points[0][1] * 100}`;
  for (let i = 1; i + 1 < points.length; i += 2) {
    d += ` Q ${points[i][0] * 100} ${points[i][1] * 100} ${points[i + 1][0] * 100} ${points[i + 1][1] * 100}`;
  }
  return d + ' Z';
}

function clipToHourglass(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  boundary: BoundaryPoint[],
) {
  if (boundary.length < 3) return false;
  const first = boundary[0];
  context.beginPath();
  context.moveTo(first[0] * width, first[1] * height);
  for (let i = 1; i + 1 < boundary.length; i += 2) {
    context.quadraticCurveTo(
      boundary[i][0] * width, boundary[i][1] * height,
      boundary[i + 1][0] * width, boundary[i + 1][1] * height,
    );
  }
  context.closePath();
  context.clip();
  return true;
}

export default function HourglassVisual({ progress, duration, running }: HourglassProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoEndedRef = useRef(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; x: number; y: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [boundary, setBoundary] = useState<BoundaryPoint[]>(readBoundary);
  const [transform, setTransform] = useState<TemplateTransform>(DEFAULT_TRANSFORM);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const complete = progress >= 1;
  const playbackRate = VIDEO_DURATION / duration;

  const workingBoundary = applyTransform(DEFAULT_TEMPLATE, transform);

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
    const workHeight = Math.max(1, Math.round((workWidth * sourceHeight) / sourceWidth));
    const workCanvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(workWidth, workHeight)
      : document.createElement('canvas');
    workCanvas.width = workWidth;
    workCanvas.height = workHeight;

    const workContext = workCanvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
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

  function openCalibration() {
    setTransform(DEFAULT_TRANSFORM);
    setPreviewMode(false);
    setCalibrationMode(true);
  }

  function cancelCalibration() {
    setTransform(DEFAULT_TRANSFORM);
    setPreviewMode(false);
    setCalibrationMode(false);
  }

  function saveBoundary() {
    const next = workingBoundary.map(([x, y]) => [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))] as BoundaryPoint);
    setBoundary(next);
    window.localStorage.setItem(BOUNDARY_STORAGE_KEY, JSON.stringify(next));
    setCalibrationMode(false);
    setPreviewMode(false);
  }

  function copyBoundary() {
    navigator.clipboard?.writeText(JSON.stringify(workingBoundary));
  }

  function updateTransform(patch: Partial<TemplateTransform>) {
    setTransform((current) => ({ ...current, ...patch }));
  }

  function startDrag(event: React.PointerEvent<SVGRectElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { clientX: event.clientX, clientY: event.clientY, x: transform.x, y: transform.y };
  }

  function onDrag(event: React.PointerEvent<SVGRectElement>) {
    if (!dragStartRef.current) return;
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = (event.clientX - dragStartRef.current.clientX) / rect.width;
    const dy = (event.clientY - dragStartRef.current.clientY) / rect.height;
    setTransform((current) => ({ ...current, x: dragStartRef.current!.x + dx, y: dragStartRef.current!.y + dy }));
  }

  function endDrag(event: React.PointerEvent<SVGRectElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStartRef.current = null;
  }

  return (
    <div
      className={`hybrid-hourglass ${complete ? 'hybrid-hourglass-complete' : ''}`}
      role="img"
      aria-label={`Hourglass ${Math.round(progress * 100)} percent complete`}
    >
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
          <svg className="hourglass-calibration-path" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect
              className="hourglass-calibration-drag-surface"
              x="0"
              y="0"
              width="100"
              height="100"
              onPointerDown={startDrag}
              onPointerMove={onDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
            <path d={pathData(workingBoundary)} />
          </svg>

          <div className="hourglass-calibration-actions">
            <span>Drag outline, then tune with sliders</span>

            <div className="hourglass-calibration-sliders">
              <label>
                Scale
                <input
                  type="range"
                  min="0.3"
                  max="2"
                  step="0.005"
                  value={transform.scale}
                  onChange={(event) => updateTransform({ scale: Number(event.target.value) })}
                />
              </label>
              <label>
                Width
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.005"
                  value={transform.width}
                  onChange={(event) => updateTransform({ width: Number(event.target.value) })}
                />
              </label>
              <label>
                Rotate
                <input
                  type="range"
                  min="-45"
                  max="45"
                  step="0.5"
                  value={transform.rotate}
                  onChange={(event) => updateTransform({ rotate: Number(event.target.value) })}
                />
              </label>
            </div>

            <div className="hourglass-calibration-buttons">
              <button type="button" onClick={() => setTransform(DEFAULT_TRANSFORM)}>Reset</button>
              <button type="button" onClick={() => setPreviewMode((value) => !value)}>{previewMode ? 'Edit' : 'Preview'}</button>
              <button type="button" onClick={cancelCalibration}>Cancel</button>
              <button type="button" onClick={saveBoundary}>Save boundary</button>
              <button type="button" onClick={copyBoundary}>Copy coordinates</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
