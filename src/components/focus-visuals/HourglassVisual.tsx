import { useEffect, useRef, useState } from 'react';
import type { FocusVisualProps } from './types';

interface HourglassProps extends FocusVisualProps {
  duration: number;
  running: boolean;
}

const VIDEO_DURATION = 1799.9;
const TARGET_FRAME_MS = 1000 / 18;

const MASK_URL = '/visuals/hourglass/hourglass-mask-source.png';
const MASK_WIDTH = 666;
const MASK_HEIGHT = 374;

export default function HourglassVisual({ progress, duration, running }: HourglassProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoEndedRef = useRef(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [maskLoaded, setMaskLoaded] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const loaded = videoLoaded && maskLoaded;
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
    const canvas = canvasRef.current;
    if (!video || !canvas || !loaded) return;

    canvas.width = MASK_WIDTH;
    canvas.height = MASK_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId = 0;
    let lastFrame = 0;

    const draw = (now: number) => {
      frameId = requestAnimationFrame(draw);
      if (now - lastFrame < TARGET_FRAME_MS || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      lastFrame = now;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.min(MASK_WIDTH / vw, MASK_HEIGHT / vh);
      const dx = (MASK_WIDTH - vw * scale) / 2;
      const dy = (MASK_HEIGHT - vh * scale) / 2;

      ctx.clearRect(0, 0, MASK_WIDTH, MASK_HEIGHT);
      ctx.drawImage(video, dx, dy, vw * scale, vh * scale);
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
        onLoadedData={() => setVideoLoaded(true)}
        onEnded={handleEnded}
        aria-hidden="true"
      />
      <canvas ref={canvasRef} className="hourglass-canvas" aria-hidden="true" />
      <img
        src={MASK_URL}
        onLoad={() => setMaskLoaded(true)}
        style={{ display: 'none' }}
        alt=""
        aria-hidden="true"
      />
    </div>
  );
}
