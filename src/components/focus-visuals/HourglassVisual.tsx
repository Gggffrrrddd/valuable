import { useEffect, useRef, useState } from 'react';
import type { FocusVisualProps } from './types';

export default function HourglassVisual({ progress }: FocusVisualProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSeekRef = useRef(0);
  const reducedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const complete = progress >= 1;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedRef.current = mq.matches;
    const handler = () => { reducedRef.current = mq.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    videoRef.current?.pause();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.readyState || !loaded) return;

    const now = Date.now();
    if (now - lastSeekRef.current < 80) return;
    lastSeekRef.current = now;

    const value = Math.max(0, Math.min(1, progress));
    const target = reducedRef.current
      ? Math.floor(value * 20) / 20 * (video.duration || 0)
      : value * (video.duration || 0);

    video.currentTime = target;
  }, [progress, loaded]);

  return (
    <div className={`hybrid-hourglass ${complete ? 'hybrid-hourglass-complete' : ''}`} role="img" aria-label={`Hourglass ${Math.round(progress * 100)} percent complete`}>
      <div className="hourglass-ambient" />
      {!loaded && <div className="hourglass-loading" />}
      <video
        ref={videoRef}
        className="hourglass-video"
        preload="auto"
        muted
        playsInline
        src="/visuals/hourglass/hourglass-drain.mp4"
        onLoadedData={() => setLoaded(true)}
        aria-hidden="true"
      />
    </div>
  );
}
