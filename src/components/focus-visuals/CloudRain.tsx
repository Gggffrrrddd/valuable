import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTankGeom } from './tankGeom';

const CLOUD_RAIN_URL = '/visuals/jar/cloud-rain.png';
/** Scene space matches aquarium-scene.png so the overlay aligns 1:1. */
const IMG_W = 1670;
const IMG_H = 942;
/** Same placement the cloud has in the jar visual. */
const CLOUD_RAIN = { x: -8, y: 5, scale: 0.6, opacity: 0.57 };

/** Cloud-rain artwork bottom edge in scene coordinates (940 * 0.6 + 5). */
const ARTWORK_BOTTOM = 569;

/** Rain feel — identical constants to the jar visual. */
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
/** Tank footprint + landing heights come from the live mask geometry. */
const FLOOR_GAP = 65;
/** Even horizontal lanes so drops never clump into one side or column. */
const RAIN_LANES = 32;

type FallingRain = { id: number; x: number; y: number; fall: number; duration: number; length: number; width: number; drift: number; kind: 'jar' | 'floor'; landX: number; landY: number };
type RainSplash = { id: number; x: number; y: number; duration: number; scale: number };

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
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
  @keyframes aqua-rain-fall {
    0% { transform: translate(var(--x), var(--y)); opacity: 0; }
    10% { opacity: .6; }
    22% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translate(calc(var(--x) + var(--wind)), calc(var(--y) + var(--fall))); opacity: 0; }
  }
  @keyframes aqua-splash {
    0% { transform: scale(.3); opacity: 0; }
    22% { transform: scale(1); opacity: .6; }
    100% { transform: scale(1.9); opacity: 0; }
  }
`;

/**
 * Cloud + rainfall overlay for the aquarium scene. Same artwork placement
 * and same rain engine constants as the jar visual; geometry matches the
 * scene image 1:1 (same box, same fit, same transform).
 */
export default function CloudRain({ running = false, progress = 0 }: { running?: boolean; progress?: number }) {
  const reducedMotion = useReducedMotion();
  const svgId = useId().replace(/:/g, '');
  const rainGradientId = `aqua-cloud-rain-${svgId}`;
  const splashMaskId = `aqua-splash-mask-${svgId}`;
  const [rains, setRains] = useState<FallingRain[]>([]);
  const [splashes, setSplashes] = useState<RainSplash[]>([]);
  const nextRainId = useRef(0);
  const rainLaneCursor = useRef(0);
  const { ref, geom } = useTankGeom();
  const geomRef = useRef(geom);
  geomRef.current = geom;
  const progressRef = useRef(progress);
  progressRef.current = progress;

  // Dense, constant rainfall while the session runs: several drops per tick, so
  // the sky is always full of streaks rather than a single visible line.
  useEffect(() => {
    if (reducedMotion || !running) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const emitOne = () => {
      const g = geomRef.current;
      const extent = { left: g.x, right: g.x + g.width };
      // Drops land on the rising water surface (same as the jar), not the floor.
      const p = Math.max(0, Math.min(1, progressRef.current));
      const surfaceY = g.base - p * (g.base - g.top);
      // Cycle through equal horizontal lanes (with light jitter inside each
      // lane) so the rainfall is spread evenly, left to right.
      const minX = extent.left - RAIN.spread;
      const maxX = extent.right + RAIN.spread;
      const laneWidth = (maxX - minX) / RAIN_LANES;
      const lane = rainLaneCursor.current % RAIN_LANES;
      rainLaneCursor.current += 1;
      const x = minX + laneWidth * lane + randomBetween(laneWidth * 0.18, laneWidth * 0.82);
      const toTank = x >= extent.left && x <= extent.right;
      const y = RAIN.sourceY + randomBetween(-26, 26);
      const landY = toTank ? surfaceY : g.base + FLOOR_GAP;
      // Account for the group offset so the drop's final position lands exactly
      // on the floor / tank bottom: final = y + RAIN_OFFSET.y + fall.
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
        kind: (toTank ? 'jar' : 'floor') as 'jar' | 'floor',
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

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0" aria-hidden="true">
      <style>{keyframes}</style>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${IMG_W} ${IMG_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ transform: 'translate(41px, 38px) scale(1.27)' }}
      >
        <defs>
          {/* Soft, translucent rain streak — fades at both tips. */}
          <linearGradient id={rainGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eafaff" stopOpacity="0" />
            <stop offset=".15" stopColor="#eafaff" stopOpacity=".5" />
            <stop offset=".5" stopColor="#d9f4ff" stopOpacity=".6" />
            <stop offset=".85" stopColor="#eafaff" stopOpacity=".5" />
            <stop offset="1" stopColor="#eafaff" stopOpacity="0" />
          </linearGradient>
          {/* Clip splashes to the tank interior so ripples never bleed out. */}
          <mask id={splashMaskId} maskUnits="userSpaceOnUse" x={geom.x} y={geom.y} width={geom.width} height={geom.height} mask-type="alpha">
            <rect x={geom.x} y={geom.y} width={geom.width} height={geom.height} fill="white" />
          </mask>
        </defs>

        {/* Cloud artwork — same placement as the jar visual. */}
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
                animation: `aqua-rain-fall ${drop.duration}s linear forwards`,
              } as CSSProperties}
              onAnimationEnd={() => {
                setRains((current) => current.filter((r) => r.id !== drop.id));
                if (drop.kind !== 'jar') return;
                const splashId = nextRainId.current;
                nextRainId.current += 1;
                const splashX = drop.landX + RAIN_OFFSET.x;
                setSplashes((current) => [...current.slice(-34), { id: splashId, x: splashX, y: drop.landY, duration: randomBetween(.5, .72), scale: randomBetween(.8, 1.5) }]);
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

        {/* Splashes where drops land inside the tank (clipped to the mask). */}
        <g mask={`url(#${splashMaskId})`}>
        {splashes.map((splash) => (
          <g key={splash.id} style={{ transform: `translate(${splash.x}px, ${splash.y}px)` }}>
            <g
              style={{ animation: `aqua-splash ${splash.duration}s ease-out forwards`, transformOrigin: 'center', transformBox: 'fill-box', scale: splash.scale }}
              onAnimationEnd={() => setSplashes((current) => current.filter((s) => s.id !== splash.id))}
            >
              <ellipse cx="0" cy="0" rx="9" ry="3" fill="none" stroke="#d9f4ff" strokeWidth="1.3" opacity=".7" />
              <ellipse cx="0" cy="0" rx="4" ry="1.6" fill="#eafaff" opacity=".5" />
            </g>
          </g>
        ))}
        </g>
      </svg>
    </div>
  );
}
