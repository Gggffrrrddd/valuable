import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Fixed-aspect landscape stage for the classic Water Jar (mobile
 * landscape-lock only) — same pattern as <HourglassStage>.
 *
 * The jar scene composition is authored in a fixed 1366×768 reference box
 * (≈ the desktop viewport it is tuned for) and contain-fit scaled into
 * whatever stage the sim provides (scale = min(stageW/1366, stageH/768)), so
 * the jar, water, rain and fish never stretch, crop or drift with the device.
 *
 * The letterbox around the stage is covered by a blurred edge-extend fill:
 * the four edges of the scene are sampled, blurred and stretched outward so
 * the background bleeds off the stage with no visible seam — the image's own
 * vignette continues into the fill (outpainting is unnecessary for this flat
 * background, and plain code fill would show a hard edge, since the vignette
 * is not exactly the session background color).
 *
 * Outside the locked context (desktop, or any non-jar theme) the wrapper
 * collapses to `display: contents`, leaving the existing layout unchanged
 * and the visual free to fill its feed box (full-bleed on desktop).
 */
export const JR_STAGE_W = 1366;
export const JR_STAGE_H = 768;
/** Mirrors the media query that applies the rotated `.mob-sim` landscape stage. */
export const JR_LOCKED_MEDIA = '(pointer: coarse) and (max-width: 1023.5px)';

const SCENE_SRC = '/visuals/jar/jar-scene.png';
/** Depth (source px) sampled inward from each edge, and the blur radius. */
const FILL_BAND = 96;
const FILL_BLUR = 18;

type EdgeStrips = { top: string; bottom: string; left: string; right: string };

function isLockedContext(): boolean {
  try {
    return window.matchMedia(JR_LOCKED_MEDIA).matches;
  } catch {
    return false;
  }
}

/**
 * Samples one edge band of the scene, blurring it (killing banding) and then
 * re-laying the exact boundary line on top, so the strip's inner edge matches
 * the backdrop pixel-for-pixel where the two meet.
 */
function makeStrip(
  source: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  flipX: boolean,
  flipY: boolean,
  boundary: 'left' | 'right' | 'top' | 'bottom',
): string {
  const band = document.createElement('canvas');
  band.width = sw;
  band.height = sh;
  const bctx = band.getContext('2d');
  if (!bctx) return '';
  // Mirror the band so the scene edge ends up on the side that meets the stage.
  bctx.save();
  bctx.translate(flipX ? sw : 0, flipY ? sh : 0);
  bctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  bctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  bctx.restore();

  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  const octx = out.getContext('2d');
  if (!octx) return '';
  octx.filter = `blur(${FILL_BLUR}px)`;
  octx.drawImage(band, 0, 0);
  octx.filter = 'none';
  if (boundary === 'left') octx.drawImage(band, 0, 0, 1, sh, 0, 0, 1, sh);
  else if (boundary === 'right') octx.drawImage(band, sw - 1, 0, 1, sh, sw - 1, 0, 1, sh);
  else if (boundary === 'top') octx.drawImage(band, 0, 0, sw, 1, 0, 0, sw, 1);
  else octx.drawImage(band, 0, sh - 1, sw, 1, 0, sh - 1, sw, 1);
  return out.toDataURL();
}

let stripsPromise: Promise<EdgeStrips> | null = null;

/** Loads the scene once and derives the four cached edge strips. */
function loadStrips(): Promise<EdgeStrips> {
  if (stripsPromise) return stripsPromise;
  stripsPromise = new Promise<EdgeStrips>((resolve) => {
    if (typeof document === 'undefined') {
      resolve({ top: '', bottom: '', left: '', right: '' });
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const w = img.naturalWidth || 1;
      const h = img.naturalHeight || 1;
      const band = Math.min(FILL_BAND, Math.floor(w / 2), Math.floor(h / 2));
      resolve({
        top: makeStrip(img, 0, 0, w, band, false, true, 'bottom'),
        bottom: makeStrip(img, 0, h - band, w, band, false, true, 'top'),
        left: makeStrip(img, 0, 0, band, h, true, false, 'right'),
        right: makeStrip(img, w - band, 0, band, h, true, false, 'left'),
      });
    };
    img.onerror = () => resolve({ top: '', bottom: '', left: '', right: '' });
    img.src = SCENE_SRC;
  });
  return stripsPromise;
}

function edgeStyle(url?: string): CSSProperties | undefined {
  return url ? { backgroundImage: `url(${url})` } : undefined;
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
  const [strips, setStrips] = useState<EdgeStrips | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStrips().then((loaded) => {
      if (!cancelled) setStrips(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const fillVars =
    active && fit
      ? ({
          '--jr-ox': `${fit.left}px`,
          '--jr-oy': `${fit.top}px`,
          '--jr-sw': `${JR_STAGE_W * fit.scale}px`,
          '--jr-sh': `${JR_STAGE_H * fit.scale}px`,
        } as CSSProperties)
      : undefined;

  return (
    <>
      {active && (
        <div className="jr-fill" aria-hidden="true" style={fillVars}>
          <div className="jr-fill-edge jr-fill-top" style={edgeStyle(strips?.top)} />
          <div className="jr-fill-edge jr-fill-bottom" style={edgeStyle(strips?.bottom)} />
          <div className="jr-fill-edge jr-fill-left" style={edgeStyle(strips?.left)} />
          <div className="jr-fill-edge jr-fill-right" style={edgeStyle(strips?.right)} />
        </div>
      )}
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
    </>
  );
}
