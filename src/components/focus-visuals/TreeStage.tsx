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
 * Outside the stage, the scene's edges fade directly into a backdrop whose
 * colour is sampled from the image's own edge pixels (average ≈ rgb(3,2,2)),
 * so the letterbox is a smooth continuation of the scene rather than a flat
 * fill or a stretched-pixel smear.
 */
export const TR_STAGE_W = 1366;
export const TR_STAGE_H = 768;
/** Mirrors the media query that applies the rotated `.mob-sim` landscape stage. */
export const TR_LOCKED_MEDIA = '(pointer: coarse) and (max-width: 1023.5px)';

const TREE_SCENE_URL = '/visuals/tree/tree-scene.png';
const IMG_W = 1672;
const IMG_H = 941;

/** How far the backdrop reaches past the stage (scene px). */
const BACKDROP_EXT = 3000;
/**
 * Backdrop base colour sampled from the tree-scene edge pixels (average of
 * all four edges ≈ rgb(3,2,2)). The stage image fades into this, while the
 * edge strips below continue the real scene pixels — including the soil —
 * into the letterbox so the ground reads as a continuation, not a flat fill.
 */
const BACKDROP_COLOR = '#030202';
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
/** Below this line the left edge is soil/ground, so a mirror there reads as a
 *  real continuation; above it the same mirror would duplicate tree canopy. */
const SOIL_TOP = Math.round(IMG_H * 0.58);
/** Feather the mirror's top so it blends into the sky instead of a hard line. */
const MIRROR_FEATHER = 70;

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

