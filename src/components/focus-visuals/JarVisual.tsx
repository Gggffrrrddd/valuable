import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { FocusVisualProps } from './types';

const JAR_SCENE_URL = '/visuals/jar/jar-scene.png';
const FISH_URL = '/visuals/jar/fish-01.png';
const TAP_URL = '/visuals/jar/tap-prompt.png';

const BUILD_TAG = 'object-position-overlay-v2';

const JAR_OBJECT_POSITION = '40% 15%';

const IMG_W = 1672;
const IMG_H = 941;

const JAR_INTERIOR = {
  left: 340,
  right: 530,
  top: 465,
  bottom: 830,
};

const JAR_MOUTH_CENTER = { x: 420, y: 455 };
const TAP_BOUNDS = { left: 260, top: 334, width: 416, height: 277 };

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

const jarKeyframes = `
  @keyframes jar-fish-bob {
    from { transform: translateY(0); }
    to { transform: translateY(-8px); }
  }
  @keyframes jar-fish-swim {
    0%   { transform: translateX(-4px); }
    50%  { transform: translateX(4px); }
    100% { transform: translateX(-4px); }
  }
`;

export default function JarVisual({ progress }: FocusVisualProps) {
  const value = Math.max(0, Math.min(1, progress));
  const complete = value >= 1;
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fishes = useMemo(() => {
    const out = [];
    const interiorWidth = JAR_INTERIOR.right - JAR_INTERIOR.left;
    const interiorHeight = JAR_INTERIOR.bottom - JAR_INTERIOR.top;
    for (let i = 0; i < FISH_COUNT; i++) {
      const u1 = seededUnit(i + 101);
      const u2 = seededUnit(i + 201);
      const u3 = seededUnit(i + 301);
      const fishX = JAR_INTERIOR.left + interiorWidth * (0.2 + u1 * 0.6);
      const fishY = JAR_INTERIOR.top + interiorHeight * (0.5 + (i - 1.5) * 0.15);
      out.push({
        id: i,
        startX: fishX,
        startY: fishY,
        bobDelay: i * 0.5,
        bobDur: 2.4 + u2 * 1.6,
        swimDelay: u3 * 3,
        swimDur: 8 + u1 * 8,
        hue: [18, -10, 200, 45][i],
        saturate: [1.5, 1.6, 0.4, 1.4][i],
        brightness: [1.15, 1.1, 1.05, 1.2][i],
        scale: [1.0, 0.95, 1.05, 0.9][i],
        faceLeft: i % 2 === 0,
        revealY: JAR_INTERIOR.bottom - 60 - u2 * (interiorHeight - 120),
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

  /* Overlay container uses the same cover/position as the background,
     so the container's 100%x100% space = the visible jar scene.
     Children positioned as % of source image align with jar features on screen. */
  const overlayLayerStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundImage: `url(${JAR_SCENE_URL})`,
    backgroundSize: 'cover',
    backgroundPosition: JAR_OBJECT_POSITION,
    backgroundRepeat: 'no-repeat',
    pointerEvents: 'none',
  };

  const toPctX = (px: number) => `${(px / IMG_W) * 100}%`;
  const toPctY = (py: number) => `${(py / IMG_H) * 100}%`;

  return (
    <div
      ref={containerRef}
      className={`focus-visual ${complete ? 'visual-complete' : ''}`}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
      role="img"
      aria-label={`Water jar ${Math.round(value * 100)} percent complete`}
    >
      <style>{jarKeyframes}</style>

      {/* Visible jar background */}
      <div style={{ ...overlayLayerStyle, zIndex: 0 }} aria-hidden="true" />

      {/* Overlay layer — same cover/position, used purely for coordinate alignment */}
      <div style={{ ...overlayLayerStyle, zIndex: 1, opacity: 0 }} aria-hidden="true">
        {/* Water fill — clipped to jar interior via clip-path matching jar shape */}
        <div
          style={{
            position: 'absolute',
            left: toPctX(JAR_INTERIOR.left),
            top: toPctY(JAR_INTERIOR.top),
            width: toPctX(JAR_INTERIOR.right - JAR_INTERIOR.left),
            height: toPctY(JAR_INTERIOR.bottom - JAR_INTERIOR.top),
            overflow: 'hidden',
            clipPath: 'inset(0% 0% 0% 0% round 0 0 30% 30%)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: `${value * 100}%`,
              background: 'linear-gradient(180deg, rgba(127,211,255,0.32) 0%, rgba(74,168,224,0.38) 50%, rgba(26,111,191,0.48) 100%)',
              transition: 'height 0.6s ease-out',
            }}
          />
        </div>

        {/* Fish */}
        {fishes.map((f) => {
          const interiorHeight = JAR_INTERIOR.bottom - JAR_INTERIOR.top;
          const fishProgress = value * interiorHeight;
          const fishReveal = f.revealY - JAR_INTERIOR.top;
          const revealed = fishProgress >= fishReveal;
          return (
            <div
              key={f.id}
              style={{
                position: 'absolute',
                left: toPctX(f.startX),
                top: toPctY(f.startY),
                transform: `translate(-50%, -50%) scaleX(${f.faceLeft ? -1 : 1})`,
                opacity: revealed ? 1 : 0,
                transition: 'opacity 1.2s ease-out',
                zIndex: 2,
              }}
            >
              <div
                style={{
                  animation: reducedMotion
                    ? undefined
                    : `jar-fish-swim ${f.swimDur}s ease-in-out ${f.swimDelay}s infinite alternate`,
                }}
              >
                <div
                  style={{
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
                      width: `${(130 / IMG_W) * 100}%`,
                      filter: `hue-rotate(${f.hue}deg) saturate(${f.saturate}) brightness(${f.brightness})`,
                      transform: `scale(${f.scale})`,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* Tap image */}
        <img
          src={TAP_URL}
          alt=""
          draggable={false}
          className="jar-tap"
          style={{
            position: 'absolute',
            left: toPctX(TAP_BOUNDS.left),
            top: toPctY(TAP_BOUNDS.top),
            width: toPctX(TAP_BOUNDS.width),
            height: toPctY(TAP_BOUNDS.height),
            objectFit: 'contain',
            objectPosition: 'center top',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />
      </div>

      {/* Drip drops — positioned at the jar mouth center.
          These are outside the overlay layer so the drip animation is visible. */}
      <div
        style={{
          position: 'absolute',
          left: '15%',
          top: '22%',
          width: '6px',
          height: '10px',
          background: '#bfe8ff',
          borderRadius: '50%',
          opacity: 0.85,
          transform: 'translate(-50%, -50%)',
          animation: reducedMotion ? undefined : 'jar-drip 1.4s ease-in infinite',
          zIndex: 4,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '15%',
          top: '22%',
          width: '5px',
          height: '8px',
          background: '#bfe8ff',
          borderRadius: '50%',
          opacity: 0.75,
          transform: 'translate(-50%, -50%)',
          animation: reducedMotion ? undefined : 'jar-drip 1.4s ease-in 0.45s infinite',
          zIndex: 4,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '15%',
          top: '22%',
          width: '4px',
          height: '7px',
          background: '#bfe8ff',
          borderRadius: '50%',
          opacity: 0.7,
          transform: 'translate(-50%, -50%)',
          animation: reducedMotion ? undefined : 'jar-drip 1.4s ease-in 0.9s infinite',
          zIndex: 4,
        }}
      />

      {/* Finish glow */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '60%',
          height: '20%',
          borderRadius: '50%',
          background: 'rgba(197, 255, 84, 0.12)',
          filter: 'blur(24px)',
          opacity: complete ? 0.28 : 0.05,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
    </div>
  );
}
