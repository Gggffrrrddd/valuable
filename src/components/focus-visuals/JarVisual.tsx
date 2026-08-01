import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { FocusVisualProps } from './types';

const JAR_SCENE_URL = '/visuals/jar/jar-scene.png';
const FISH_LEFT_URL = '/visuals/jar/fish-left.png';
const FISH_RIGHT_URL = '/visuals/jar/fish-right.png';
const TAP_URL = '/visuals/jar/tap-prompt.png';

const BUILD_TAG = 'water-rise-fish-swim-v1';
const JAR_OBJECT_POSITION = '40% 15%';
const IMG_W = 1672;
const IMG_H = 941;
const JAR_INTERIOR = { left: 340, right: 530, top: 465, bottom: 830 };
const JAR_MOUTH_CENTER = { x: 420, y: 432 };
const TAP_BOUNDS = { left: 260, top: 334, width: 416, height: 277 };
const TAP_STATIC_DRIP_CROP_Y = 134;
const TAP_ASSET_HEIGHT = 374;

const FISH = [
  { left: 27, top: 78, direction: 'left', scale: 0.92, delay: 0, swim: 9.5, bob: 3.8, hue: 5 },
  { left: 68, top: 68, direction: 'right', scale: 0.78, delay: -2.1, swim: 11.5, bob: 4.5, hue: 165 },
  { left: 42, top: 56, direction: 'left', scale: 0.82, delay: -4.4, swim: 10.2, bob: 3.5, hue: -18 },
  { left: 73, top: 43, direction: 'right', scale: 0.68, delay: -1.4, swim: 12.4, bob: 4.2, hue: 44 },
  { left: 25, top: 31, direction: 'left', scale: 0.72, delay: -5.3, swim: 9, bob: 3.2, hue: 210 },
] as const;

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

const jarKeyframes = `
  @keyframes jar-drip {
    0% { top: var(--jar-drip-start); opacity: 0; }
    8% { opacity: .88; }
    88% { top: var(--jar-drip-end); opacity: .88; }
    100% { top: var(--jar-drip-end); opacity: 0; }
  }
  @keyframes jar-surface-flow {
    from { background-position: 0 0, 0 0; }
    to { background-position: 46px 0, -70px 0; }
  }
  @keyframes jar-current {
    from { transform: translateX(-28%) skewX(-12deg); }
    to { transform: translateX(42%) skewX(-12deg); }
  }
  @keyframes jar-fish-swim {
    0%, 100% { transform: translateX(-7px) rotate(-2deg); }
    50% { transform: translateX(8px) rotate(2deg); }
  }
  @keyframes jar-fish-bob {
    from { transform: translateY(-3px); }
    to { transform: translateY(3px); }
  }
`;

