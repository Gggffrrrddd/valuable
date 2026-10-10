import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FocusVisualProps } from './types';
import { TANK_IMG_W, TANK_IMG_H, useTankGeom, type TankGeom } from './tankGeom';

const FISH_WALL_PADDING = 12;
const FISH_SURFACE_PADDING = 14;

/** Fish homes as fractions of the mapped tank rect (responsive-safe). */
const FISH = [
  { fx: 0.264, fy: 0.861, width: 64, hue: 5, speed: .92, bob: 4.2, delay: -.7 },
  { fx: 0.549, fy: 0.722, width: 58, hue: 165, speed: 1.08, bob: 4.8, delay: -2.1 },
  { fx: 0.398, fy: 0.566, width: 60, hue: -18, speed: 1, bob: 3.9, delay: -1.4 },
  { fx: 0.737, fy: 0.809, width: 54, hue: 44, speed: 1.16, bob: 4.5, delay: -3.2 },
  { fx: 0.586, fy: 0.375, width: 52, hue: 210, speed: .86, bob: 3.7, delay: -2.6 },
] as const;

const FISH_URL = '/visuals/jar/fish-right.png';

type FishConfig = { x: number; y: number; width: number; hue: number; speed: number; bob: number; delay: number };
type MaskRow = { left: number; right: number } | null;
/** Forward-only motion: fish always face right; `wrap` loops to the left edge. */
type FishMotion = { x: number; y: number; duration: number; tilt: number; wrap?: boolean };

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function getMaskBounds(maskRows: MaskRow[], yOrigin: number, y: number, halfHeight: number) {
  const sampleYs = [y - halfHeight - FISH_WALL_PADDING, y, y + halfHeight + FISH_WALL_PADDING];
  const rows = sampleYs
    .map((sampleY) => maskRows[Math.round(sampleY - yOrigin)])
    .filter((row): row is Exclude<MaskRow, null> => Boolean(row));
  if (rows.length !== sampleYs.length) return null;
  return {
    left: Math.max(...rows.map((row) => row.left)),
    right: Math.min(...rows.map((row) => row.right)),
  };
}

function pickFishTarget(fish: FishConfig, maskRows: MaskRow[], geom: TankGeom, waterY: number, current: FishMotion, dart = false): FishMotion {
  const height = fish.width * (391 / 638);
  const halfWidth = fish.width / 2;
  const halfHeight = height / 2;
  const minY = waterY + halfHeight + FISH_SURFACE_PADDING + 5;
  const maxY = geom.base - halfHeight - FISH_WALL_PADDING;

  for (let attempt = 0; attempt < 40 && minY <= maxY; attempt += 1) {
    const randomY = dart
      ? Math.max(minY, Math.min(maxY, current.y + randomBetween(-12, 5)))
      : randomBetween(minY, maxY);
    const bounds = getMaskBounds(maskRows, geom.y, randomY, halfHeight);
    if (!bounds) continue;
    const minX = bounds.left + halfWidth + FISH_WALL_PADDING;
    const maxX = bounds.right - halfWidth - FISH_WALL_PADDING;
    if (minX >= maxX) continue;

    // Forward-only: always head right; near the right wall, wrap to the left.
    const step = dart ? randomBetween(38, 72) : randomBetween(50, 150);
    if (current.x + step > maxX - 8) {
      return { x: minX + randomBetween(0, 30), y: randomY, duration: 0, tilt: 0, wrap: true };
    }
    return {
      x: Math.min(maxX, current.x + step),
      y: randomY,
      duration: 0,
      tilt: Math.max(-5, Math.min(5, (randomY - current.y) * .14)),
    };
  }

  return { x: current.x, y: current.y, duration: 0, tilt: 0 };
}

