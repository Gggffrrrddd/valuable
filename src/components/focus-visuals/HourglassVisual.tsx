import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { FocusVisualProps } from './types';

interface HourglassProps extends FocusVisualProps {
  duration: number;
  running: boolean;
}

const VIDEO_DURATION = 1799.9;
const MASK_URL = '/visuals/hourglass/hourglass-mask-source.png';
const MASK_ALIGNMENT = {
  x: 0.49851190476190477,
  y: 0.4999999999999999,
  scale: 1.35,
};

const SESSION_COLOR_TINTS = [
  { hue: 0, saturate: 1.2, label: 'amber-orange' },
  { hue: 200, saturate: 1.3, label: 'blue-sapphire' },
  { hue: 280, saturate: 1.25, label: 'purple-violet' },
  { hue: 340, saturate: 1.3, label: 'red-ruby' },
  { hue: 120, saturate: 1.2, label: 'green-emerald' },
];

export default function HourglassVisual({ progress, duration, running }: HourglassProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoEndedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [sessionColor] = useState(() => SESSION_COLOR_TINTS[Math.floor(Math.random() * SESSION_COLOR_TINTS.length)]);
  const complete = progress >= 1;
  const playbackRate = VIDEO_DURATION / duration;
  const videoStyle: CSSProperties = {
    opacity: maskDataUrl ? 1 : 0,
    maskImage: maskDataUrl ? `url(${maskDataUrl})` : undefined,
    WebkitMaskImage: maskDataUrl ? `url(${maskDataUrl})` : undefined,
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskSize: '100% 100%',
    WebkitMaskSize: '100% 100%',
    maskPosition: '0 0',
    WebkitMaskPosition: '0 0',
    filter: duration > 0 ? `hue-rotate(${sessionColor.hue}deg) saturate(${sessionColor.saturate})` : undefined,
  };

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
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const image = new Image();
    const createMask = () => {
      if (cancelled) return;
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(rect.width * pixelRatio);
      canvas.height = Math.round(rect.height * pixelRatio);
      const context = canvas.getContext('2d');
      if (!context) return;

      const width = rect.width * MASK_ALIGNMENT.scale;
      const height = width * image.naturalHeight / image.naturalWidth;
      context.scale(pixelRatio, pixelRatio);
      context.drawImage(
        image,
        rect.width * MASK_ALIGNMENT.x - width / 2,
        rect.height * MASK_ALIGNMENT.y - height / 2,
        width,
        height,
      );
      setMaskDataUrl(canvas.toDataURL('image/png'));
    };

    image.onload = createMask;
    image.src = MASK_URL;
    const observer = new ResizeObserver(createMask);
    observer.observe(container);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`hybrid-hourglass ${complete ? 'hybrid-hourglass-complete' : ''}`}
      role="img"
      aria-label={`Hourglass ${Math.round(progress * 100)} percent complete`}
    >
      <div 
        className="hourglass-ambient" 
        style={{ 
          filter: duration > 0 ? `hue-rotate(${sessionColor.hue}deg) saturate(${sessionColor.saturate})` : undefined 
        }} 
      />
      {!loaded && <div className="hourglass-loading" />}
      <video
        ref={videoRef}
        className="hourglass-video"
        style={videoStyle}
        crossOrigin="anonymous"
        preload="auto"
        muted
        playsInline
        src="https://res.cloudinary.com/dcydj6gao/video/upload/v1785294925/project_video_1_rdj9o6.mp4"
        onLoadedData={() => setLoaded(true)}
        onEnded={handleEnded}
        aria-hidden="true"
      />
    </div>
  );
}
