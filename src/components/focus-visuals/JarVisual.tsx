import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { FocusVisualProps } from './types';

const JAR_SCENE_URL = '/visuals/jar/jar-scene.png';
const FISH_URL = '/visuals/jar/fish-01.png';
const TAP_URL = '/visuals/jar/tap-prompt.png';

const BUILD_TAG = 'object-position-v1';

/* object-position values for the jar background image.
   These are the single source of truth — tune both here. */
const JAR_OBJECT_POSITION = '40% 15%';

/* Jar's on-screen position as percentages of the visible container.
   Measured at the design viewport (1366x679) with object-position: 40% 15%.
   The jar is at ~15% from left, ~22%-68% from top. */
const JAR_NECK_X = 15.1;       /* tap nozzle horizontal position (% of container width) */
const JAR_NECK_Y = 21.7;       /* tap nozzle vertical position (% of container height) */
const JAR_INTERIOR_LEFT = 10.3;   /* water fill left edge (% of container width) */
const JAR_INTERIOR_RIGHT = 21.7;  /* water fill right edge (% of container width) */
const JAR_INTERIOR_TOP = 22.9;    /* water fill top edge (% of container height) */
const JAR_INTERIOR_BOTTOM = 66.9; /* water fill bottom edge (% of container height) */
const TAP_IMG_LEFT = 5.5;
const TAP_IMG_TOP = 7.2;
const TAP_IMG_WIDTH = 24.9;
const TAP_IMG_HEIGHT = 33.3;

const FISH_COUNT = 4;

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const u = () => setR(q.matches);
    u();
    q.addEventListener('change', u);
    return () => q.removeEventListener('change', u);
  }, []);
  return r;
}

