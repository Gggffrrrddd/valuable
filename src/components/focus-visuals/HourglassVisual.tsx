import { useEffect, useRef, useState } from 'react';
import type { FocusVisualProps } from './types';

interface HourglassProps extends FocusVisualProps {
  duration: number;
  running: boolean;
}

interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

interface BackgroundRange {
  red: number;
  green: number;
  blue: number;
  threshold: number;
}

const VIDEO_DURATION = 1799.9;
const TARGET_FRAME_MS = 1000 / 18;
const WORKING_WIDTH = 520;
const CORNER_SAMPLE_SIZE = 24;
const INITIAL_ELLIPSE: Ellipse = { cx: 0.5, cy: 0.5, rx: 0.25, ry: 0.36 };

const clamp = (value: number, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));

function calibrateBackground(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, height: number): BackgroundRange {
  const size = Math.min(CORNER_SAMPLE_SIZE, Math.floor(width / 4), Math.floor(height / 4));
  const positions = [[0, 0], [width - size, 0], [0, height - size], [width - size, height - size]];
  const samples: [number, number, number][] = [];

  positions.forEach(([x, y]) => {
    const pixels = context.getImageData(x, y, size, size).data;
    for (let index = 0; index < pixels.length; index += 4) {
      samples.push([pixels[index], pixels[index + 1], pixels[index + 2]]);
    }
  });

  const total = samples.length || 1;
  const red = samples.reduce((sum, sample) => sum + sample[0], 0) / total;
  const green = samples.reduce((sum, sample) => sum + sample[1], 0) / total;
  const blue = samples.reduce((sum, sample) => sum + sample[2], 0) / total;
  const distances = samples.map((sample) => Math.hypot(sample[0] - red, sample[1] - green, sample[2] - blue));
  const averageDistance = distances.reduce((sum, value) => sum + value, 0) / total;
  const variance = distances.reduce((sum, value) => sum + (value - averageDistance) ** 2, 0) / total;

  return { red, green, blue, threshold: (averageDistance + Math.sqrt(variance) * 2.5 + 10) * 1.15 };
}

