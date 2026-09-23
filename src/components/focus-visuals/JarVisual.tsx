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

/** Cloud-rain artwork bottom edge in scene coordinates (940 * 0.6 + 5). */
const ARTWORK_BOTTOM = 569;

/** Rain feel — mostly vertical streaks, gentle fall, minimal sway. */
const RAIN = {
  density: 260,
  speed: 0.85,
  length: 1.25,
  opacity: 0.9,
  wind: 0.18,
  sourceY: ARTWORK_BOTTOM + 6,
  spread: 380,
};

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
type FallingRain = { id: number; x: number; y: number; fall: number; duration: number; length: number; width: number; drift: number };

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
`;

export default function JarVisual({ progress, running = false }: FocusVisualProps) {
  const value = Math.max(0, Math.min(1, progress));
  const complete = value >= 1;
  const reducedMotion = useReducedMotion();
  const svgId = useId().replace(/:/g, '');
  const waterMaskId = `jar-water-alpha-mask-${svgId}`;
  const waterGradientId = `jar-water-depth-${svgId}`;
  const rainGradientId = `jar-rain-${svgId}`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: IMG_W, height: IMG_H });
  const [maskRows, setMaskRows] = useState<MaskRow[]>([]);
  const [rains, setRains] = useState<FallingRain[]>([]);
  const nextRainId = useRef(0);
  const waterY = WATER_BASE - value * (WATER_BASE - WATER_TOP);
  const waterYRef = useRef(waterY);
  waterYRef.current = waterY;
  const jarExtentRef = useRef(JAR_EXTENT_FALLBACK);
  const rainLaneCursor = useRef(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Dense, constant rainfall while the session runs: several drops per tick, so
  // the sky is always full of streaks rather than a single visible line.
  useEffect(() => {
    if (reducedMotion || !running) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const emitOne = () => {
      const extent = jarExtentRef.current;
      // Cycle through equal horizontal lanes (with light jitter inside each
      // lane) so the rainfall is spread evenly, left to right.
      const minX = extent.left - RAIN.spread;
      const maxX = extent.right + RAIN.spread;
      const laneWidth = (maxX - minX) / RAIN_LANES;
      const lane = rainLaneCursor.current % RAIN_LANES;
      rainLaneCursor.current += 1;
      const x = minX + laneWidth * lane + randomBetween(laneWidth * 0.18, laneWidth * 0.82);
      const toJar = x >= extent.left && x <= extent.right;
      const y = RAIN.sourceY + randomBetween(-26, 26);
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
  const offsetX = (viewport.width - IMG_W * scale) * OBJECT_POSITION.x;
  const offsetY = (viewport.height - IMG_H * scale) * OBJECT_POSITION.y;
  const sceneTransform = `translate(${offsetX} ${offsetY}) scale(${scale})`;
  const waterTransition = reducedMotion ? undefined : 'transform 1s linear';

  return (
    <div ref={containerRef} className={`focus-visual ${complete ? 'visual-complete' : ''}`} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }} role="img" aria-label={`Water jar ${Math.round(value * 100)} percent complete`}>
      <style>{keyframes}</style>
      <svg width="100%" height="100%" viewBox={`0 0 ${viewport.width} ${viewport.height}`} preserveAspectRatio="none" aria-hidden="true">
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
          {/* Exact palette from the removed splash/floor bubbles. */}
          <linearGradient id={rainGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eafaff" stopOpacity=".2" />
            <stop offset=".32" stopColor="#d9f4ff" stopOpacity=".72" />
            <stop offset=".68" stopColor="#ceeaf7" stopOpacity=".9" />
            <stop offset="1" stopColor="#e0f3fb" stopOpacity={RAIN.opacity} />
          </linearGradient>
        </defs>

        <g transform={sceneTransform}>
          <image href={JAR_SCENE_URL} x="0" y="0" width={IMG_W} height={IMG_H} />

          {/* Cloud + rain artwork. */}
          <g transform={`translate(${CLOUD_RAIN.x} ${CLOUD_RAIN.y}) scale(${CLOUD_RAIN.scale})`} opacity={CLOUD_RAIN.opacity}>
            <image href={CLOUD_RAIN_URL} x="0" y="0" width={IMG_W} height={940} preserveAspectRatio="none" />
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
                onAnimationEnd={() => setRains((current) => current.filter((r) => r.id !== drop.id))}
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
                    stroke="#d9f4ff"
                    strokeWidth={0.5}
                    strokeLinejoin="round"
                  />
                  <ellipse
                    cx={-drop.width * 0.12}
                    cy={drop.length * 0.62}
                    rx={Math.max(0.3, drop.width * 0.15)}
                    ry={Math.max(1.2, drop.length * 0.08)}
                    fill="#f4fcff"
                    opacity=".75"
                  />
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
        </g>
      </svg>

      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,.06), transparent 30%, transparent 70%, rgba(255,255,255,.03))', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '60%', height: '20%', borderRadius: '50%', background: 'rgba(197,255,84,.12)', filter: 'blur(24px)', opacity: complete ? .28 : .05, pointerEvents: 'none' }} aria-hidden="true" />
    </div>
  );
}