export default function JarVisual({ progress }: FocusVisualProps) {
  const value = Math.max(0, Math.min(1, progress));
  const complete = value >= 1;
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fishes = useMemo(() => {
    const out = [];
    for (let i = 0; i < FISH_COUNT; i++) {
      out.push({
        id: i,
        startX: 50, /* center of jar interior horizontally */
        startY: 50 + (i - 1.5) * 8, /* stagger vertically */
        bobDelay: i * 0.5,
        bobDur: 2.4 + seededUnit(i + 101) * 1.6,
        swimDelay: seededUnit(i + 201) * 3,
        swimDur: 8 + seededUnit(i + 301) * 8,
        swimDx: (seededUnit(i + 401) - 0.5) * 6,
        swimDy: (seededUnit(i + 501) - 0.5) * 4,
        hue: [18, -10, 200, 45][i],
        saturate: [1.5, 1.6, 0.4, 1.4][i],
        brightness: [1.15, 1.1, 1.05, 1.2][i],
        scale: [1.0, 0.95, 1.05, 0.9][i],
        faceLeft: i % 2 === 0,
      });
    }
    return out;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      console.log(
        `[JarVisual BUILD=${BUILD_TAG}] box=${Math.round(r.width)}x${Math.round(r.height)} aspect=${(r.width / r.height).toFixed(3)}`,
        `viewport=${window.innerWidth}x${window.innerHeight} aspect=${(window.innerWidth / window.innerHeight).toFixed(3)}`,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Water level as percentage of jar interior height */
  const waterTopPercent = value; /* 0 = empty, 1 = full */
  const waterHeightPercent = waterTopPercent * (JAR_INTERIOR_BOTTOM - JAR_INTERIOR_TOP);
  const waterTopPos = JAR_INTERIOR_BOTTOM - waterHeightPercent;

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundImage: `url(${JAR_SCENE_URL})`,
    backgroundSize: 'cover',
    backgroundPosition: JAR_OBJECT_POSITION,
    backgroundRepeat: 'no-repeat',
  };

  return (
    <div
      ref={containerRef}
      className={`focus-visual ${complete ? 'visual-complete' : ''}`}
      style={containerStyle}
      role="img"
      aria-label={`Water jar ${Math.round(value * 100)} percent complete`}
    >
      {/* Water fill layer — clipped to jar interior via overflow on a wrapper */}
      <div
        style={{
          position: 'absolute',
          left: `${JAR_INTERIOR_LEFT}%`,
          width: `${JAR_INTERIOR_RIGHT - JAR_INTERIOR_LEFT}%`,
          top: `${JAR_INTERIOR_TOP}%`,
          height: `${JAR_INTERIOR_BOTTOM - JAR_INTERIOR_TOP}%`,
          overflow: 'hidden',
          borderRadius: '0 0 40% 40% / 0 0 20% 20%',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${waterTopPos}%`,
            height: `${100 - waterTopPos}%`,
            background: 'linear-gradient(180deg, rgba(127,211,255,0.32) 0%, rgba(74,168,224,0.38) 50%, rgba(26,111,191,0.48) 100%)',
          }}
        />
      </div>

      {/* Fish */}
      <div
        style={{
          position: 'absolute',
          left: `${JAR_INTERIOR_LEFT}%`,
          width: `${JAR_INTERIOR_RIGHT - JAR_INTERIOR_LEFT}%`,
          top: `${JAR_INTERIOR_TOP}%`,
          height: `${JAR_INTERIOR_BOTTOM - JAR_INTERIOR_TOP}%`,
          overflow: 'hidden',
          borderRadius: '0 0 40% 40% / 0 0 20% 20%',
        }}
      >
        {fishes.map((f) => (
          <div
            key={f.id}
            style={{
              position: 'absolute',
              left: `${f.startX}%`,
              top: `${f.startY}%`,
              transform: `translate(-50%, -50%) scaleX(${f.faceLeft ? -1 : 1})`,
              opacity: value > 0.3 ? 1 : 0,
              transition: 'opacity 1.2s ease-out',
              animation: reducedMotion
                ? undefined
                : `jar-fish-bob ${f.bobDur}s ease-in-out ${f.bobDelay}s infinite alternate`,
            }}
          >
            <img
              src={FISH_URL}
              alt=""
              draggable={false}
              style={{
                width: 'clamp(2rem, 6vw, 3.5rem)',
                filter: `hue-rotate(${f.hue}deg) saturate(${f.saturate}) brightness(${f.brightness})`,
                animation: reducedMotion
                  ? undefined
                  : `jar-fish-swim ${f.swimDur}s ease-in-out ${f.swimDelay}s infinite alternate`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Tap image */}
      <img
        src={TAP_URL}
        alt=""
        draggable={false}
        className="jar-tap"
        style={{
          position: 'absolute',
          left: `${TAP_IMG_LEFT}%`,
          top: `${TAP_IMG_TOP}%`,
          width: `${TAP_IMG_WIDTH}%`,
          height: `${TAP_IMG_HEIGHT}%`,
          objectFit: 'contain',
          objectPosition: 'center top',
          pointerEvents: 'none',
        }}
      />

      {/* Drip drops */}
      <div
        className="jar-drip"
        style={{
          position: 'absolute',
          left: `${JAR_NECK_X}%`,
          top: `${JAR_NECK_Y}%`,
          width: '8px',
          height: '12px',
          background: '#bfe8ff',
          borderRadius: '50%',
          opacity: 0.85,
          transform: 'translate(-50%, -50%)',
          animation: reducedMotion ? undefined : 'jar-drip 1.4s ease-in infinite',
        }}
      />
      <div
        className="jar-drip"
        style={{
          position: 'absolute',
          left: `${JAR_NECK_X}%`,
          top: `${JAR_NECK_Y}%`,
          width: '6px',
          height: '10px',
          background: '#bfe8ff',
          borderRadius: '50%',
          opacity: 0.75,
          transform: 'translate(-50%, -50%)',
          animation: reducedMotion ? undefined : 'jar-drip 1.4s ease-in 0.45s infinite',
        }}
      />
      <div
        className="jar-drip"
        style={{
          position: 'absolute',
          left: `${JAR_NECK_X}%`,
          top: `${JAR_NECK_Y}%`,
          width: '5px',
          height: '8px',
          background: '#bfe8ff',
          borderRadius: '50%',
          opacity: 0.7,
          transform: 'translate(-50%, -50%)',
          animation: reducedMotion ? undefined : 'jar-drip 1.4s ease-in 0.9s infinite',
        }}
      />
    </div>
  );
}
