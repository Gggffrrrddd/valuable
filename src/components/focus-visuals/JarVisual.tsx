import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { FocusVisualProps } from './types';

const JAR_SCENE_URL = '/visuals/jar/jar-scene.png';
const FISH_LEFT_URL = '/visuals/jar/fish-left.png';
const FISH_RIGHT_URL = '/visuals/jar/fish-right.png';
const WATER_CALIBRATION_URL = '/visuals/jar/final-jar-water.png';
const CLOUD_RAIN_URL = '/visuals/jar/cloud-rain.png';
const IMG_W = 1672;
const IMG_H = 941;
const OBJECT_POSITION = { x: 0.4, y: 0.15 };
const WATER_IMAGE = { x: -57, y: 378, width: 956, height: 496 };
const WATER_TOP = 461;
const WATER_BASE = 843;
const MASK_ALPHA_THRESHOLD = 24;
const FISH_WALL_PADDING = 12;
const FISH_SURFACE_PADDING = 14;

/** Cloud + rain artwork placement (hardcoded from the live tuner). */
const CLOUD_RAIN = { x: -8, y: 5, scale: 0.6, opacity: 0.57 };

/** Rendered floor-sheen glow under the jar (wid shallow ellipse) — hidden:
 *  over the near-black floor it reads as a faint horizontal "line" that the
 *  original scene image does not have. */
const SHOW_FLOOR_SHEEN = false;

/**
 * Letterbox continuation for the mobile fixed stage (landscape-lock only).
 *
 * A flat/sampled colour can never match the *rendered* stage edge exactly: the
 * scene is composited with the cloud overlay and then resampled by the stage
 * scale, so its on-screen edge pixels differ from the raw PNG's edge pixels by
 * a few levels — which is exactly what reads as a faint vertical/horizontal
 * line in the letterbox.
 *
 * Instead of guessing that colour, each side is continued by stretching the
 * scene's own outermost pixels outward (a nested <svg> whose viewBox is an
 * EDGE_PX-wide strip of the artwork, drawn with preserveAspectRatio="none").
 * The pad is therefore built from the very same image + cloud layers, so the
 * last stage pixel and the first letterbox pixel are the same colour and no
 * seam, line, band or colour step can form.
 *
 * BACKDROP_EXT is in scene px (~490 stage px at the smallest landscape scale),
 * comfortably wider than any letterbox the contain-fit stage can produce.
 */
const BACKDROP_EXT = 3000;
/** Width of the edge strip that is stretched into the letterbox (scene px). */
const EDGE_PX = 2;

/**
 * Edge dissolve of the stage image into the backdrop (mobile fixed stage
 * only), in scene px. Sized in stage-relative units so it scales with the
 * stage and needs no per-device tuning:
 *   4% of the 1366-wide stage  ≈ 67 scene px horizontally
 *   4% of the 768-high stage   ≈ 38 scene px vertically
 * The cloud is composited outside the masked group, so this band cannot
 * dim, clip or cut it.
 */
const EDGE_FADE_X = 67;
const EDGE_FADE_Y = 38;
/** Deepest inward reach of any edge strip (must cover the widest fade). */
const EDGE_FADE = Math.max(EDGE_FADE_X, EDGE_FADE_Y);

/**
 * CSS `linear-gradient(135deg, …)` line for the 1366×768 reference stage,
 * in stage px. Used to reproduce the existing sheen overlay in SVG so it can
 * continue past the stage into the letterbox (the CSS div is clipped to the
 * stage and was the remaining source of a 10/255 edge step).
 */
const SHEEN_X1 = 149.6;
const SHEEN_Y1 = -149.4;
const SHEEN_X2 = 1216.4;
const SHEEN_Y2 = 917.4;

/** Cloud-rain artwork bottom edge in scene coordinates (940 * 0.6 + 5). */
const ARTWORK_BOTTOM = 569;

/** Fade the cloud over the first few scene px at the left edge (mobile
 *  stage only) so its thin wisp is not stretched into the letterbox as a
 *  long horizontal line, and does not end abruptly at the stage edge. */
const CLOUD_LEFT_FADE = 10;
/** The same fade expressed in the cloud image's own (pre-transform) pixels. */
const CLOUD_LOCAL_X = -CLOUD_RAIN.x / CLOUD_RAIN.scale;
const CLOUD_LOCAL_FADE = CLOUD_LEFT_FADE / CLOUD_RAIN.scale;

/** Rain feel — mostly vertical streaks, gentle fall, minimal sway. */
const RAIN = {
  density: 260,
  speed: 0.85,
  length: 1.25,
  opacity: 0.9,
  wind: 0.18,
};

/** Cloud underside per rain lane (scene y of the lowest cloud pixel), sampled
 *  from cloud-rain.png. Rain now starts at the cloud bottom and only inside
 *  the cloud footprint, instead of falling from empty sky. */
