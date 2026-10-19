import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Fixed-aspect landscape stage for the classic Water Jar (mobile
 * landscape-lock only) — same pattern as <HourglassStage>.
 *
 * The jar scene composition is authored in a fixed 1366×768 reference box
 * (≈ the desktop viewport it is tuned for) and contain-fit scaled into
 * whatever stage the sim provides (scale = min(stageW/1366, stageH/768)), so
 * the jar, water, rain and fish never stretch, crop or drift with the device.
 *
 * The letterbox around the stage is left to the session background
 * (#090b0a). The jar scene's edges are flat near-black, so a code fill is
 * seamlessly continuous with the image — no outpainted asset is needed.
 *
 * Outside the locked context (desktop, or any non-jar theme) the wrapper
 * collapses to `display: contents`, leaving the existing layout unchanged
 * and the visual free to fill its feed box (full-bleed on desktop).
 */
export const JR_STAGE_W = 1366;
export const JR_STAGE_H = 768;
/** Mirrors the media query that applies the rotated `.mob-sim` landscape stage. */
export const JR_LOCKED_MEDIA = '(pointer: coarse) and (max-width: 1023.5px)';

function isLockedContext(): boolean {
  try {
    return window.matchMedia(JR_LOCKED_MEDIA).matches;
  } catch {
    return false;
  }
}

/**
 * Reactive form of {@link JR_LOCKED_MEDIA}. Callers use it to decide whether
 * a node belongs to the mobile lock (fixed stage) or the desktop flow — e.g.
 * the mobile-only ambient letterbox layer.
 */
export function useJrLocked(enabled = true): boolean {
  const [locked, setLocked] = useState(() => isLockedContext());
  useEffect(() => {
    if (!enabled) return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(JR_LOCKED_MEDIA);
    } catch {
      return;
    }
    const update = () => setLocked(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [enabled]);
  return enabled ? locked : false;
}

export default function JarStage({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState<{ left: number; top: number; scale: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    // The host is the visual box inside `.mob-sim`. clientWidth/clientHeight
    // are transform-unaware, so in the portrait sim they read the true
    // landscape stage rather than the rotated bounding box.
    const host = el?.parentElement;
    if (!el || !host) return;

    const compute = () => {
      if (!enabled || !isLockedContext()) {
        setFit(null);
        return;
      }
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w < 1 || h < 1) {
        setFit(null);
        return;
      }
      const scale = Math.min(w / JR_STAGE_W, h / JR_STAGE_H);
      setFit({
        left: (w - JR_STAGE_W * scale) / 2,
        top: (h - JR_STAGE_H * scale) / 2,
        scale,
      });
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(host);
    window.addEventListener('resize', compute);
    window.addEventListener('orientationchange', compute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', compute);
      window.removeEventListener('orientationchange', compute);
    };
  }, [enabled]);

  const active = enabled && fit !== null;

  return (
    <div
      ref={ref}
      className={active ? 'jr-stage' : 'contents'}
      style={
        active && fit
          ? { left: fit.left, top: fit.top, transform: `scale(${fit.scale})` }
          : undefined
      }
    >
      {children}
    </div>
  );
}
