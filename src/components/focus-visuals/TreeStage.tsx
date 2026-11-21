import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Fixed-aspect landscape stage for the Tree focus visual (mobile
 * landscape-lock only) — same pattern as <HourglassStage>/<JarStage>.
 *
 * The tree scene composition (background + leaf overlay) is authored in a
 * fixed 1366×768 reference box and contain-fit scaled into whatever stage the
 * sim provides (scale = min(stageW/1366, stageH/768)). The background image
 * and the leaf positions therefore share one coordinate system and can never
 * drift apart or be cropped by a cover-fit on a different aspect ratio.
 *
 * Outside the stage, the scene's own edge pixels are stretched outward (the
 * same profile-based backdrop used by Jar) so the letterbox is a continuation
 * of the scene rather than a flat fill.
 */
export const TR_STAGE_W = 1366;
export const TR_STAGE_H = 768;
/** Mirrors the media query that applies the rotated `.mob-sim` landscape stage. */
export const TR_LOCKED_MEDIA = '(pointer: coarse) and (max-width: 1023.5px)';

const TREE_SCENE_URL = '/visuals/tree/tree-scene.png';
const IMG_W = 1672;
const IMG_H = 941;

/** How far the edge strips reach past the stage (scene px). */
const BACKDROP_EXT = 3000;
/** Width of the edge strip copied into the letterbox (scene px). */
const EDGE_PX = 2;
/**
 * Edge dissolve in scene px, sized in stage-relative units:
 * 4% of 1366 ≈ 67 horizontally; 4% of 768 ≈ 38 vertically.
 */
const EDGE_FADE_X = 67;
const EDGE_FADE_Y = 38;
const EDGE_FADE = Math.max(EDGE_FADE_X, EDGE_FADE_Y);

const SCENE_SCALE = Math.max(TR_STAGE_W / IMG_W, TR_STAGE_H / IMG_H);
const SCENE_X = (TR_STAGE_W - IMG_W * SCENE_SCALE) / 2;
const SCENE_Y = (TR_STAGE_H - IMG_H * SCENE_SCALE) / 2;

function isLockedContext(): boolean {
  // TEMP-MEASURE: allow forcing the mobile stage from a desktop browser for
  // boundary measurements (`?trtest=1`). Removed before commit.
  try {
    if (new URLSearchParams(window.location.search).has('trtest')) return true;
  } catch {
    /* ignore */
  }
  try {
    return window.matchMedia(TR_LOCKED_MEDIA).matches;
  } catch {
    return false;
  }
}