/** Edge-faded backdrop for the staged tree scene. */
function TreeBackdrop() {
  const id = useId().replace(/:/g, '');
  const maskId = `tr-edge-mask-${id}`;
  const leftId = `tr-edge-l-${id}`;
  const rightId = `tr-edge-r-${id}`;
  const topId = `tr-edge-t-${id}`;
  const bottomId = `tr-edge-b-${id}`;
  const leftPatId = `tr-pat-l-${id}`;
  const leftMirrorClipId = `tr-mirror-l-${id}`;
  const soilFadeId = `tr-soil-fade-${id}`;
  const soilMaskId = `tr-soil-mask-${id}`;

  const fadeStops = (
    <>
      <stop offset="0" stopColor="#000" stopOpacity="1" />
      <stop offset=".15" stopColor="#000" stopOpacity=".95" />
      <stop offset=".35" stopColor="#000" stopOpacity=".78" />
      <stop offset=".55" stopColor="#000" stopOpacity=".5" />
      <stop offset=".75" stopColor="#000" stopOpacity=".22" />
      <stop offset=".9" stopColor="#000" stopOpacity=".06" />
      <stop offset="1" stopColor="#000" stopOpacity="0" />
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
        {/* Luminance mask: white base + black gradients. The black rect is
            opaque at the scene edge and transparent inward, so the stage
            image's alpha actually reaches 0 at the edge (a white-on-white
            overlay would leave the mask fully opaque and show a hard line). */}
        <linearGradient id={leftId} x1="0" y1="0" x2="1" y2="0">{fadeStops}</linearGradient>
        <linearGradient id={rightId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset=".1" stopColor="#000" stopOpacity=".06" />
          <stop offset=".25" stopColor="#000" stopOpacity=".22" />
          <stop offset=".45" stopColor="#000" stopOpacity=".5" />
          <stop offset=".65" stopColor="#000" stopOpacity=".78" />
          <stop offset=".85" stopColor="#000" stopOpacity=".95" />
          <stop offset="1" stopColor="#000" stopOpacity="1" />
        </linearGradient>
        <linearGradient id={topId} x1="0" y1="0" x2="0" y2="1">{fadeStops}</linearGradient>
        <linearGradient id={bottomId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset=".1" stopColor="#000" stopOpacity=".06" />
          <stop offset=".25" stopColor="#000" stopOpacity=".22" />
          <stop offset=".45" stopColor="#000" stopOpacity=".5" />
          <stop offset=".65" stopColor="#000" stopOpacity=".78" />
          <stop offset=".85" stopColor="#000" stopOpacity=".95" />
          <stop offset="1" stopColor="#000" stopOpacity="1" />
        </linearGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={IMG_W} height={IMG_H}>
          <rect x="0" y="0" width={IMG_W} height={IMG_H} fill="#fff" />
          <rect x="0" y="0" width={EDGE_FADE_X} height={IMG_H} fill={`url(#${leftId})`} />
          <rect x={IMG_W - EDGE_FADE_X} y="0" width={EDGE_FADE_X} height={IMG_H} fill={`url(#${rightId})`} />
          <rect x="0" y="0" width={IMG_W} height={EDGE_FADE_Y} fill={`url(#${topId})`} />
          <rect x="0" y={IMG_H - EDGE_FADE_Y} width={IMG_W} height={EDGE_FADE_Y} fill={`url(#${bottomId})`} />
        </mask>

        {/* 1-scene-px edge pattern: the left letterbox's soil band is the
            scene's actual edge column repeated outward, so the ground texture
            continues and the stage edge never steps in colour. */}
        <pattern id={leftPatId} patternUnits="userSpaceOnUse" x="0" y="0" width="1" height={IMG_H}>
          <image href={TREE_SCENE_URL} x="0" y="0" width={IMG_W} height={IMG_H} />
        </pattern>

        {/* Left letterbox: mirror the soil band only, so the ground texture
            continues outward without duplicating the canopy above it. */}
        <clipPath id={leftMirrorClipId}>
          <rect x={-BACKDROP_EXT} y={SOIL_TOP} width={BACKDROP_EXT} height={IMG_H - SOIL_TOP} />
        </clipPath>

        <linearGradient id={soilFadeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id={soilMaskId} maskUnits="userSpaceOnUse" x={-BACKDROP_EXT} y={SOIL_TOP} width={BACKDROP_EXT + EDGE_FADE} height={IMG_H - SOIL_TOP}>
          <rect x={-BACKDROP_EXT} y={SOIL_TOP} width={BACKDROP_EXT + EDGE_FADE} height={MIRROR_FEATHER} fill={`url(#${soilFadeId})`} />
          <rect x={-BACKDROP_EXT} y={SOIL_TOP + MIRROR_FEATHER} width={BACKDROP_EXT + EDGE_FADE} height={IMG_H - SOIL_TOP - MIRROR_FEATHER} fill="#fff" />
        </mask>


      </defs>

      <g transform={`translate(${SCENE_X} ${SCENE_Y}) scale(${SCENE_SCALE})`}>
        {/* Backdrop base fills the whole stage + letterbox with the sampled
            edge colour; the strips then continue the scene's real edge pixels
            (soil texture at the bottom-left) outward, and the image fades
            into them at the edges. */}
        <rect
          x={-BACKDROP_EXT}
          y={-BACKDROP_EXT}
          width={IMG_W + BACKDROP_EXT * 2}
          height={IMG_H + BACKDROP_EXT * 2}
          fill={BACKDROP_COLOR}
        />

        {/* Edge continuation: only the left soil band continues outward via
            its mirrored real texture; the remaining edges dissolve straight
            into the sampled backdrop, so cut leaves at the top never streak. */}
        <rect x={-BACKDROP_EXT} y={SOIL_TOP} width={BACKDROP_EXT + EDGE_FADE} height={IMG_H - SOIL_TOP} fill={`url(#${leftPatId})`} mask={`url(#${soilMaskId})`} />

        {/* Left soil band: real ground texture instead of a single column. */}
        <g clipPath={`url(#${leftMirrorClipId})`} mask={`url(#${soilMaskId})`}>
          <g transform="scale(-1 1)">
            <image href={TREE_SCENE_URL} x="0" y="0" width={IMG_W} height={IMG_H} />
          </g>
        </g>

        {/* Bottom letterbox uses only the image's direct fade into the
            backdrop; no extra strip. */}
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
