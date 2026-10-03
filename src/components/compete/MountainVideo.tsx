import { useEffect, useRef, useState } from 'react';
import type { PlacementTransform } from './placementConfig';

export default function MountainVideo({ transform, progress = 1 }: { transform: PlacementTransform; progress?: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<Map<number, ImageData>>(new Map());
  const [error, setError] = useState(false);
  const keyColorRef = useRef<{ r: number; g: number; b: number } | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const handleSeeked = () => {
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const cacheKey = Math.floor(video.currentTime * 10);
      if (cacheRef.current.has(cacheKey)) {
        ctx.putImageData(cacheRef.current.get(cacheKey)!, 0, 0);
        return;
      }

      const marginX = video.videoWidth * 0.04;
      const marginY = video.videoHeight * 0.04;
      const sw = video.videoWidth - marginX * 2;
      const sh = video.videoHeight - marginY * 2;

      ctx.drawImage(video, marginX, marginY, sw, sh, 0, 0, canvas.width, canvas.height);

      let frame;
      try {
        frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch (e) {
        console.warn('CORS error getting image data', e);
        setError(true);
        return;
      }

      const data = frame.data;
      if (!keyColorRef.current) {
        let rSum = 0, gSum = 0, bSum = 0;
        let count = 0;
        for (let x = 0; x < 5; x++) {
          for (let y = 0; y < 5; y++) {
            const idx = (y * canvas.width + x) * 4;
            rSum += data[idx];
            gSum += data[idx + 1];
            bSum += data[idx + 2];
            count++;
          }
        }
        keyColorRef.current = { r: rSum / count, g: gSum / count, b: bSum / count };
      }

      const { r: rKey, g: gKey, b: bKey } = keyColorRef.current;
      const t1 = 50;
      const t2 = 120;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const dist = Math.sqrt((r - rKey) ** 2 + (g - gKey) ** 2 + (b - bKey) ** 2);

        if (dist < t1) {
          data[i + 3] = 0;
        } else if (dist < t2) {
          const alpha = (dist - t1) / (t2 - t1);
          data[i + 3] = Math.floor(alpha * 255);
          const avgRG = (r + g) / 2;
          if (b > avgRG) data[i + 2] = avgRG;
        }
      }

      ctx.putImageData(frame, 0, 0);
      cacheRef.current.set(cacheKey, frame);
    };

    video.addEventListener('seeked', handleSeeked);
    if (video.readyState >= 2) handleSeeked();

    return () => {
      video.removeEventListener('seeked', handleSeeked);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const setTime = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = video.duration * progress;
      }
    };

    if (video.readyState >= 1) {
      setTime();
    } else {
      video.addEventListener('loadedmetadata', setTime);
      return () => video.removeEventListener('loadedmetadata', setTime);
    }
  }, [progress]);

  const style = {
    transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.zoom})`,
  };

  return (
    <>
      <video
        ref={videoRef}
        src="/visuals/compete/everest.mp4"
        muted
        playsInline
        className={`absolute inset-0 h-full w-full object-cover ${!error ? 'pointer-events-none opacity-0' : ''}`}
        style={
          error
            ? {
                ...style,
                maskImage: 'radial-gradient(ellipse at center, black 50%, transparent 100%)',
                WebkitMaskImage: 'radial-gradient(ellipse at center, black 50%, transparent 100%)',
              }
            : undefined
        }
      />
      {!error && (
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={style}
        />
      )}
    </>
  );
}
