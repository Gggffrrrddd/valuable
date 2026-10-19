import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Fixed-aspect landscape stage for the Hourglass scene backdrop (mobile
 * landscape-lock only).
 *
 * Wraps the backdrop layer only. The composition is authored in a fixed
 * 1366×768 reference box — the desktop viewport it is tuned for — and
 * contain-fit scaled into whatever stage the sim provides
 * (scale = min(stageW/1366, stageH/768)).
 *
 * The backdrop image is the extended scene: the desktop-locked crop maps onto
 * the stage box and its outpainted margins spill past the stage to cover
 * whatever letterbox the device's aspect ratio leaves (no separate fill layer
 * and no blur strips — the reveal is driven purely by the same contain-fit
 * calculation, via the stage's container width in CSS).
 *
 * The hourglass, flip clock, controls and text live outside this wrapper, so
 * they keep their existing sim layout and sizes. Outside the locked context
 * (desktop, or any non-hourglass theme) the wrapper collapses to
 * `display: contents`, leaving the existing layout byte-identical.
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

/**
 * Reactive form of {@link HG_LOCKED_MEDIA}. Callers use it to decide whether a
 * node belongs inside the scaled stage (mobile lock) or the normal flow
 * (desktop) — e.g. the flip clock, which lives in the stage on mobile but in
 * the layout's clock zone on desktop.
 */
export function useHgLocked(enabled = true): boolean {
  const [locked, setLocked] = useState(() => {
    try {
      return window.matchMedia(HG_LOCKED_MEDIA).matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!enabled) return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(HG_LOCKED_MEDIA);
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

  const stageVars =
    active && fit
      ? ({
          '--hg-ox': `${fit.left}px`,
          '--hg-oy': `${fit.top}px`,
          '--hg-sw': `${HG_STAGE_W * fit.scale}px`,
          '--hg-sh': `${HG_STAGE_H * fit.scale}px`,
        } as CSSProperties)
      : undefined;

  return (
    <div
      ref={ref}
      className={active ? 'hg-stage' : 'contents'}
      style={
        active && fit
          ? { left: fit.left, top: fit.top, transform: `scale(${fit.scale})`, ...stageVars }
          : undefined
      }
    >
      {children}
    </div>
  );
}