function SwimmingFish({ fish, maskRows, geom, waterY, reducedMotion }: { fish: FishConfig; maskRows: MaskRow[]; geom: TankGeom; waterY: number; reducedMotion: boolean }) {
  const height = fish.width * (391 / 638);
  const visible = waterY <= fish.y - height / 2 - FISH_SURFACE_PADDING;
  const [motion, setMotion] = useState<FishMotion>({ x: fish.x, y: fish.y, duration: 0, tilt: 0 });
  const motionRef = useRef<FishMotion>({ x: fish.x, y: fish.y, duration: 0, tilt: 0 });
  const [wrapping, setWrapping] = useState(false);
  const waterYRef = useRef(waterY);
  waterYRef.current = waterY;

  useEffect(() => {
    if (reducedMotion) {
      const staticMotion: FishMotion = { x: fish.x, y: fish.y, duration: 0, tilt: 0 };
      motionRef.current = staticMotion;
      setMotion(staticMotion);
      return;
    }
    if (!visible || maskRows.length === 0) return;

    let cancelled = false;
    let moveTimer: ReturnType<typeof setTimeout>;
    let dartTimer: ReturnType<typeof setTimeout>;
    let wrapTimer: ReturnType<typeof setTimeout>;

    // Wrap: quick fade out, teleport to the left edge, fade back in —
    // the fish never swims backwards.
    const doWrap = (target: FishMotion) => {
      if (cancelled) return;
      setWrapping(true);
      wrapTimer = setTimeout(() => {
        if (cancelled) return;
        const next: FishMotion = { x: target.x, y: target.y, duration: 0, tilt: 0 };
        motionRef.current = next;
        setMotion(next);
        setWrapping(false);
        moveTimer = setTimeout(() => move(false), randomBetween(250, 900));
      }, 280);
    };

    const move = (dart = false) => {
      if (cancelled) return;
      const current = motionRef.current;
      const target = pickFishTarget(fish, maskRows, geom, waterYRef.current, current, dart);
      if (target.wrap) {
        doWrap(target);
        return;
      }
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
      clearTimeout(wrapTimer);
    };
  }, [fish, geom, maskRows, reducedMotion, visible]);

  // Always faces right (forward) — never mirrored backwards.
  return (
    <g
      opacity={visible && !wrapping ? 1 : 0}
      style={{ transform: `translate(${motion.x}px, ${motion.y}px)`, transition: reducedMotion ? 'opacity 1.25s ease-out' : `transform ${motion.duration}s cubic-bezier(.35,.05,.3,1), opacity .28s ease-out` }}
    >
      <g style={{ transformBox: 'fill-box', transformOrigin: 'center', transform: `rotate(${motion.tilt}deg)`, transition: reducedMotion ? undefined : 'transform .28s ease-out' }}>
        <g style={{ animation: reducedMotion ? undefined : `tank-fish-bob ${fish.bob}s ease-in-out ${fish.delay}s infinite alternate` }}>
          <image href={FISH_URL} x={-fish.width / 2} y={-height / 2} width={fish.width} height={height} style={{ filter: `hue-rotate(${fish.hue}deg) saturate(1.15) brightness(1.08)` }} />
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
  @keyframes tank-ripple { to { stroke-dashoffset: -48; } }
  @keyframes tank-current { from { transform: translateX(-28px); opacity: .08; } to { transform: translateX(32px); opacity: .2; } }
  @keyframes tank-fish-bob { from { transform: translateY(-4px); } to { transform: translateY(4px); } }
  @keyframes tank-floor-sheen {
    0%, 100% { opacity: .05; }
    50% { opacity: .1; }
  }
`;

/**
 * Water-fill + fish overlay for the aquarium scene. Same engine as the jar
 * visual (rising reveal, mask-bounded swimming fish, ripples, currents).
 * Geometry is mapped live from the hidden mask overlay, so water fills
 * exactly where the mask sits — on any screen size.
 */
export default function TankLife({ progress }: Pick<FocusVisualProps, 'progress'>) {
  const value = Math.max(0, Math.min(1, progress));
  const complete = value >= 1;
  const reducedMotion = useReducedMotion();
  const svgId = useId().replace(/:/g, '');
  const waterMaskId = `tank-water-mask-${svgId}`;
  const waterGradientId = `tank-water-depth-${svgId}`;
  const floorGradientId = `tank-floor-${svgId}`;
  const { ref, geom } = useTankGeom();
  // Rect-based mask over the mapped tank area — no canvas calibration needed.
  const maskRows = useMemo<MaskRow[]>(() =>
    Array.from({ length: Math.max(1, Math.round(geom.height)) }, () => ({ left: geom.x, right: geom.x + geom.width })),
  [geom]);
  const fishes = useMemo<FishConfig[]>(() =>
    FISH.map((f) => ({ ...f, x: geom.x + f.fx * geom.width, y: geom.y + f.fy * geom.height })),
  [geom]);
  const waterY = geom.base - value * (geom.base - geom.top);
  const waterTransition = reducedMotion ? undefined : 'transform 1s linear';
  // Ripple pattern is authored 960 wide starting at -57: remap it exactly
  // onto the tank interior.
  const rippleScale = geom.width / 960;
  const rippleX = geom.x + 57 * rippleScale;

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0" aria-hidden="true">
      <style>{keyframes}</style>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${TANK_IMG_W} ${TANK_IMG_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ transform: 'translate(41px, 38px) scale(1.27)' }}
      >
        <defs>
          <mask id={waterMaskId} maskUnits="userSpaceOnUse" x={geom.x} y={geom.y} width={geom.width} height={geom.height} mask-type="alpha">
            <rect x={geom.x} y={geom.y} width={geom.width} height={geom.height} fill="white" />
          </mask>
          <linearGradient id={waterGradientId} x1="0" y1={geom.top} x2="0" y2={geom.base} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8dc4b8" stopOpacity=".55" />
            <stop offset=".48" stopColor="#6bafa0" stopOpacity=".6" />
            <stop offset=".84" stopColor="#4a9b8e" stopOpacity=".65" />
            <stop offset="1" stopColor="#3c867c" stopOpacity=".55" />
          </linearGradient>
          <linearGradient id={floorGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cfe9f6" stopOpacity="0" />
            <stop offset="1" stopColor="#a9d6ee" stopOpacity=".5" />
          </linearGradient>
        </defs>

        {/* Water fill: only the reveal rect's top edge rises. */}
        <g mask={`url(#${waterMaskId})`}>
          <rect x={geom.x} y={waterY} width={geom.width} height={geom.base - waterY} fill={`url(#${waterGradientId})`} style={{ transition: reducedMotion ? undefined : 'y 1s linear, height 1s linear' }} />
        </g>

        <g mask={`url(#${waterMaskId})`}>
          <g style={{ transform: `translateY(${waterY}px)`, transition: waterTransition }}>
            <g transform="translate(330 0)" opacity=".12" style={{ animation: reducedMotion ? undefined : 'tank-current 11s ease-in-out infinite alternate' }}>
              <path d="M300 70 C370 46 460 94 550 55" fill="none" stroke="#c6eee5" strokeWidth="9" strokeLinecap="round" />
              <path d="M300 145 C385 116 465 168 550 130" fill="none" stroke="#b6e7dc" strokeWidth="6" strokeLinecap="round" />
            </g>
            <g transform={`translate(${rippleX} 0) scale(${rippleScale} 1)`}>
              <path d="M-57 1 Q-45 -2 -33 1 T-9 1 T15 1 T39 1 T63 1 T87 1 T111 1 T135 1 T159 1 T183 1 T207 1 T231 1 T255 1 T279 1 T303 1 T327 1 T351 1 T375 1 T399 1 T423 1 T447 1 T471 1 T495 1 T519 1 T543 1 T567 1 T591 1 T615 1 T639 1 T663 1 T687 1 T711 1 T735 1 T759 1 T783 1 T807 1 T831 1 T855 1 T879 1 T903 1" fill="none" stroke="rgba(220,249,242,.78)" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M-57 4 Q-45 -1 -33 4 T-9 4 T15 4 T39 4 T63 4 T87 4 T111 4 T135 4 T159 4 T183 4 T207 4 T231 4 T255 4 T279 4 T303 4 T327 4 T351 4 T375 4 T399 4 T423 4 T447 4 T471 4 T495 4 T519 4 T543 4 T567 4 T591 4 T615 4 T639 4 T663 4 T687 4 T711 4 T735 4 T759 4 T783 4 T807 4 T831 4 T855 4 T879 4 T903 4" fill="none" stroke="rgba(157,215,202,.64)" strokeWidth="2" strokeDasharray="18 6" style={{ animation: reducedMotion ? undefined : 'tank-ripple 3.4s linear infinite' }} />
            </g>
          </g>
        </g>

        <g mask={`url(#${waterMaskId})`}>
          {fishes.map((fish, index) => <SwimmingFish key={`tank-fish-${index}`} fish={fish} maskRows={maskRows} geom={geom} waterY={waterY} reducedMotion={reducedMotion} />)}
        </g>

        {/* Floor sheen glow under the tank (no ground ripples). */}
        <g>
          <ellipse cx={geom.x + geom.width / 2} cy={geom.base + 62} rx={520} ry={44} fill={`url(#${floorGradientId})`} style={{ animation: reducedMotion ? undefined : 'tank-floor-sheen 9s ease-in-out infinite' }} />
        </g>
      </svg>

      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,.06), transparent 30%, transparent 70%, rgba(255,255,255,.03))', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '60%', height: '20%', borderRadius: '50%', background: 'rgba(197,255,84,.12)', filter: 'blur(24px)', opacity: complete ? .28 : .05, pointerEvents: 'none' }} aria-hidden="true" />
    </div>
  );
}