export default function JarVisual({ progress }: FocusVisualProps) {
  const value = Math.max(0, Math.min(1, progress));
  const complete = value >= 1;
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toPctX = (px: number) => `${(px / IMG_W) * 100}%`;
  const toPctY = (py: number) => `${(py / IMG_H) * 100}%`;
  const interiorHeight = JAR_INTERIOR.bottom - JAR_INTERIOR.top;
  const waterSurfaceY = JAR_INTERIOR.bottom - value * interiorHeight;
  const waterSurfacePct = (waterSurfaceY / IMG_H) * 100;
  const mouthPctY = (JAR_MOUTH_CENTER.y / IMG_H) * 100;
  const mouthInsideClipPctX = ((JAR_MOUTH_CENTER.x - JAR_INTERIOR.left) / (JAR_INTERIOR.right - JAR_INTERIOR.left)) * 100;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      console.log(`[JarVisual BUILD=${BUILD_TAG}] box=${Math.round(bounds.width)}x${Math.round(bounds.height)}`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const sceneLayer: CSSProperties = {
    position: 'absolute', inset: 0, backgroundImage: `url(${JAR_SCENE_URL})`,
    backgroundSize: 'cover', backgroundPosition: JAR_OBJECT_POSITION, backgroundRepeat: 'no-repeat', pointerEvents: 'none',
  };
  const interiorClip: CSSProperties = {
    position: 'absolute', left: toPctX(JAR_INTERIOR.left), top: toPctY(JAR_INTERIOR.top),
    width: toPctX(JAR_INTERIOR.right - JAR_INTERIOR.left), height: toPctY(interiorHeight), overflow: 'hidden',
  };
  const waterStyle: CSSProperties = {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: `${value * 100}%`, overflow: 'visible',
    background: 'linear-gradient(180deg, rgba(190,239,255,.28) 0%, rgba(81,181,231,.38) 46%, rgba(23,112,181,.58) 100%)',
    transition: reducedMotion ? undefined : 'height 1s linear',
  };
  const dripStyle = {
    '--jar-drip-start': `${mouthPctY}%`,
    '--jar-drip-end': `${waterSurfacePct}%`,
  } as CSSProperties;

  return (
    <div ref={containerRef} className={`focus-visual ${complete ? 'visual-complete' : ''}`} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }} role="img" aria-label={`Water jar ${Math.round(value * 100)} percent complete`}>
      <style>{jarKeyframes}</style>
      <div style={{ ...sceneLayer, zIndex: 0 }} aria-hidden="true" />

      {/* Water and fish share this glass-bounded coordinate system. */}
      <div style={{ ...interiorClip, zIndex: 1 }} aria-hidden="true">
        <div style={waterStyle}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '-7px', height: '13px', backgroundImage: 'radial-gradient(ellipse at 10% 50%, rgba(244,253,255,.88) 0 13%, transparent 14%), radial-gradient(ellipse at 55% 50%, rgba(219,248,255,.78) 0 15%, transparent 16%)', backgroundSize: '46px 10px, 70px 12px', backgroundRepeat: 'repeat-x', animation: reducedMotion ? undefined : 'jar-surface-flow 3.6s linear infinite', boxShadow: '0 1px 5px rgba(225,251,255,.7)' }} />
          <div style={{ position: 'absolute', inset: '12% -40% 8%', opacity: .18, overflow: 'hidden' }}>
            <div style={{ width: '58%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(237,251,255,.65), transparent)', animation: reducedMotion ? undefined : 'jar-current 12s ease-in-out infinite alternate' }} />
          </div>
        </div>

        {FISH.map((fish, index) => {
          const fishY = JAR_INTERIOR.top + (fish.top / 100) * interiorHeight;
          // Reveal only after the surface has passed the fish, leaving bobbing headroom.
          const revealed = waterSurfaceY <= fishY - 12;
          return (
            <div key={fish.direction + index} style={{ position: 'absolute', left: `${fish.left}%`, top: `${fish.top}%`, width: '37%', transform: 'translate(-50%, -50%)', opacity: revealed ? 1 : 0, transition: 'opacity 1.25s ease-out', pointerEvents: 'none' }}>
              <div style={{ animation: reducedMotion ? undefined : `jar-fish-swim ${fish.swim}s ease-in-out ${fish.delay}s infinite` }}>
                <div style={{ animation: reducedMotion ? undefined : `jar-fish-bob ${fish.bob}s ease-in-out ${fish.delay}s infinite alternate` }}>
                  <img src={fish.direction === 'left' ? FISH_LEFT_URL : FISH_RIGHT_URL} alt="" draggable={false} style={{ display: 'block', width: '100%', filter: `hue-rotate(${fish.hue}deg) saturate(1.15) brightness(1.08)`, transform: `scale(${fish.scale})` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full-height wrapper clips only against the glass walls. The live end position is the water surface. */}
      <div style={{ position: 'absolute', left: toPctX(JAR_INTERIOR.left), width: toPctX(JAR_INTERIOR.right - JAR_INTERIOR.left), top: 0, height: '100%', overflow: 'hidden', zIndex: 2, pointerEvents: 'none', ...dripStyle }} aria-hidden="true">
        {[{ size: 14, delay: '0s' }, { size: 12, delay: '.5s' }, { size: 10, delay: '1s' }].map((drop, index) => (
          <div key={drop.size} style={{ position: 'absolute', left: `${mouthInsideClipPctX}%`, top: `${mouthPctY}%`, width: `${drop.size}px`, height: `${Math.round(drop.size * 1.42)}px`, transform: 'translate(-50%, -100%)', animation: reducedMotion ? undefined : `jar-drip 1.6s ease-in ${drop.delay} infinite`, opacity: reducedMotion ? 0 : .84 }}>
            <svg viewBox="0 0 14 20" width="100%" height="100%" aria-hidden="true"><defs><radialGradient id={`jar-drop-${index}`} cx="32%" cy="25%"><stop offset="0" stopColor="#f5fbff" /><stop offset=".42" stopColor="#bfe8ff" /><stop offset="1" stopColor="#78b9d9" /></radialGradient></defs><path d="M7 0C6.2 3.5 1 7.7 1 12.5C1 16.5 3.7 19 7 19C10.3 19 13 16.5 13 12.5C13 7.7 7.8 3.5 7 0Z" fill={`url(#jar-drop-${index})`} /></svg>
          </div>
        ))}
      </div>

      {/* Crop immediately below the physical nozzle: the source image's baked drip is hidden. */}
      <div style={{ position: 'absolute', left: toPctX(TAP_BOUNDS.left), top: toPctY(TAP_BOUNDS.top), width: toPctX(TAP_BOUNDS.width), height: toPctY(TAP_BOUNDS.height * (TAP_STATIC_DRIP_CROP_Y / TAP_ASSET_HEIGHT)), overflow: 'hidden', pointerEvents: 'none', zIndex: 4 }} aria-hidden="true">
        <img src={TAP_URL} alt="" draggable={false} className="jar-tap" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 'auto', display: 'block', pointerEvents: 'none' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,.06), transparent 30%, transparent 70%, rgba(255,255,255,.03))', pointerEvents: 'none', zIndex: 5 }} aria-hidden="true" />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '60%', height: '20%', borderRadius: '50%', background: 'rgba(197,255,84,.12)', filter: 'blur(24px)', opacity: complete ? .28 : .05, pointerEvents: 'none', zIndex: 6 }} />
    </div>
  );
}