const CLOUD_UNDERSIDES = [
  227, 247, 256, 263, 264, 263, 271, 278, 283, 282, 282, 281, 276, 274, 277, 265,
  267, 262, 261, 273, 283, 284, 274, 267, 268, 258, 259, 258, 216, 203, 187, 163,
];
const CLOUD_RAIN_X0 = CLOUD_RAIN.x;
const CLOUD_RAIN_X1 = CLOUD_RAIN.x + 1672 * CLOUD_RAIN.scale;

const RAIN_OFFSET = { x: 40, y: -323 };
const FLOOR_Y = 884;
const JAR_EXTENT_FALLBACK = { left: -57, right: 899 };
/** Even horizontal lanes so drops never clump into one side or column. */
const RAIN_LANES = 32;

const FISH = [
  { x: 370, y: 760, side: 'left', width: 72, hue: 5, speed: .92, bob: 4.2, delay: -.7 },
  { x: 465, y: 718, side: 'right', width: 62, hue: 165, speed: 1.08, bob: 4.8, delay: -2.1 },
  { x: 405, y: 665, side: 'left', width: 66, hue: -18, speed: 1, bob: 3.9, delay: -1.4 },
  { x: 475, y: 610, side: 'right', width: 56, hue: 44, speed: 1.16, bob: 4.5, delay: -3.2 },
  { x: 370, y: 548, side: 'left', width: 58, hue: 210, speed: .86, bob: 3.7, delay: -2.6 },
] as const;

type FishConfig = (typeof FISH)[number];
type MaskRow = { left: number; right: number } | null;
type FishMotion = { x: number; y: number; duration: number; facing: -1 | 1; tilt: number };
type FallingRain = { id: number; x: number; y: number; fall: number; duration: number; length: number; width: number; drift: number; kind: 'jar' | 'floor'; landX: number; landY: number };
type JarSplash = { id: number; x: number; y: number; duration: number; scale: number };

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function getMaskBounds(maskRows: MaskRow[], y: number, halfHeight: number) {
  const sampleYs = [y - halfHeight - FISH_WALL_PADDING, y, y + halfHeight + FISH_WALL_PADDING];
  const rows = sampleYs
    .map((sampleY) => maskRows[Math.round(sampleY - WATER_IMAGE.y)])
    .filter((row): row is Exclude<MaskRow, null> => Boolean(row));
  if (rows.length !== sampleYs.length) return null;
  return {
    left: Math.max(...rows.map((row) => row.left)),
    right: Math.min(...rows.map((row) => row.right)),
  };
}

function pickFishTarget(fish: FishConfig, maskRows: MaskRow[], waterY: number, current: FishMotion, dart = false) {
  const height = fish.width * (391 / 638);
  const halfWidth = fish.width / 2;
  const halfHeight = height / 2;
  const minY = waterY + halfHeight + FISH_SURFACE_PADDING + 5;
  const maxY = WATER_BASE - halfHeight - FISH_WALL_PADDING;

  for (let attempt = 0; attempt < 40 && minY <= maxY; attempt += 1) {
    const randomY = dart
      ? Math.max(minY, Math.min(maxY, current.y + randomBetween(-12, 5)))
      : randomBetween(minY, maxY);
    const bounds = getMaskBounds(maskRows, randomY, halfHeight);
    if (!bounds) continue;
    const minX = bounds.left + halfWidth + FISH_WALL_PADDING;
    const maxX = bounds.right - halfWidth - FISH_WALL_PADDING;
    if (minX >= maxX) continue;

    const targetX = dart
      ? Math.max(minX, Math.min(maxX, current.x + (Math.random() < .5 ? -1 : 1) * randomBetween(38, 72)))
      : randomBetween(minX, maxX);
    const dx = targetX - current.x;
    return {
      x: targetX,
      y: randomY,
      facing: (Math.abs(dx) < 2 ? current.facing : dx < 0 ? -1 : 1) as -1 | 1,
      tilt: Math.max(-5, Math.min(5, (randomY - current.y) * .14)),
    };
  }

  return { x: current.x, y: current.y, facing: current.facing, tilt: 0 };
}

