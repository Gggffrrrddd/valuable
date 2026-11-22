import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import BladeParticles from './BladeParticles';

/**
 * Fixed-aspect landscape stage for the Particle Painting (mobile
 * landscape-lock only) — exact same contain-fit pattern as <JarStage>.
 *
 * The easel scene + particle canvas are authored in a fixed 1366×768
 * reference box and contain-fit scaled into the sim's stage
 * (scale = min(stageW/1366, stageH/768)), so the easel, painting reveal and
 * particles share one coordinate system at every device aspect.
 *
 * The letterbox is filled by strips of the easel image's own edge pixels
 * (2px source slices stretched outward, same as the Jar), so there is no
 * colour step at the stage boundary. Outside the locked context (desktop or
 * any non-blade theme) the wrapper collapses to `display: contents`, leaving
 * the existing layout byte-identical.
 */
export const BL_STAGE_W = 1366;
export const BL_STAGE_H = 768;
/** Mirrors the media query that applies the rotated `.mob-sim` landscape stage. */
export const BL_LOCKED_MEDIA = '(pointer: coarse) and (max-width: 1023.5px)';

const BASE_URL = '/visuals/blade/easel-base.png';
const BASE_W = 1672;
const BASE_H = 941;
/** Width of the source edge slice stretched into the letterbox (scene px). */
const EDGE_PX = 2;
/** How far the backdrop reaches past the stage (scene px). */
const BACKDROP_EXT = 3000;
/** How far each strip reaches inward under the stage edge. */
const EDGE_FADE = 67;

const SCENE_SCALE = Math.max(BL_STAGE_W / BASE_W, BL_STAGE_H / BASE_H);
const DISP_W = BASE_W * SCENE_SCALE;
const DISP_H = BASE_H * SCENE_SCALE;

function isLockedContext(): boolean {
  // TEMP-MEASURE: allow forcing the mobile stage from a desktop browser for
  // boundary measurements (`?bltest=1`). Removed before commit.
  try {
    if (new URLSearchParams(window.location.search).has('bltest')) return true;
  } catch {
    /* ignore */
  }
  try {
    return window.matchMedia(BL_LOCKED_MEDIA).matches;
  } catch {
    return false;
  }
}

/** Same cover + object-position anchors as `.blade-easel-base`. */
function baseOffset() {
  const compact =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 1023.5px)').matches;
  const ax = 0.15;
  const ay = compact ? 0.75 : 0.15;
  return { ox: (BL_STAGE_W - DISP_W) * ax, oy: (BL_STAGE_H - DISP_H) * ay };
}

function BladeBackdrop() {
  const { ox, oy } = baseOffset();
  const sides = [
    { key: 'l', x: -BACKDROP_EXT, y: oy, w: BACKDROP_EXT + EDGE_FADE, h: DISP_H, vb: `0 0 ${EDGE_PX} ${BASE_H}` },
    { key: 'r', x: ox + DISP_W - EDGE_FADE, y: oy, w: BACKDROP_EXT + EDGE_FADE, h: DISP_H, vb: `${BASE_W - EDGE_PX} 0 ${EDGE_PX} ${BASE_H}` },
    { key: 't', x: ox, y: -BACKDROP_EXT, w: DISP_W, h: BACKDROP_EXT + EDGE_FADE, vb: `0 0 ${BASE_W} ${EDGE_PX}` },
    { key: 'b', x: ox, y: oy + DISP_H - EDGE_FADE, w: DISP_W, h: BACKDROP_EXT + EDGE_FADE, vb: `0 ${BASE_H - EDGE_PX} ${BASE_W} ${EDGE_PX}` },
  ];

  return (
    <svg
      className="bl-stage-backdrop"
      viewBox={`0 0 ${BL_STAGE_W} ${BL_STAGE_H}`}
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {sides.map((side) => (
        <svg
          key={side.key}
          x={side.x}
          y={side.y}
          width={side.w}
          height={side.h}
          viewBox={side.vb}
          preserveAspectRatio="none"
          overflow="hidden"
        >
          <image href={BASE_URL} x="0" y="0" width={BASE_W} height={BASE_H} />
        </svg>
      ))}
    </svg>
  );
}

export default function BladeStage({
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
    // The host is the visual box inside `.mob-sim`; clientWidth/clientHeight
    // are transform-unaware, so they read the true landscape stage.
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
      const scale = Math.min(w / BL_STAGE_W, h / BL_STAGE_H);
      setFit({
        left: (w - BL_STAGE_W * scale) / 2,
        top: (h - BL_STAGE_H * scale) / 2,
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
    <>
      {active && <BladeParticles />}
      <div
        ref={ref}
        className={active ? 'bl-stage' : 'contents'}
        style={
          active && fit
            ? { left: fit.left, top: fit.top, transform: `scale(${fit.scale})` }
            : undefined
        }
      >
        {active && <BladeBackdrop />}
        {children}
      </div>
    </>
  );
}