/** Edge-sampled backdrop for the staged tree scene. */
function TreeBackdrop() {
  const id = useId().replace(/:/g, '');
  const maskId = `tr-edge-mask-${id}`;
  const leftId = `tr-edge-l-${id}`;
  const rightId = `tr-edge-r-${id}`;
  const topId = `tr-edge-t-${id}`;
  const bottomId = `tr-edge-b-${id}`;

  const fadeStops = (
    <>
      <stop offset="0" stopColor="#fff" stopOpacity="0" />
      <stop offset=".15" stopColor="#fff" stopOpacity=".05" />
      <stop offset=".35" stopColor="#fff" stopOpacity=".22" />
      <stop offset=".55" stopColor="#fff" stopOpacity=".5" />
      <stop offset=".75" stopColor="#fff" stopOpacity=".78" />
      <stop offset=".9" stopColor="#fff" stopOpacity=".94" />
      <stop offset="1" stopColor="#fff" stopOpacity="1" />
    </>
  );

  return (
    <svg
      className="tr-stage-backdrop"
      viewBox={`0 0 ${TR_STAGE_W} ${TR_STAGE_H}`}
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={leftId} x1="0" y1="0" x2="1" y2="0">{fadeStops}</linearGradient>
        <linearGradient id={rightId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset=".1" stopColor="#fff" stopOpacity=".94" />
          <stop offset=".25" stopColor="#fff" stopOpacity=".78" />
          <stop offset=".45" stopColor="#fff" stopOpacity=".5" />
          <stop offset=".65" stopColor="#fff" stopOpacity=".22" />
          <stop offset=".85" stopColor="#fff" stopOpacity=".05" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={topId} x1="0" y1="0" x2="0" y2="1">{fadeStops}</linearGradient>
        <linearGradient id={bottomId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset=".1" stopColor="#fff" stopOpacity=".94" />
          <stop offset=".25" stopColor="#fff" stopOpacity=".78" />
          <stop offset=".45" stopColor="#fff" stopOpacity=".5" />
          <stop offset=".65" stopColor="#fff" stopOpacity=".22" />
          <stop offset=".85" stopColor="#fff" stopOpacity=".05" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={IMG_W} height={IMG_H}>
          <rect x="0" y="0" width={IMG_W} height={IMG_H} fill="#fff" />
          <rect x="0" y="0" width={EDGE_FADE_X} height={IMG_H} fill={`url(#${leftId})`} />
          <rect x={IMG_W - EDGE_FADE_X} y="0" width={EDGE_FADE_X} height={IMG_H} fill={`url(#${rightId})`} />
          <rect x="0" y="0" width={IMG_W} height={EDGE_FADE_Y} fill={`url(#${topId})`} />
          <rect x="0" y={IMG_H - EDGE_FADE_Y} width={IMG_W} height={EDGE_FADE_Y} fill={`url(#${bottomId})`} />
        </mask>
      </defs>

      <g transform={`translate(${SCENE_X} ${SCENE_Y}) scale(${SCENE_SCALE})`}>
        {/* Edge strips: the letterbox is literally the scene's outermost
            pixels stretched outward, so no colour step can form. */}
        {[
          { key: 'l', x: -BACKDROP_EXT, y: 0, w: BACKDROP_EXT + EDGE_FADE, h: IMG_H, vb: `0 0 ${EDGE_PX} ${IMG_H}` },
          { key: 'r', x: IMG_W - EDGE_FADE, y: 0, w: BACKDROP_EXT + EDGE_FADE, h: IMG_H, vb: `${IMG_W - EDGE_PX} 0 ${EDGE_PX} ${IMG_H}` },
          { key: 't', x: 0, y: -BACKDROP_EXT, w: IMG_W, h: BACKDROP_EXT + EDGE_FADE, vb: `0 0 ${IMG_W} ${EDGE_PX}` },
          { key: 'b', x: 0, y: IMG_H - EDGE_FADE, w: IMG_W, h: BACKDROP_EXT + EDGE_FADE, vb: `0 ${IMG_H - EDGE_PX} ${IMG_W} ${EDGE_PX}` },
        ].map((pad) => (
          <svg
            key={pad.key}
            x={pad.x}
            y={pad.y}
            width={pad.w}
            height={pad.h}
            viewBox={pad.vb}
            preserveAspectRatio="none"
            overflow="hidden"
          >
            <image href={TREE_SCENE_URL} x="0" y="0" width={IMG_W} height={IMG_H} />
          </svg>
        ))}

        <g mask={`url(#${maskId})`}>
          <image href={TREE_SCENE_URL} x="0" y="0" width={IMG_W} height={IMG_H} />
        </g>
      </g>
    </svg>
  );
}

export default function TreeStage({
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
    // The host is the visual box inside the sim. clientWidth/clientHeight are
    // transform-unaware, so they read the true landscape stage.
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
      const scale = Math.min(w / TR_STAGE_W, h / TR_STAGE_H);
      setFit({
        left: (w - TR_STAGE_W * scale) / 2,
        top: (h - TR_STAGE_H * scale) / 2,
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
      className={active ? 'tr-stage' : 'contents'}
      style={
        active && fit
          ? { left: fit.left, top: fit.top, transform: `scale(${fit.scale})` }
          : undefined
      }
    >
      {active && <TreeBackdrop />}
      <div className={active ? 'tr-stage-content' : 'contents'}>{children}</div>
    </div>
  );
}
