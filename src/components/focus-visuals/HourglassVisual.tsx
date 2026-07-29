import { useEffect, useRef, useState } from 'react';
import type { FocusVisualProps } from './types';

interface HourglassProps extends FocusVisualProps {
  duration: number;
  running: boolean;
}

interface Iris {
  cx: number;
  cy: number;
  innerRx: number;
  innerRy: number;
  outerRx: number;
  outerRy: number;
}

const VIDEO_DURATION = 1799.9;
const TARGET_FRAME_MS = 1000 / 18;
const WORKING_WIDTH = 520;
const IRIS: Iris = {
  cx: 0.505,
  cy: 0.501,
  innerRx: 0.263,
  innerRy: 0.45,
  outerRx: 0.275,
  outerRy: 0.462,
};

const clamp = (value: number, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));

export default function HourglassVisual({ progress, duration, running }: HourglassProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const irisRef = useRef<Iris>(IRIS);
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

    const workContext = workCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    const displayContext = displayCanvas.getContext('2d', { willReadFrequently: true });
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
      const frame = workContext.getImageData(0, 0, workWidth, workHeight);
      const pixels = frame.data;
      const activeIris = irisRef.current;
      const centerX = activeIris.cx * workWidth;
      const centerY = activeIris.cy * workHeight;
      const innerRadiusX = activeIris.innerRx * workWidth;
      const innerRadiusY = activeIris.innerRy * workHeight;
      const outerRadiusX = activeIris.outerRx * workWidth;
      const outerRadiusY = activeIris.outerRy * workHeight;

      for (let index = 0; index < pixels.length; index += 4) {
        const pixel = index / 4;
        const deltaX = pixel % workWidth - centerX;
        const deltaY = Math.floor(pixel / workWidth) - centerY;
        const angle = Math.atan2(deltaY, deltaX);
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const radius = Math.hypot(deltaX, deltaY);
        const innerBoundary = 1 / Math.sqrt((cosine / innerRadiusX) ** 2 + (sine / innerRadiusY) ** 2);
        const outerBoundary = 1 / Math.sqrt((cosine / outerRadiusX) ** 2 + (sine / outerRadiusY) ** 2);
        const outsideAmount = clamp((radius - innerBoundary) / Math.max(1, outerBoundary - innerBoundary));

        pixels[index + 3] = Math.round(pixels[index + 3] * (1 - outsideAmount));
      }

      displayContext.putImageData(frame, 0, 0);
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
