import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Fixed-aspect landscape stage for the Hourglass focus session (mobile
 * landscape-lock only).
 *
 * The scene is authored in a fixed 1366×768 reference box — the desktop
 * viewport the composition is tuned for — and contain-fit scaled into whatever
 * stage the sim provides (scale = min(stageW/1366, stageH/768)). Anything that
 * doesn't fit letterboxes to #090b0a, so no element is ever stretched or
 * cropped. The box is declared a CSS size container, so the composition inside
 * is expressed in cqw/cqh that mirror the desktop vw/vh exactly.
 *
 * Outside the locked context (desktop, or any non-hourglass theme) the wrapper
 * collapses to `display: contents`, leaving the existing layout byte-identical.
 */
export const HG_STAGE_W = 1366;
export const HG_STAGE_H = 768;
/** Mirrors the media query that applies the rotated `.mob-sim` landscape stage. */
export const HG_LOCKED_MEDIA = '(pointer: coarse) and (max-width: 1023.5px)';

function isLockedContext(): boolean {
  try {
    return window.matchMedia(HG_LOCKED_MEDIA).matches;
  } catch {
    return false;
  }
}

export default function HourglassStage({
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
    // The host is the `.mob-sim` stage (our parent). clientWidth/clientHeight
    // are transform-unaware, so in the portrait sim they read the true
    // landscape stage (e.g. 812×375) rather than the rotated bounding box.
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
      const scale = Math.min(w / HG_STAGE_W, h / HG_STAGE_H);
      setFit({
        left: (w - HG_STAGE_W * scale) / 2,
        top: (h - HG_STAGE_H * scale) / 2,
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
      className={active ? 'hg-stage' : 'contents'}
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
