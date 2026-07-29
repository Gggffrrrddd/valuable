import { useEffect, useRef, useState } from 'react';
import type { FocusVisualProps } from './types';

interface HourglassProps extends FocusVisualProps {
  duration: number;
  running: boolean;
}

const VIDEO_DURATION = 1799.9;
const TARGET_FRAME_MS = 1000 / 18;
const WORKING_WIDTH = 520;
function clipToHourglass(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, height: number) {
  const cropLeft = 0.23 * width;
  const cropTop = 0.039 * height;
  const cropWidth = 0.55 * width;
  const cropHeight = 0.924 * height;

  const x = (value: number) => cropLeft + value * cropWidth;
  const y = (value: number) => cropTop + value * cropHeight;
  const center = x(0.5);

  // Hand-drawn smooth silhouette, based on the hourglass proportions in the source crop.
  context.beginPath();
  context.moveTo(x(0.08), y(0.02));
  context.lineTo(x(0.92), y(0.02));
  context.bezierCurveTo(x(0.96), y(0.02), x(0.97), y(0.07), x(0.93), y(0.12));
  context.bezierCurveTo(x(0.86), y(0.23), x(0.74), y(0.38), x(0.59), y(0.47));
  context.bezierCurveTo(x(0.55), y(0.49), center, y(0.5), center, y(0.51));
  context.bezierCurveTo(center, y(0.52), x(0.55), y(0.54), x(0.59), y(0.57));
  context.bezierCurveTo(x(0.74), y(0.66), x(0.86), y(0.81), x(0.93), y(0.9));
  context.bezierCurveTo(x(0.97), y(0.95), x(0.96), y(0.98), x(0.92), y(0.98));
  context.lineTo(x(0.08), y(0.98));
  context.bezierCurveTo(x(0.04), y(0.98), x(0.03), y(0.95), x(0.07), y(0.9));
  context.bezierCurveTo(x(0.14), y(0.81), x(0.26), y(0.66), x(0.41), y(0.57));
  context.bezierCurveTo(x(0.45), y(0.54), center, y(0.52), center, y(0.51));
  context.bezierCurveTo(center, y(0.5), x(0.45), y(0.49), x(0.41), y(0.47));
  context.bezierCurveTo(x(0.26), y(0.38), x(0.14), y(0.23), x(0.07), y(0.12));
  context.bezierCurveTo(x(0.03), y(0.07), x(0.04), y(0.02), x(0.08), y(0.02));
  context.closePath();
  context.clip();
}

export default function HourglassVisual({ progress, duration, running }: HourglassProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoEndedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
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

      displayContext.clearRect(0, 0, workWidth, workHeight);
      displayContext.save();
      clipToHourglass(displayContext, workWidth, workHeight);
      workContext.drawImage(video, 0, 0, workWidth, workHeight);
      displayContext.drawImage(workCanvas, 0, 0);
      displayContext.restore();
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [loaded]);

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
    </div>
  );
}
