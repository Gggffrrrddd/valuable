import { useEffect, useRef, useState } from 'react';
import type { PlacementTransform } from './placementConfig';

/** Chroma-key tuning (validated offline against real frames). */
const T1 = 35; // distance fully background
const T2 = 70; // distance fully subject (narrow falloff band)
const ERODE_PASSES = 1; // matte choke: contract opaque boundary 1px
const EDGE = 5; // sample patch size per point

export default function MountainVideo({
  transform,
  progress = 1,
}: {
  transform: PlacementTransform;
  progress?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<Map<number, ImageData>>(new Map());
  const keyColorRef = useRef<{ r: number; g: number; b: number } | null>(null);
  const [error, setError] = useState(false);

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

      const w = canvas.width;
      const h = canvas.height;

      const cacheKey = Math.floor(video.currentTime * 10);
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        ctx.putImageData(cached, 0, 0);
        return;
      }

      // crop 4% margin from each edge, scale the inner 92% back to fill
      const marginX = w * 0.04;
      const marginY = h * 0.04;
      ctx.drawImage(
        video,
        marginX,
        marginY,
        w - marginX * 2,
        h - marginY * 2,
        0,
        0,
        w,
        h,
      );

      let frame: ImageData;
      try {
        frame = ctx.getImageData(0, 0, w, h);
      } catch (e) {
        console.warn('[chroma] CORS blocked getImageData, falling back to raw video', e);
        setError(true);
        return;
      }

      const data = frame.data;

      // --- reference blue: average of 8 patches (4 corners + 4 edge midpoints) ---
      if (!keyColorRef.current) {
        const pts: Array<[number, number]> = [
          [0, 0],
          [w - EDGE, 0],
          [0, h - EDGE],
          [w - EDGE, h - EDGE],
          [(w >> 1) - (EDGE >> 1), 0],
          [(w >> 1) - (EDGE >> 1), h - EDGE],
          [0, (h >> 1) - (EDGE >> 1)],
          [w - EDGE, (h >> 1) - (EDGE >> 1)],
        ];
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let total = 0;
        const per: string[] = [];
        for (const [x0, y0] of pts) {
          let pr = 0;
          let pg = 0;
          let pb = 0;
          let n = 0;
          for (let y = y0; y < y0 + EDGE; y++) {
            for (let x = x0; x < x0 + EDGE; x++) {
              const i = (y * w + x) * 4;
              pr += data[i];
              pg += data[i + 1];
              pb += data[i + 2];
              n++;
            }
          }
          rSum += pr;
          gSum += pg;
          bSum += pb;
          total += n;
          per.push(`(${x0},${y0}) rgb(${Math.round(pr / n)},${Math.round(pg / n)},${Math.round(pb / n)})`);
        }
        const key = { r: rSum / total, g: gSum / total, b: bSum / total };
        keyColorRef.current = key;
        console.log(
          `[chroma] sampled key rgb(${key.r.toFixed(1)}, ${key.g.toFixed(1)}, ${key.b.toFixed(1)}) from ${pts.length} edge points`,
        );
        console.log(`[chroma] points: ${per.join(' | ')}`);
      }

      const { r: kr, g: kg, b: kb } = keyColorRef.current;

      // --- key + despill ---
      const alpha = new Uint8Array(w * h);
      for (let p = 0, i = 0; p < w * h; p++, i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const dr = r - kr;
        const dg = g - kg;
        const db = b - kb;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        let a = 0;
        if (dist > T1) a = dist >= T2 ? 255 : Math.round(((dist - T1) / (T2 - T1)) * 255);
        alpha[p] = a;
        if (a > 0) {
          const m = r < g ? r : g;
          if (b > m) data[i + 2] = m; // pull blue down toward min(red, green)
        }
      }

      // --- alpha erosion (matte choke): shrink opaque region inward ---
      let cur = alpha;
      for (let pass = 0; pass < ERODE_PASSES; pass++) {
        const next = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
          const yU = y > 0 ? y - 1 : 0;
          const yD = y < h - 1 ? y + 1 : h - 1;
          for (let x = 0; x < w; x++) {
            const xL = x > 0 ? x - 1 : 0;
            const xR = x < w - 1 ? x + 1 : w - 1;
            let m = cur[y * w + x];
            for (let yy = yU; yy <= yD; yy++) {
              const row = yy * w;
              for (let xx = xL; xx <= xR; xx++) {
                const v = cur[row + xx];
                if (v < m) m = v;
              }
            }
            next[y * w + x] = m;
          }
        }
        cur = next;
      }
      for (let p = 0, i = 3; p < w * h; p++, i += 4) data[i] = cur[p];

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
