import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { FocusVisualProps } from './types';

const JAR_SCENE_URL = '/visuals/jar/jar-scene.png';
const FISH_LEFT_URL = '/visuals/jar/fish-left.png';
const FISH_RIGHT_URL = '/visuals/jar/fish-right.png';
const WATER_CALIBRATION_URL = '/visuals/jar/final-jar-water.png';
const IMG_W = 1672;
const IMG_H = 941;
const OBJECT_POSITION = { x: 0.4, y: 0.15 };
const WATER_IMAGE = { x: -57, y: 378, width: 956, height: 496 };
const WATER_TOP = 461;
const WATER_BASE = 843;
const MASK_ALPHA_THRESHOLD = 24;
const FISH_WALL_PADDING = 12;
const FISH_SURFACE_PADDING = 14;

/**
 * Premium sky deck: soft volumetric clouds layered over the jar mouth.
 * `drift`/`duration`/`delay` drive a slow parallax float so the deck breathes.
 */
const CLOUDS = [
  { x: 248, y: 138, scale: 0.9, drift: 24, duration: 14, delay: 0 },
  { x: 430, y: 98, scale: 1.18, drift: 18, duration: 16, delay: -4.5 },
  { x: 624, y: 132, scale: 1.0, drift: 21, duration: 15, delay: -8 },
  { x: 802, y: 108, scale: 0.85, drift: 17, duration: 17, delay: -2.5 },
  { x: 528, y: 176, scale: 0.7, drift: 13, duration: 18, delay: -11 },
] as const;

/** Rain columns sit inside the jar silhouette so every drop lands in the vessel. */
const RAIN_SOURCE_Y = 208;
const RAIN_COLUMNS = [168, 224, 280, 336, 392, 448, 504, 560, 616, 672, 728, 784] as const;

/**
 * Whole-deck placement for the cloud ensemble. Tune with the on-screen panel;
 * the values captured from Save are hardcoded here as the shipped default.
 */
const DEFAULT_CLOUD_DECK = { x: 60, y: 40, scale: 2.4 };

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
type FallingRain = { id: number; x: number; waterY: number; duration: number; length: number; width: number; drift: number };
type Splash = { id: number; x: number; y: number; duration: number };

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

/**
 * One volumetric cloud: stacked soft ellipses with a lit crown, a shaded belly
 * and a warm rim so it reads as premium rather than a flat sticker.
 */
function CloudShape({ scale, id }: { scale: number; id: string }) {
  return (
    <g transform={`scale(${scale})`}>
      <ellipse cx="0" cy="-6" rx="88" ry="33" fill={`url(#${id}-body)`} />
      <ellipse cx="-52" cy="-2" rx="47" ry="27" fill={`url(#${id}-body)`} />
      <ellipse cx="54" cy="-4" rx="51" ry="29" fill={`url(#${id}-body)`} />
      <ellipse cx="-24" cy="-34" rx="45" ry="33" fill={`url(#${id}-top)`} />
      <ellipse cx="27" cy="-38" rx="49" ry="35" fill={`url(#${id}-top)`} />
      <ellipse cx="1" cy="-47" rx="39" ry="29" fill={`url(#${id}-hi)`} />
      <ellipse cx="-38" cy="-14" rx="26" ry="15" fill="#ffffff" opacity=".5" />
      <ellipse cx="0" cy="9" rx="80" ry="13" fill={`url(#${id}-belly)`} />
    </g>
  );
}

