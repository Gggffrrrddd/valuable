import { useEffect, useRef, useState } from 'react';
import type { FocusVisualProps } from './types';

interface HourglassProps extends FocusVisualProps {
  duration: number;
  running: boolean;
}

const VIDEO_DURATION = 1799.9;
const TARGET_FRAME_MS = 1000 / 18;
const WORKING_WIDTH = 520;

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export default function HourglassVisual({ progress, duration, running }: HourglassProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brightnessRef = useRef(0.72);
  const saturationRef = useRef(0.24);
  const videoEndedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [brightness, setBrightness] = useState(0.72);
  const [saturation, setSaturation] = useState(0.24);
  const [fallback, setFallback] = useState(false);
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
        const frame = workContext.getImageData(0, 0, workWidth, workHeight);
        const pixels = frame.data;
        const brightnessCutoff = brightnessRef.current;
        const saturationCutoff = saturationRef.current;

        for (let index = 0; index < pixels.length; index += 4) {
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          const highest = Math.max(red, green, blue);
          const lowest = Math.min(red, green, blue);
          const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
          const pixelSaturation = highest === 0 ? 0 : (highest - lowest) / highest;
          const lightness = clamp((luminance - brightnessCutoff) / (1 - brightnessCutoff));
          const neutrality = clamp((saturationCutoff - pixelSaturation) / saturationCutoff);
          const backgroundAmount = lightness * neutrality;

          pixels[index + 3] = Math.round(pixels[index + 3] * (1 - backgroundAmount));
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

      <label className="hourglass-key-control">
        <span>Backdrop key</span>
        <input
          type="range"
          min="55"
          max="90"
          value={Math.round(brightness * 100)}
          onChange={(event) => {
            const value = Number(event.target.value) / 100;
            brightnessRef.current = value;
            setBrightness(value);
          }}
          aria-label="Backdrop brightness threshold"
        />
        <output>{Math.round(brightness * 100)}</output>
        <span>Neutral</span>
        <input
          type="range"
          min="8"
          max="45"
          value={Math.round(saturation * 100)}
          onChange={(event) => {
            const value = Number(event.target.value) / 100;
            saturationRef.current = value;
            setSaturation(value);
          }}
          aria-label="Backdrop saturation threshold"
        />
        <output>{Math.round(saturation * 100)}</output>
      </label>
    </div>
  );
}