export default function HourglassVisual({ progress, duration, running }: HourglassProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ellipseRef = useRef<Ellipse>(INITIAL_ELLIPSE);
  const backgroundRef = useRef<BackgroundRange | null>(null);
  const interactionRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; ellipse: Ellipse } | null>(null);
  const videoEndedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [ellipse, setEllipse] = useState<Ellipse>(INITIAL_ELLIPSE);
  const [fallback, setFallback] = useState(false);
  const [calibrated, setCalibrated] = useState(false);
  const complete = progress >= 1;
  const playbackRate = VIDEO_DURATION / duration;

  const handleEnded = () => {
    videoEndedRef.current = true;
    setVideoEnded(true);
  };

  const updateEllipse = (nextEllipse: Ellipse) => {
    const next = {
      cx: clamp(nextEllipse.cx, nextEllipse.rx, 1 - nextEllipse.rx),
      cy: clamp(nextEllipse.cy, nextEllipse.ry, 1 - nextEllipse.ry),
      rx: clamp(nextEllipse.rx, 0.12, 0.48),
      ry: clamp(nextEllipse.ry, 0.16, 0.48),
    };
    ellipseRef.current = next;
    setEllipse(next);
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
    if (!video || !displayCanvas || !loaded || fallback) return;

    if ((navigator.hardwareConcurrency ?? 8) <= 4) {
      setFallback(true);
      return;
    }

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

    const workContext = workCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    const displayContext = displayCanvas.getContext('2d', { willReadFrequently: true });
    if (!workContext || !displayContext) {
      setFallback(true);
      return;
    }

    displayCanvas.width = workWidth;
    displayCanvas.height = workHeight;

    let frameId = 0;
    let lastFrame = 0;
    let totalWorkTime = 0;
    let sampledFrames = 0;

    const draw = (now: number) => {
      frameId = requestAnimationFrame(draw);
      if (now - lastFrame < TARGET_FRAME_MS || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      lastFrame = now;

      const startedAt = performance.now();
      try {
        workContext.drawImage(video, 0, 0, workWidth, workHeight);
        if (!backgroundRef.current) {
          backgroundRef.current = calibrateBackground(workContext, workWidth, workHeight);
          setCalibrated(true);
        }

        const frame = workContext.getImageData(0, 0, workWidth, workHeight);
        const pixels = frame.data;
        const background = backgroundRef.current;
        const activeEllipse = ellipseRef.current;
        const ellipseCenterX = activeEllipse.cx * workWidth;
        const ellipseCenterY = activeEllipse.cy * workHeight;
        const ellipseRadiusX = activeEllipse.rx * workWidth;
        const ellipseRadiusY = activeEllipse.ry * workHeight;
        const feather = 0.045;

        for (let index = 0; index < pixels.length; index += 4) {
          const pixel = index / 4;
          const x = pixel % workWidth;
          const y = Math.floor(pixel / workWidth);
          const ellipseDistance = Math.sqrt(((x - ellipseCenterX) / ellipseRadiusX) ** 2 + ((y - ellipseCenterY) / ellipseRadiusY) ** 2);
          const ellipseAlpha = clamp((1 - ellipseDistance) / feather);
          if (ellipseAlpha === 0) {
            pixels[index + 3] = 0;
            continue;
          }

          const distance = Math.hypot(
            pixels[index] - background.red,
            pixels[index + 1] - background.green,
            pixels[index + 2] - background.blue,
          );
          const foregroundAlpha = clamp((distance - background.threshold) / 34);
          const matteAlpha = 1 - foregroundAlpha;

          pixels[index] = Math.round(pixels[index] * foregroundAlpha + 9 * matteAlpha);
          pixels[index + 1] = Math.round(pixels[index + 1] * foregroundAlpha + 11 * matteAlpha);
          pixels[index + 2] = Math.round(pixels[index + 2] * foregroundAlpha + 10 * matteAlpha);
          pixels[index + 3] = Math.round(255 * ellipseAlpha);
        }

        displayContext.putImageData(frame, 0, 0);
        totalWorkTime += performance.now() - startedAt;
        sampledFrames += 1;
        if (sampledFrames === 24 && totalWorkTime / sampledFrames > 48) {
          cancelAnimationFrame(frameId);
          setFallback(true);
        }
      } catch {
        cancelAnimationFrame(frameId);
        setFallback(true);
      }
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [loaded, fallback]);

  const beginInteraction = (event: React.PointerEvent<HTMLElement>, mode: 'move' | 'resize') => {
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = { mode, startX: event.clientX, startY: event.clientY, ellipse: ellipseRef.current };
  };

  const updateInteraction = (event: React.PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    const container = event.currentTarget.parentElement;
    if (!interaction || !container) return;
    const bounds = container.getBoundingClientRect();
    const deltaX = (event.clientX - interaction.startX) / bounds.width;
    const deltaY = (event.clientY - interaction.startY) / bounds.height;

    if (interaction.mode === 'move') {
      updateEllipse({ ...interaction.ellipse, cx: interaction.ellipse.cx + deltaX, cy: interaction.ellipse.cy + deltaY });
    } else {
      updateEllipse({ ...interaction.ellipse, rx: interaction.ellipse.rx + deltaX, ry: interaction.ellipse.ry + deltaY });
    }
  };

  return (
    <div className={`hybrid-hourglass ${fallback ? 'hourglass-fallback' : ''} ${complete ? 'hybrid-hourglass-complete' : ''}`} role="img" aria-label={`Hourglass ${Math.round(progress * 100)} percent complete`}>
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
      {!fallback && (
        <div
          className="hourglass-ellipse-control"
          style={{ left: `${ellipse.cx * 100}%`, top: `${ellipse.cy * 100}%`, width: `${ellipse.rx * 200}%`, height: `${ellipse.ry * 200}%` }}
          onPointerDown={(event) => beginInteraction(event, 'move')}
          onPointerMove={updateInteraction}
          onPointerUp={() => { interactionRef.current = null; }}
          onPointerCancel={() => { interactionRef.current = null; }}
        >
          <span className="hourglass-ellipse-label">{calibrated ? 'Calibrated key boundary' : 'Calibrating backdrop...'}</span>
          <button
            type="button"
            className="hourglass-ellipse-handle"
            aria-label="Resize hourglass boundary"
            onPointerDown={(event) => {
              event.stopPropagation();
              beginInteraction(event, 'resize');
            }}
          />
        </div>
      )}
    </div>
  );
}