const keyframes = `
  @keyframes jar-ripple { to { stroke-dashoffset: -48; } }
  @keyframes jar-current { from { transform: translateX(-28px); opacity: .08; } to { transform: translateX(32px); opacity: .2; } }
  @keyframes jar-fish-bob { from { transform: translateY(-4px); } to { transform: translateY(4px); } }
  @keyframes jar-cloud-drift {
    0% { transform: translateX(calc(var(--drift) * -0.5)); }
    100% { transform: translateX(calc(var(--drift) * 0.5)); }
  }
  @keyframes jar-cloud-breathe {
    0%, 100% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-3px) scale(1.018); }
  }
  @keyframes jar-mist-pulse {
    0%, 100% { opacity: .22; transform: scaleX(.94); }
    50% { opacity: .42; transform: scaleX(1.06); }
  }
  @keyframes jar-rain-fall {
    0% { transform: translate3d(0, 0, 0); opacity: 0; }
    10% { opacity: .9; }
    78% { opacity: .78; }
    100% { transform: translate3d(var(--wind), var(--fall), 0); opacity: 0; }
  }
  @keyframes jar-splash {
    0% { transform: scale(.25); opacity: 0; }
    22% { transform: scale(1); opacity: .6; }
    100% { transform: scale(1.9); opacity: 0; }
  }
  @keyframes jar-beam {
    0%, 100% { opacity: .05; }
    50% { opacity: .11; }
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
  const rainGlowId = `jar-rain-glow-${svgId}`;
  const beamGradientId = `jar-beam-${svgId}`;
  const cloudBaseId = `jar-cloud-${svgId}`;
  const cloudShadowId = `jar-cloud-shadow-${svgId}`;
  const mistFilterId = `jar-mist-blur-${svgId}`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: IMG_W, height: IMG_H });
  const [maskRows, setMaskRows] = useState<MaskRow[]>([]);
  const [rains, setRains] = useState<FallingRain[]>([]);
  const [splashes, setSplashes] = useState<Splash[]>([]);
  const [cloudDeck, setCloudDeck] = useState(DEFAULT_CLOUD_DECK);
  const cloudDragOrigin = useRef<{ x: number; y: number } | null>(null);
  const nextRainId = useRef(0);
  const waterY = WATER_BASE - value * (WATER_BASE - WATER_TOP);
  const waterYRef = useRef(waterY);
  waterYRef.current = waterY;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Rain emitter: a steady drizzle that always lands on the current water line.
  useEffect(() => {
    if (reducedMotion || !running) return;
    const emitRain = () => {
      const column = RAIN_COLUMNS[Math.floor(Math.random() * RAIN_COLUMNS.length)];
      const id = nextRainId.current;
      nextRainId.current += 1;
      const heavy = Math.random() < .32;
      setRains((current) => [
        ...current.slice(-70),
        {
          id,
          x: column + randomBetween(-16, 16),
          waterY: waterYRef.current,
          duration: heavy ? randomBetween(.62, .82) : randomBetween(.82, 1.18),
          length: heavy ? randomBetween(26, 40) : randomBetween(14, 24),
          width: heavy ? randomBetween(2, 2.8) : randomBetween(1.1, 1.6),
          drift: randomBetween(-9, 9),
        },
      ]);
    };
    emitRain();
    const emitter = setInterval(emitRain, 78);
    return () => clearInterval(emitter);
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
          <linearGradient id={rainGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#dff4ff" stopOpacity="0" />
            <stop offset=".3" stopColor="#b4e3ff" stopOpacity=".7" />
            <stop offset="1" stopColor="#7ec8f5" stopOpacity=".98" />
          </linearGradient>
          <linearGradient id={rainGlowId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cdeeff" stopOpacity="0" />
            <stop offset="1" stopColor="#9adaff" stopOpacity=".35" />
          </linearGradient>
          <linearGradient id={beamGradientId} x1="0" y1={RAIN_SOURCE_Y} x2="0" y2={WATER_BASE} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#eaf6ff" stopOpacity=".5" />
            <stop offset="1" stopColor="#dff0ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${cloudBaseId}-body`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fbfdff" />
            <stop offset=".55" stopColor="#e6eef8" />
            <stop offset="1" stopColor="#c3d3e6" />
          </linearGradient>
          <linearGradient id={`${cloudBaseId}-top`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#dfeaf6" />
          </linearGradient>
          <radialGradient id={`${cloudBaseId}-hi`} cx="38%" cy="28%" r="72%">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".98" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${cloudBaseId}-belly`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#93a9c2" stopOpacity=".38" />
            <stop offset="1" stopColor="#7f95b0" stopOpacity="0" />
          </linearGradient>
          <filter id={cloudShadowId} x="-40%" y="-60%" width="180%" height="220%">
            <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#6c8bab" floodOpacity=".3" />
          </filter>
          <filter id={mistFilterId} x="-60%" y="-120%" width="220%" height="340%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        <g transform={sceneTransform}>
          <image href={JAR_SCENE_URL} x="0" y="0" width={IMG_W} height={IMG_H} />

          {/* Soft light shaft pouring from the clouds toward the vessel. */}
          <g style={{ animation: reducedMotion ? undefined : 'jar-beam 7s ease-in-out infinite' }}>
            <path d={`M250 ${RAIN_SOURCE_Y} L800 ${RAIN_SOURCE_Y} L${WATER_IMAGE.x + WATER_IMAGE.width * .82} ${WATER_BASE} L${WATER_IMAGE.x + WATER_IMAGE.width * .18} ${WATER_BASE} Z`} fill={`url(#${beamGradientId})`} opacity=".08" />
          </g>

          {/* Rain */}
          <g>
            {rains.map((drop) => (
              <g
                key={drop.id}
                style={{
                  '--fall': `${Math.max(40, drop.waterY - RAIN_SOURCE_Y)}px`,
                  '--wind': `${drop.drift}px`,
                  animation: `jar-rain-fall ${drop.duration}s linear forwards`,
                  transform: `translate(${drop.x}px, ${RAIN_SOURCE_Y}px)`,
                } as CSSProperties}
                onAnimationEnd={() => {
                  setRains((current) => current.filter((r) => r.id !== drop.id));
                  const splashId = nextRainId.current;
                  nextRainId.current += 1;
                  setSplashes((current) => [...current.slice(-24), { id: splashId, x: drop.x, y: drop.waterY, duration: randomBetween(.5, .7) }]);
                }}
              >
                <rect x={-drop.width / 2} y={0} width={drop.width} height={drop.length} rx={drop.width / 2} fill={`url(#${rainGradientId})`} opacity=".9" />
                <rect x={-0.6} y={drop.length - 7} width={1.2} height={5} rx={0.6} fill="#f2fbff" opacity=".75" />
              </g>
            ))}
          </g>

          {/* Splashes where drops meet the surface */}
          <g mask={`url(#${waterMaskId})`}>
            {splashes.map((splash) => (
              <g
                key={splash.id}
                style={{ animation: `jar-splash ${splash.duration}s ease-out forwards`, transform: `translate(${splash.x}px, ${splash.y}px)` }}
                onAnimationEnd={() => setSplashes((current) => current.filter((s) => s.id !== splash.id))}
              >
                <ellipse cx="0" cy="0" rx="9" ry="3" fill="none" stroke="#d9f4ff" strokeWidth="1.3" opacity=".7" />
                <ellipse cx="0" cy="0" rx="4" ry="1.6" fill="#eafaff" opacity=".55" />
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

          {/* Volumetric cloud deck, drawn above the rain so drops emerge from it. */}
          <g
            filter={`url(#${cloudShadowId})`}
            transform={`translate(${cloudDeck.x} ${cloudDeck.y}) scale(${cloudDeck.scale})`}
          >
            {CLOUDS.map((cloud, index) => (
              <g
                key={index}
                style={{
                  transform: `translate(${cloud.x}px, ${cloud.y}px)`,
                  ...(reducedMotion
                    ? {}
                    : {
                        animation: `jar-cloud-drift ${cloud.duration}s ease-in-out ${cloud.delay}s infinite alternate`,
                        '--drift': `${cloud.drift}px`,
                      }),
                }}
              >
                <g style={{ animation: reducedMotion ? undefined : `jar-cloud-breathe ${cloud.duration * 0.6}s ease-in-out ${cloud.delay}s infinite` }}>
                  <CloudShape scale={cloud.scale} id={cloudBaseId} />
                </g>
                {/* Mist pooling under each cloud base. */}
                <ellipse
                  cx="0"
                  cy={26}
                  rx={74 * cloud.scale}
                  ry={15 * cloud.scale}
                  fill="#ffffff"
                  filter={`url(#${mistFilterId})`}
                  style={{ transformOrigin: 'center', animation: reducedMotion ? undefined : `jar-mist-pulse ${cloud.duration}s ease-in-out ${cloud.delay}s infinite` }}
                />
              </g>
            ))}
          </g>
        </g>
      </svg>

      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,.06), transparent 30%, transparent 70%, rgba(255,255,255,.03))', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '60%', height: '20%', borderRadius: '50%', background: 'rgba(197,255,84,.12)', filter: 'blur(24px)', opacity: complete ? .28 : .05, pointerEvents: 'none' }} aria-hidden="true" />

      {/* Temporary cloud-deck tuner: drag the box or use the sliders, then Save. */}
      <div style={{ position: 'absolute', right: 16, top: 16, zIndex: 30, width: 272, borderRadius: 16, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.66)', padding: 16, color: '#d6d3d1', backdropFilter: 'blur(18px)', boxShadow: '0 24px 48px rgba(0,0,0,.5)', fontFamily: 'inherit' }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: '#bef264' }}>Cloud deck</div>
          <div style={{ marginTop: 4, fontSize: 11, color: '#a8a29e' }}>Move the whole cloud group</div>
        </div>

        <div
          style={{ marginBottom: 12, cursor: 'move', borderRadius: 8, border: '1px dashed rgba(190,242,100,.3)', background: 'rgba(190,242,100,.04)', padding: '8px 12px', textAlign: 'center', fontSize: 10, color: '#a8a29e' }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            cloudDragOrigin.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerMove={(event) => {
            if (!cloudDragOrigin.current) return;
            const dx = (event.clientX - cloudDragOrigin.current.x) * 0.6;
            const dy = (event.clientY - cloudDragOrigin.current.y) * 0.6;
            cloudDragOrigin.current = { x: event.clientX, y: event.clientY };
            setCloudDeck((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
          }}
          onPointerUp={() => {
            cloudDragOrigin.current = null;
          }}
          onPointerCancel={() => {
            cloudDragOrigin.current = null;
          }}
        >
          ↑↓←→ drag me
        </div>

        {([
          { key: 'x', label: 'Move X', min: -900, max: 900, step: 1 },
          { key: 'y', label: 'Move Y', min: -600, max: 600, step: 1 },
          { key: 'scale', label: 'Size', min: 0.2, max: 8, step: 0.05 },
        ] as const).map((row) => (
          <label key={row.key} style={{ display: 'grid', gridTemplateColumns: '4.5rem 1fr 3.5rem', alignItems: 'center', gap: 8, fontSize: 10, marginBottom: 8 }}>
            <span style={{ color: '#78716c' }}>{row.label}</span>
            <input
              type="range"
              min={row.min}
              max={row.max}
              step={row.step}
              value={cloudDeck[row.key]}
              onChange={(event) => setCloudDeck((current) => ({ ...current, [row.key]: Number(event.target.value) }))}
              style={{ height: 4, accentColor: '#bef264' }}
            />
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#a8a29e' }}>{cloudDeck[row.key].toFixed(2)}</span>
          </label>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            type="button"
            style={{ flex: 1, borderRadius: 8, border: '1px solid rgba(190,242,100,.4)', background: 'rgba(190,242,100,.1)', padding: '6px 10px', fontSize: 10, fontWeight: 700, color: '#d9f99d' }}
            onClick={() => {
              console.log('CLOUD_DECK_START');
              console.log(JSON.stringify({ x: Number(cloudDeck.x.toFixed(2)), y: Number(cloudDeck.y.toFixed(2)), scale: Number(cloudDeck.scale.toFixed(3)) }, null, 2));
              console.log('CLOUD_DECK_END');
            }}
          >
            Save
          </button>
          <button
            type="button"
            style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', padding: '6px 10px', fontSize: 10, fontWeight: 700, color: '#a8a29e' }}
            onClick={() => setCloudDeck(DEFAULT_CLOUD_DECK)}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
