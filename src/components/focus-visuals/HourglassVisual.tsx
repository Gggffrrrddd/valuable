import { useEffect, useRef, useState } from 'react';
import type { FocusVisualProps } from './types';

interface HourglassProps extends FocusVisualProps {
  duration: number;
  running: boolean;
}

const VIDEO_DURATION = 1799.9;
const TARGET_FRAME_MS = 1000 / 18;
const WORKING_WIDTH = 520;
const MASK_BOUNDS = { left: 0.23, top: 0.039, width: 0.55, height: 0.924 };
const MASK_ALPHA_THRESHOLD = 8;

function buildFilledSilhouette(image: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(image, 0, 0);
  const source = context.getImageData(0, 0, canvas.width, canvas.height);
  const silhouette = context.createImageData(canvas.width, canvas.height);
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    let left = canvas.width;
    let right = -1;

    for (let x = 0; x < canvas.width; x += 1) {
      if (source.data[(y * canvas.width + x) * 4 + 3] <= MASK_ALPHA_THRESHOLD) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }

    if (right < left) continue;
    minX = Math.min(minX, left);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, right);
    maxY = Math.max(maxY, y);

    for (let x = left; x <= right; x += 1) {
      const edgeDistance = Math.min(x - left, right - x);
      const alpha = Math.min(255, Math.round((edgeDistance + 1) * 128));
      const index = (y * canvas.width + x) * 4;
      silhouette.data[index] = 255;
      silhouette.data[index + 1] = 255;
      silhouette.data[index + 2] = 255;
      silhouette.data[index + 3] = alpha;
    }
  }

  if (maxX < minX || maxY < minY) return null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.putImageData(silhouette, 0, 0);
  return { canvas, x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export default function HourglassVisual({ progress, duration, running }: HourglassProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskImageRef = useRef<HTMLImageElement>(null);
  const videoEndedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [maskLoaded, setMaskLoaded] = useState(false);
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
    const maskImage = maskImageRef.current;
    if (!video || !displayCanvas || !maskImage || !loaded || !maskLoaded) return;

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

    const silhouette = buildFilledSilhouette(maskImage);
    if (!silhouette) return;

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = workWidth;
    maskCanvas.height = workHeight;
    const maskContext = maskCanvas.getContext('2d');
    if (!maskContext) return;
    maskContext.imageSmoothingEnabled = true;
    maskContext.drawImage(
      silhouette.canvas,
      silhouette.x,
      silhouette.y,
      silhouette.width,
      silhouette.height,
      MASK_BOUNDS.left * workWidth,
      MASK_BOUNDS.top * workHeight,
      MASK_BOUNDS.width * workWidth,
      MASK_BOUNDS.height * workHeight,
    );

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
      displayContext.globalCompositeOperation = 'source-over';
      displayContext.drawImage(workCanvas, 0, 0);
      displayContext.globalCompositeOperation = 'destination-in';
      displayContext.drawImage(maskCanvas, 0, 0);
      displayContext.globalCompositeOperation = 'source-over';
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [loaded, maskLoaded]);

  return (
    <div className={`hybrid-hourglass ${complete ? 'hybrid-hourglass-complete' : ''}`} role="img" aria-label={`Hourglass ${Math.round(progress * 100)} percent complete`}>
      <div className="hourglass-ambient" />
      {(!loaded || !maskLoaded) && <div className="hourglass-loading" />}
      <img
        ref={maskImageRef}
        className="hourglass-mask-source"
        src="/visuals/hourglass/hourglass-shell.png"
        onLoad={() => setMaskLoaded(true)}
        alt=""
        aria-hidden="true"
      />
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
