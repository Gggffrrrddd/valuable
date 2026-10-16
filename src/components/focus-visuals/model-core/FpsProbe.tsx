import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/**
 * Rolling FPS meter for perf work: logs `[perf-optimize] <label> avg-fps`
 * every 2 seconds so before/after numbers can be compared on-device.
 * Zero React re-renders (refs only), zero effect on rendering — it only
 * observes. Safe to keep mounted permanently.
 */
export default function FpsProbe({ label }: { label: string }) {
  const acc = useRef({ frames: 0, start: 0 });
  useFrame(({ clock }) => {
    const s = acc.current;
    s.frames += 1;
    const t = clock.getElapsedTime();
    if (s.start === 0) {
      s.start = t;
      return;
    }
    if (t - s.start >= 2) {
      const fps = s.frames / Math.max(0.0001, t - s.start);
      try {
        // eslint-disable-next-line no-console
        console.log(`[perf-optimize] ${label} avg-fps=${fps.toFixed(1)} frames=${s.frames}`);
      } catch {
        /* logging must never break rendering */
      }
      s.frames = 0;
      s.start = t;
    }
  });
  return null;
}