function SwimmingFish({ fish, maskRows, waterY, reducedMotion }: { fish: FishConfig; maskRows: MaskRow[]; waterY: number; reducedMotion: boolean }) {
  const height = fish.width * (391 / 638);
  const visible = waterY <= fish.y - height / 2 - FISH_SURFACE_PADDING;
  const initialFacing = (fish.side === 'left' ? -1 : 1) as -1 | 1;
  const [motion, setMotion] = useState<FishMotion>({ x: fish.x, y: fish.y, duration: 0, facing: initialFacing, tilt: 0 });
  const motionRef = useRef<FishMotion>({ x: fish.x, y: fish.y, duration: 0, facing: initialFacing, tilt: 0 });
  const waterYRef = useRef(waterY);
  waterYRef.current = waterY;

  useEffect(() => {
    if (reducedMotion) {
      const staticMotion: FishMotion = { x: fish.x, y: fish.y, duration: 0, facing: initialFacing, tilt: 0 };
      motionRef.current = staticMotion;
      setMotion(staticMotion);
      return;
    }
    if (!visible || maskRows.length === 0) return;

    let cancelled = false;
    let moveTimer: ReturnType<typeof setTimeout>;
    let dartTimer: ReturnType<typeof setTimeout>;

    const move = (dart = false) => {
      if (cancelled) return;
      const current = motionRef.current;
      const target = pickFishTarget(fish, maskRows, waterYRef.current, current, dart);
      const distance = Math.hypot(target.x - current.x, target.y - current.y);
      const duration = dart
        ? randomBetween(.55, .85)
        : Math.max(2.8, Math.min(7.2, distance / (20 * fish.speed)));
      const nextMotion = { ...target, duration };
      motionRef.current = nextMotion;
      setMotion(nextMotion);
      moveTimer = setTimeout(() => move(false), duration * 1000 + (dart ? 180 : randomBetween(250, 900)));
    };

    const scheduleDart = () => {
      dartTimer = setTimeout(() => {
        clearTimeout(moveTimer);
        move(true);
        scheduleDart();
      }, randomBetween(20000, 40000));
    };

    moveTimer = setTimeout(() => move(false), randomBetween(250, 1100));
    scheduleDart();
    return () => {
      cancelled = true;
      clearTimeout(moveTimer);
      clearTimeout(dartTimer);
    };
  }, [fish, initialFacing, maskRows, reducedMotion, visible]);

  const imageFacesRight = fish.side === 'right';
  const flip = (motion.facing === 1) === imageFacesRight ? 1 : -1;

  return (
    <g
      opacity={visible ? 1 : 0}
      style={{ transform: `translate(${motion.x}px, ${motion.y}px)`, transition: reducedMotion ? 'opacity 1.25s ease-out' : `transform ${motion.duration}s cubic-bezier(.35,.05,.3,1), opacity 1.25s ease-out` }}
    >
      <g style={{ transformBox: 'fill-box', transformOrigin: 'center', transform: `rotate(${motion.tilt}deg) scaleX(${flip})`, transition: reducedMotion ? undefined : 'transform .28s ease-out' }}>
        <g style={{ animation: reducedMotion ? undefined : `jar-fish-bob ${fish.bob}s ease-in-out ${fish.delay}s infinite alternate` }}>
          <image href={fish.side === 'left' ? FISH_LEFT_URL : FISH_RIGHT_URL} x={-fish.width / 2} y={-height / 2} width={fish.width} height={height} style={{ filter: `hue-rotate(${fish.hue}deg) saturate(1.15) brightness(1.08)` }} />
        </g>
      </g>
    </g>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

const keyframes = `
  @keyframes jar-ripple { to { stroke-dashoffset: -48; } }
  @keyframes jar-current { from { transform: translateX(-28px); opacity: .08; } to { transform: translateX(32px); opacity: .2; } }
  @keyframes jar-fish-bob { from { transform: translateY(-4px); } to { transform: translateY(4px); } }
  @keyframes jar-rain-fall {
    0% { transform: translate(var(--x), var(--y)); opacity: 0; }
    10% { opacity: .6; }
    22% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translate(calc(var(--x) + var(--wind)), calc(var(--y) + var(--fall))); opacity: 0; }
  }
  @keyframes jar-splash {
    0% { transform: scale(.3); opacity: 0; }
    22% { transform: scale(1); opacity: .6; }
    100% { transform: scale(1.9); opacity: 0; }
  }
  @keyframes jar-floor-sheen {
    0%, 100% { opacity: .05; }
    50% { opacity: .1; }
  }
`;

export default function JarVisual({ progress, running = false }: FocusVisualProps) {
  const value = Math.max(0, Math.min(1, progress));
  const complete = value >= 1;
  const reducedMotion = useReducedMotion();
  const svgId = useId().replace(/:/g, '');
  const waterMaskId = `jar-water-alpha-mask-${svgId}`;
  const waterGradientId = `jar-water-depth-${svgId}`;
  const rainGradientId = `jar-rain-${svgId}`;
  const floorGradientId = `jar-floor-${svgId}`;
  const edgeFadeLId = `jar-efl-${svgId}`;
  const edgeFadeRId = `jar-efr-${svgId}`;
  const edgeFadeTId = `jar-eft-${svgId}`;
  const edgeFadeBId = `jar-efb-${svgId}`;
  const edgeFadeMaskId = `jar-efm-${svgId}`;
  const cloudEdgeMaskId = `jar-cloud-edge-${svgId}`;
  const cloudLeftFadeId = `jar-cloud-left-${svgId}`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: IMG_W, height: IMG_H });
  /** True while rendering inside the fixed mobile stage (.jr-stage). Gates
   *  the sampled backdrop + edge dissolve so the desktop/portrait paths stay
   *  pixel-identical to before. */
  const [staged, setStaged] = useState(false);
  const sheenGradientId = `jar-sheen-${svgId}`;
  const [maskRows, setMaskRows] = useState<MaskRow[]>([]);
  const [rains, setRains] = useState<FallingRain[]>([]);
  const [jarSplashes, setJarSplashes] = useState<JarSplash[]>([]);
  const nextRainId = useRef(0);
  const waterY = WATER_BASE - value * (WATER_BASE - WATER_TOP);
  const waterYRef = useRef(waterY);
  waterYRef.current = waterY;
  const jarExtentRef = useRef(JAR_EXTENT_FALLBACK);
  const rainLaneCursor = useRef(0);

  // Viewport source (compact): the `.mob-sim` STAGE itself — always a
  // definite, transform-independent box, immune to inner wrapper CSS
  // states (stale/mixed stylesheets, display:contents feed, flex quirks).
  // Desktop keeps the feed-first chain (feed box, else this container).
  const measureSrcRef = useRef('init');
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      let w = 0;
      let h = 0;
      let src = 'self';
      // Inside the fixed <JarStage> the composition must measure the stage
      // box itself (transform-unaware layout px, e.g. 1366×768), never the
      // sim screen — the stage scale is applied outside the SVG.
      const jarStage = element.closest('.jr-stage') as HTMLElement | null;
      setStaged(Boolean(jarStage));
      if (jarStage) {
        const jw = element.offsetWidth;
        const jh = element.offsetHeight;
        if (jw > 0 && jh > 0) {
          w = jw;
          h = jh;
          src = 'jar-stage';
        }
      }
      const compactNow =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(max-width: 1023.5px)').matches;
      if (src === 'self' && compactNow) {
        const stage = element.closest('.mob-sim') as HTMLElement | null;
        if (stage) {
          const sw = stage.offsetWidth;
          const sh = stage.offsetHeight;
          if (sw > 0 && sh > 0) {
            w = sw;
            h = sh;
            src = 'stage';
          }
        }
      }
      if (src === 'self') {
        const feed = element.parentElement;
        if (feed) {
          const fw = feed.offsetWidth;
          const fh = feed.offsetHeight;
          if (fw > 0 && fh > 0) {
            w = fw;
            h = fh;
            src = 'feed';
          }
        }
      }
      if (src === 'self') {
        w = element.offsetWidth;
        h = element.offsetHeight;
      }
      // Gate: never apply a collapsed/0×0/stale box to the scene — keep the
      // previous (sane aspect-correct) viewport until a real size lands.
      if (w < 1 || h < 1) return;
      measureSrcRef.current = src;
      setViewport((prev) =>
        Math.abs(prev.width - w) < 0.5 && Math.abs(prev.height - h) < 0.5 ? prev : { width: w, height: h },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Dense, constant rainfall while the session runs: several drops per tick, so
  // the sky is always full of streaks rather than a single visible line.
  useEffect(() => {
    if (reducedMotion || !running) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const emitOne = () => {
      const extent = jarExtentRef.current;
      // Walk only the cloud footprint, one lane at a time, so every drop
      // starts under an actual cloud instead of in empty sky.
      const laneWidth = (CLOUD_RAIN_X1 - CLOUD_RAIN_X0) / RAIN_LANES;
      const lane = rainLaneCursor.current % RAIN_LANES;
      rainLaneCursor.current += 1;
      const x = CLOUD_RAIN_X0 + laneWidth * lane + randomBetween(laneWidth * 0.18, laneWidth * 0.82);
      const toJar = x >= extent.left && x <= extent.right;
      // Visual start = drop.y + RAIN_OFFSET.y, so this lands exactly on the
      // cloud's underside for that lane.
      const y = CLOUD_UNDERSIDES[lane] - RAIN_OFFSET.y + randomBetween(2, 8);
      const landY = toJar ? waterYRef.current : FLOOR_Y;
      // Account for the group offset so the drop's final position lands exactly
      // on the floor / water surface: final = y + RAIN_OFFSET.y + fall.
      const fall = Math.max(60, landY - (y + RAIN_OFFSET.y));
      const heavy = Math.random() < 0.34;
      const id = nextRainId.current;
      nextRainId.current += 1;
      return {
        id,
        x,
        y,
        fall,
        duration: randomBetween(2.2, 3.2) / RAIN.speed,
        length: (heavy ? randomBetween(26, 42) : randomBetween(14, 26)) * RAIN.length,
        width: (heavy ? randomBetween(1.6, 2.2) : randomBetween(0.9, 1.4)) * RAIN.length,
        drift: randomBetween(-5, 5) * RAIN.wind,
        kind: (toJar ? 'jar' : 'floor') as 'jar' | 'floor',
        landX: x,
        landY,
      };
    };

    const emitBurst = () => {
      const count = 3 + Math.floor(Math.random() * 4);
      setRains((current) => [...current.slice(-RAIN.density), ...Array.from({ length: count }, emitOne)]);
    };

    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(() => {
        emitBurst();
        schedule();
      }, randomBetween(40, 90));
    };
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reducedMotion, running]);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.src = WATER_CALIBRATION_URL;
    image.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement('canvas');
      canvas.width = WATER_IMAGE.width;
      canvas.height = WATER_IMAGE.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const rows: MaskRow[] = [];

      for (let y = 0; y < canvas.height; y += 1) {
        let left = -1;
        let right = -1;
        for (let x = 0; x < canvas.width; x += 1) {
          if (pixels[(y * canvas.width + x) * 4 + 3] <= MASK_ALPHA_THRESHOLD) continue;
          if (left === -1) left = x;
          right = x;
        }
        rows.push(left === -1 ? null : { left: WATER_IMAGE.x + left, right: WATER_IMAGE.x + right });
      }
      setMaskRows(rows);

      // Widest silhouette row approximates the jar's full horizontal extent.
      let widest: Exclude<MaskRow, null> | null = null;
      let widestSpan = 0;
      for (const row of rows) {
        if (!row) continue;
        const span = row.right - row.left;
        if (span > widestSpan) {
          widestSpan = span;
          widest = row;
        }
      }
      if (widest) jarExtentRef.current = { left: widest.left, right: widest.right };
    };
    return () => {
      cancelled = true;
      image.onload = null;
    };
  }, []);

  const scale = Math.max(viewport.width / IMG_W, viewport.height / IMG_H);
  // The mobile stage (~2.17:1) is wider than the scene (1.777:1), so
  // cover-fit trims vertically. Bottom-anchor the window (y=0.75) so the
  // jar, its base and the floor sheen stay fully on screen — only the
  // upper sky/cloud tops trim. Wide screens (>1023.5px) keep the tuned
  // desktop 0.15 unchanged (their box is taller than wide → no vertical
  // overflow there anyway).
  const compact =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 1023.5px)').matches;
  const objPosY = compact ? 0.75 : OBJECT_POSITION.y;
  const offsetX = (viewport.width - IMG_W * scale) * OBJECT_POSITION.x;
  const offsetY = (viewport.height - IMG_H * scale) * objPosY;
  const sceneTransform = `translate(${offsetX} ${offsetY}) scale(${scale})`;

  // DIAGNOSTIC (temporary): why the jar scene gets cropped — especially the
  // left edge. The scene uses cover-fit: scale = max(w/1672, h/941), then the
  // overflow is split 40% left / 60% right (OBJECT_POSITION.x = 0.4). Whenever
  // the measured container is TALLER than 16:9, the left side is cut by
  // (1672*scale - viewport.width) * 0.4 scene-px. Fires on mount + resize.
  useEffect(() => {
    const scaledW = IMG_W * scale;
    const scaledH = IMG_H * scale;
    const overflowX = Math.max(0, scaledW - viewport.width);
    const overflowY = Math.max(0, scaledH - viewport.height);
    const feed = containerRef.current?.parentElement ?? null;
    const feedStyle = feed ? getComputedStyle(feed) : null;
    console.log(
      '[jar-crop] src=%s viewport=%dx%d (aspect %s) scale=%s scene=%dx%d overflowX=%s overflowY=%s ' +
        'cropL=%s cropR=%s cropT=%s cropB=%s (scene px) objPos=%s/%s',
      measureSrcRef.current,
      Math.round(viewport.width),
      Math.round(viewport.height),
      (viewport.width / Math.max(1, viewport.height)).toFixed(3),
      scale.toFixed(4),
      Math.round(scaledW),
      Math.round(scaledH),
      overflowX.toFixed(1),
      overflowY.toFixed(1),
      (overflowX * OBJECT_POSITION.x).toFixed(1),
      (overflowX * (1 - OBJECT_POSITION.x)).toFixed(1),
      (overflowY * objPosY).toFixed(1),
      (overflowY * (1 - objPosY)).toFixed(1),
      OBJECT_POSITION.x,
      OBJECT_POSITION.y,
    );
    console.log(
      '[jar-crop] feed=<%s class="%s"> %dx%d display=%s | coarse=%s orient=%s win=%dx%d dpr=%s',
      feed?.tagName ?? '?',
      feed?.className ?? '?',
      feed?.clientWidth ?? -1,
      feed?.clientHeight ?? -1,
      feedStyle?.display ?? '?',
      window.matchMedia('(pointer: coarse)').matches,
      window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait',
      window.innerWidth,
      window.innerHeight,
      window.devicePixelRatio,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport.width, viewport.height]);

  // DIAGNOSTIC (temporary): the inner <image> assumes jar-scene.png is exactly
  // 1672x941. If the real PNG differs, SVG meet-fit letterboxes it inside that
  // box — an extra hidden shift that also reads as a "cut".
  useEffect(() => {
    const probe = new Image();
    probe.src = JAR_SCENE_URL;
    probe.onload = () => {
      console.log(
        '[jar-crop] jar-scene.png natural=%dx%d expected=%dx%d match=%s',
        probe.naturalWidth,
        probe.naturalHeight,
        IMG_W,
        IMG_H,
        probe.naturalWidth === IMG_W && probe.naturalHeight === IMG_H,
      );
    };
  }, []);
  const waterTransition = reducedMotion ? undefined : 'transform 1s linear';

  return (
    <div
      ref={containerRef}
      className={`focus-visual ${complete ? 'visual-complete' : ''}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        maxWidth: 'none',
        maxHeight: 'none',
        overflow: 'hidden',
      }}
      role="img"
      aria-label={`Water jar ${Math.round(value * 100)} percent complete`}
    >
      <style>{keyframes}</style>
      <svg width="100%" height="100%" viewBox={`0 0 ${viewport.width} ${viewport.height}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: staged ? 'visible' : 'hidden' }} aria-hidden="true">
        <defs>
          <mask id={waterMaskId} maskUnits="userSpaceOnUse" x={WATER_IMAGE.x} y={WATER_IMAGE.y} width={WATER_IMAGE.width} height={WATER_IMAGE.height} mask-type="alpha">
            <image href={WATER_CALIBRATION_URL} x={WATER_IMAGE.x} y={WATER_IMAGE.y} width={WATER_IMAGE.width} height={WATER_IMAGE.height} preserveAspectRatio="none" />
          </mask>
          <linearGradient id={waterGradientId} x1="0" y1={WATER_TOP} x2="0" y2={WATER_BASE} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8dc4b8" stopOpacity=".55" />
            <stop offset=".48" stopColor="#6bafa0" stopOpacity=".6" />
            <stop offset=".84" stopColor="#4a9b8e" stopOpacity=".65" />
            <stop offset="1" stopColor="#3c867c" stopOpacity=".55" />
          </linearGradient>
          {/* Soft, translucent rain streak — fades at both tips like the ripples. */}
          <linearGradient id={rainGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eafaff" stopOpacity="0" />
            <stop offset=".15" stopColor="#eafaff" stopOpacity=".5" />
            <stop offset=".5" stopColor="#d9f4ff" stopOpacity=".6" />
            <stop offset=".85" stopColor="#eafaff" stopOpacity=".5" />
            <stop offset="1" stopColor="#eafaff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={floorGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cfe9f6" stopOpacity="0" />
            <stop offset="1" stopColor="#a9d6ee" stopOpacity=".5" />
          </linearGradient>

          {/* ---- Stage-image edge dissolve (smoothstep-eased alpha) ---- */}
          <linearGradient id={edgeFadeLId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".15" stopColor="#fff" stopOpacity=".05" />
            <stop offset=".35" stopColor="#fff" stopOpacity=".22" />
            <stop offset=".55" stopColor="#fff" stopOpacity=".5" />
            <stop offset=".75" stopColor="#fff" stopOpacity=".78" />
            <stop offset=".9" stopColor="#fff" stopOpacity=".94" />
            <stop offset="1" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <linearGradient id={edgeFadeRId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset=".1" stopColor="#fff" stopOpacity=".94" />
            <stop offset=".25" stopColor="#fff" stopOpacity=".78" />
            <stop offset=".45" stopColor="#fff" stopOpacity=".5" />
            <stop offset=".65" stopColor="#fff" stopOpacity=".22" />
            <stop offset=".85" stopColor="#fff" stopOpacity=".05" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={edgeFadeTId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".15" stopColor="#fff" stopOpacity=".05" />
            <stop offset=".35" stopColor="#fff" stopOpacity=".22" />
            <stop offset=".55" stopColor="#fff" stopOpacity=".5" />
            <stop offset=".75" stopColor="#fff" stopOpacity=".78" />
            <stop offset=".9" stopColor="#fff" stopOpacity=".94" />
            <stop offset="1" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <linearGradient id={edgeFadeBId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset=".1" stopColor="#fff" stopOpacity=".94" />
            <stop offset=".25" stopColor="#fff" stopOpacity=".78" />
            <stop offset=".45" stopColor="#fff" stopOpacity=".5" />
            <stop offset=".65" stopColor="#fff" stopOpacity=".22" />
            <stop offset=".85" stopColor="#fff" stopOpacity=".05" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id={edgeFadeMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width={IMG_W} height={IMG_H}>
            <rect x="0" y="0" width={IMG_W} height={IMG_H} fill="#fff" />
            <rect x="0" y="0" width={EDGE_FADE_X} height={IMG_H} fill={`url(#${edgeFadeLId})`} />
            <rect x={IMG_W - EDGE_FADE_X} y="0" width={EDGE_FADE_X} height={IMG_H} fill={`url(#${edgeFadeRId})`} />
            <rect x="0" y="0" width={IMG_W} height={EDGE_FADE_Y} fill={`url(#${edgeFadeTId})`} />
            <rect x="0" y={IMG_H - EDGE_FADE_Y} width={IMG_W} height={EDGE_FADE_Y} fill={`url(#${edgeFadeBId})`} />
          </mask>

          {/* Stage-relative sheen (same gradient as the CSS overlay) in user
              space, so it can be drawn across the whole screen and continue
              the stage edge into the letterbox with no colour step. */}
          <linearGradient id={sheenGradientId} gradientUnits="userSpaceOnUse" x1={SHEEN_X1} y1={SHEEN_Y1} x2={SHEEN_X2} y2={SHEEN_Y2}>
            <stop offset="0" stopColor="#fff" stopOpacity=".06" />
            <stop offset=".3" stopColor="#fff" stopOpacity="0" />
            <stop offset=".7" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" stopOpacity=".03" />
          </linearGradient>

          {/* Cloud edge: clip it to the scene rectangle and ease its leftmost
              wisp out, so nothing paints outside the stage at the top-left. */}
          <linearGradient id={cloudLeftFadeId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask id={cloudEdgeMaskId} maskUnits="userSpaceOnUse" x={CLOUD_LOCAL_X} y="0" width={IMG_W - CLOUD_LOCAL_X} height="940">
            <rect x={CLOUD_LOCAL_X} y="0" width={IMG_W - CLOUD_LOCAL_X} height="940" fill="#fff" />
            <rect x={CLOUD_LOCAL_X} y="0" width={CLOUD_LOCAL_FADE} height="940" fill={`url(#${cloudLeftFadeId})`} />
          </mask>
        </defs>

        <g transform={sceneTransform}>
          {/* Letterbox continuation (mobile fixed stage only). Each side is a
              nested <svg> whose viewBox is an EDGE_PX-wide strip of the
              artwork, stretched with preserveAspectRatio="none": the letterbox
              is literally made of the stage edge's own pixels, so no colour
              step can form where the two meet. Each strip also reaches EDGE_FADE
              inward, so the scene's edge-dissolve fades into the very same edge
              colour instead of into the session background. */}
          {staged && (
            <g>
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
                  <image href={JAR_SCENE_URL} x="0" y="0" width={IMG_W} height={IMG_H} />
                </svg>
              ))}
            </g>
          )}

          <g mask={staged ? `url(#${edgeFadeMaskId})` : undefined}>
            <image href={JAR_SCENE_URL} x="0" y="0" width={IMG_W} height={IMG_H} />
          </g>

          {/* Cloud + rain artwork — outside the edge mask so the top fade can
              never dim or cut the cloud. On the mobile stage it is clipped to
              the scene and its left wisp is eased out before the stage edge. */}
          <g transform={`translate(${CLOUD_RAIN.x} ${CLOUD_RAIN.y}) scale(${CLOUD_RAIN.scale})`} opacity={CLOUD_RAIN.opacity}>
            <image
              href={CLOUD_RAIN_URL}
              x="0"
              y="0"
              width={IMG_W}
              height={940}
              preserveAspectRatio="none"
              mask={staged ? `url(#${cloudEdgeMaskId})` : undefined}
            />
          </g>

          {/* Dense animated rainfall beneath the artwork, offset hardcoded. */}
          <g transform={`translate(${RAIN_OFFSET.x} ${RAIN_OFFSET.y})`}>
            {rains.map((drop) => (
              <g
                key={drop.id}
                style={{
                  '--x': `${drop.x}px`,
                  '--y': `${drop.y}px`,
                  '--fall': `${drop.fall}px`,
                  '--wind': `${drop.drift}px`,
                  animation: `jar-rain-fall ${drop.duration}s linear forwards`,
                } as CSSProperties}
                onAnimationEnd={() => {
                  setRains((current) => current.filter((r) => r.id !== drop.id));
                  if (drop.kind !== 'jar') return;
                  const splashId = nextRainId.current;
                  nextRainId.current += 1;
                  const splashX = drop.landX + RAIN_OFFSET.x;
                  setJarSplashes((current) => [...current.slice(-34), { id: splashId, x: splashX, y: drop.landY, duration: randomBetween(.5, .72), scale: randomBetween(.8, 1.5) }]);
                }}
              >
                <g>
                  {/* Geometric drop: sharp point at the top, wide rounded base
                      that tapers smoothly — exact bubble palette. */}
                  <path
                    d={
                      drop.length > drop.width
                        ? `M 0 0 C ${drop.width * 0.1} ${drop.length * 0.32} ${drop.width / 2} ${drop.length * 0.52} ${drop.width / 2} ${drop.length - drop.width / 2} A ${drop.width / 2} ${drop.width / 2} 0 0 1 ${-drop.width / 2} ${drop.length - drop.width / 2} C ${-drop.width / 2} ${drop.length * 0.52} ${-drop.width * 0.1} ${drop.length * 0.32} 0 0 Z`
                        : `M 0 0 C ${drop.width * 0.4} ${drop.length * 0.4} ${drop.width / 2} ${drop.length * 0.6} 0 ${drop.length} C ${-drop.width / 2} ${drop.length * 0.6} ${-drop.width * 0.4} ${drop.length * 0.4} 0 0 Z`
                    }
                    fill={`url(#${rainGradientId})`}
                    opacity=".42"
                  />
                  <ellipse
                    cx={-drop.width * 0.12}
                    cy={drop.length * 0.62}
                    rx={Math.max(0.3, drop.width * 0.16)}
                    ry={Math.max(1.2, drop.length * 0.09)}
                    fill="#eafaff"
                    opacity=".35"
                  />
                </g>
              </g>
            ))}
          </g>

          {/* Splashes where drops meet the jar's surface. */}
          <g mask={`url(#${waterMaskId})`}>
            {jarSplashes.map((splash) => (
              <g key={splash.id} style={{ transform: `translate(${splash.x}px, ${splash.y}px)` }}>
                <g
                  style={{ animation: `jar-splash ${splash.duration}s ease-out forwards`, transformOrigin: 'center', transformBox: 'fill-box', scale: splash.scale }}
                  onAnimationEnd={() => setJarSplashes((current) => current.filter((s) => s.id !== splash.id))}
                >
                  <ellipse cx="0" cy="0" rx="9" ry="3" fill="none" stroke="#d9f4ff" strokeWidth="1.3" opacity=".7" />
                  <ellipse cx="0" cy="0" rx="4" ry="1.6" fill="#eafaff" opacity=".5" />
                </g>
              </g>
            ))}
          </g>

          {/* Calibrated silhouette: only the reveal rect's top edge rises. */}
          <g mask={`url(#${waterMaskId})`}>
            <rect x={WATER_IMAGE.x} y={waterY} width={WATER_IMAGE.width} height={WATER_BASE - waterY} fill={`url(#${waterGradientId})`} style={{ transition: reducedMotion ? undefined : 'y 1s linear, height 1s linear' }} />
          </g>

          <g mask={`url(#${waterMaskId})`}>
            <g style={{ transform: `translateY(${waterY}px)`, transition: waterTransition }}>
              <g opacity=".12" style={{ animation: reducedMotion ? undefined : 'jar-current 11s ease-in-out infinite alternate' }}>
                <path d="M300 70 C370 46 460 94 550 55" fill="none" stroke="#c6eee5" strokeWidth="9" strokeLinecap="round" />
                <path d="M300 145 C385 116 465 168 550 130" fill="none" stroke="#b6e7dc" strokeWidth="6" strokeLinecap="round" />
              </g>
              <path d="M-57 1 Q-45 -2 -33 1 T-9 1 T15 1 T39 1 T63 1 T87 1 T111 1 T135 1 T159 1 T183 1 T207 1 T231 1 T255 1 T279 1 T303 1 T327 1 T351 1 T375 1 T399 1 T423 1 T447 1 T471 1 T495 1 T519 1 T543 1 T567 1 T591 1 T615 1 T639 1 T663 1 T687 1 T711 1 T735 1 T759 1 T783 1 T807 1 T831 1 T855 1 T879 1 T903 1" fill="none" stroke="rgba(220,249,242,.78)" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M-57 4 Q-45 -1 -33 4 T-9 4 T15 4 T39 4 T63 4 T87 4 T111 4 T135 4 T159 4 T183 4 T207 4 T231 4 T255 4 T279 4 T303 4 T327 4 T351 4 T375 4 T399 4 T423 4 T447 4 T471 4 T495 4 T519 4 T543 4 T567 4 T591 4 T615 4 T639 4 T663 4 T687 4 T711 4 T735 4 T759 4 T783 4 T807 4 T831 4 T855 4 T879 4 T903 4" fill="none" stroke="rgba(157,215,202,.64)" strokeWidth="2" strokeDasharray="18 6" style={{ animation: reducedMotion ? undefined : 'jar-ripple 3.4s linear infinite' }} />
            </g>
          </g>

          <g mask={`url(#${waterMaskId})`}>
            {FISH.map((fish) => <SwimmingFish key={`${fish.side}-${fish.y}`} fish={fish} maskRows={maskRows} waterY={waterY} reducedMotion={reducedMotion} />)}
          </g>

          {/* Floor sheen glow under the jar (no ground ripples). */}
          {SHOW_FLOOR_SHEEN && (
            <g>
              <ellipse cx={(jarExtentRef.current.left + jarExtentRef.current.right) / 2} cy={FLOOR_Y} rx={520} ry={44} fill={`url(#${floorGradientId})`} style={{ animation: reducedMotion ? undefined : 'jar-floor-sheen 9s ease-in-out infinite' }} />
            </g>
          )}
        </g>

        {/* Mobile stage: the sheen must cover the letterbox as well, otherwise
            its clipped edge is a visible 10/255 step where the stage meets
            the backdrop. Same gradient recipe, in stage coordinates. */}
        {staged && (
          <rect
            x={-BACKDROP_EXT}
            y={-BACKDROP_EXT}
            width={IMG_W + BACKDROP_EXT * 2}
            height={IMG_H + BACKDROP_EXT * 2}
            fill={`url(#${sheenGradientId})`}
            pointerEvents="none"
          />
        )}
      </svg>

      {!staged && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,.06), transparent 30%, transparent 70%, rgba(255,255,255,.03))', pointerEvents: 'none' }} aria-hidden="true" />
      )}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '60%', height: '20%', borderRadius: '50%', background: 'rgba(197,255,84,.12)', filter: 'blur(24px)', opacity: complete ? .28 : .05, pointerEvents: 'none' }} aria-hidden="true" />
    </div>
  );
}
