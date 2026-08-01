import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { FocusVisualProps } from './types';

const JAR_SCENE_URL = '/visuals/jar/jar-scene.png';
const FISH_LEFT_URL = '/visuals/jar/fish-left.png';
const FISH_RIGHT_URL = '/visuals/jar/fish-right.png';
const TAP_URL = '/visuals/jar/tap-prompt.png';
const IMG_W = 1672;
const IMG_H = 941;
const OBJECT_POSITION = { x: 0.4, y: 0.15 };
const WATER_TOP = 470;
const WATER_BASE = 842;
const NOZZLE = { x: 420, y: 432 };

// Inner-wall samples: neck 330-495, upper 337-508, middle 310-536,
// lower 312-537, and above-pebbles 325-519.
const INTERIOR_PATH = 'M330 470 C332 490 334 505 337 520 C326 544 314 568 310 590 C308 620 309 652 312 680 C315 718 320 748 325 770 C331 803 348 830 374 842 L470 842 C494 831 513 803 519 770 C528 739 534 711 537 680 C540 644 539 614 536 590 C532 561 518 539 508 520 C504 502 500 485 495 470 Z';

const FISH = [
  { x: 370, y: 760, side: 'left', width: 72, hue: 5, swim: 9.5, bob: 3.8, delay: 0 },
  { x: 465, y: 718, side: 'right', width: 62, hue: 165, swim: 11.5, bob: 4.5, delay: -2.1 },
  { x: 405, y: 665, side: 'left', width: 66, hue: -18, swim: 10.2, bob: 3.5, delay: -4.4 },
  { x: 475, y: 610, side: 'right', width: 56, hue: 44, swim: 12.4, bob: 4.2, delay: -1.4 },
  { x: 370, y: 548, side: 'left', width: 58, hue: 210, swim: 9, bob: 3.2, delay: -5.3 },
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

const keyframes = `
  @keyframes jar-ripple { to { stroke-dashoffset: -48; } }
  @keyframes jar-current { from { transform: translateX(-28px); opacity: .08; } to { transform: translateX(32px); opacity: .2; } }
  @keyframes jar-fish-swim { 0%,100% { transform: translateX(-8px) rotate(-2deg); } 50% { transform: translateX(8px) rotate(2deg); } }
  @keyframes jar-fish-bob { from { transform: translateY(-3px); } to { transform: translateY(3px); } }
  @keyframes jar-drip-svg {
    0% { transform: translate(420px,432px); opacity: 0; }
    8% { opacity: .88; }
    88% { transform: translate(420px,var(--water-y)); opacity: .88; }
    100% { transform: translate(420px,var(--water-y)); opacity: 0; }
  }
`;

export default function JarVisual({ progress }: FocusVisualProps) {
  const value = Math.max(0, Math.min(1, progress));
  const complete = value >= 1;
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: IMG_W, height: IMG_H });
  const waterY = WATER_BASE - value * (WATER_BASE - WATER_TOP);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = Math.max(viewport.width / IMG_W, viewport.height / IMG_H);
  const offsetX = (viewport.width - IMG_W * scale) * OBJECT_POSITION.x;
  const offsetY = (viewport.height - IMG_H * scale) * OBJECT_POSITION.y;
  const sceneTransform = `translate(${offsetX} ${offsetY}) scale(${scale})`;
  const waterTransition = reducedMotion ? undefined : 'transform 1s linear';
  const dripVariables = { '--water-y': `${Math.max(NOZZLE.y, waterY)}px` } as CSSProperties;

  return (
    <div ref={containerRef} className={`focus-visual ${complete ? 'visual-complete' : ''}`} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }} role="img" aria-label={`Water jar ${Math.round(value * 100)} percent complete`}>
      <style>{keyframes}</style>
      <svg width="100%" height="100%" viewBox={`0 0 ${viewport.width} ${viewport.height}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <clipPath id="jar-interior-mask" clipPathUnits="userSpaceOnUse"><path d={INTERIOR_PATH} /></clipPath>
          <linearGradient id="jar-water-depth" x1="0" y1={WATER_TOP} x2="0" y2={WATER_BASE} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#d8f6ff" stopOpacity=".25" />
            <stop offset=".52" stopColor="#5cbee8" stopOpacity=".4" />
            <stop offset=".86" stopColor="#186bae" stopOpacity=".55" />
            <stop offset="1" stopColor="#145b9a" stopOpacity=".34" />
          </linearGradient>
          <radialGradient id="jar-drop" cx="32%" cy="25%"><stop offset="0" stopColor="#f5fbff" /><stop offset=".42" stopColor="#bfe8ff" /><stop offset="1" stopColor="#78b9d9" /></radialGradient>
          <clipPath id="tap-crop"><rect x="260" y="334" width="416" height="99.3" /></clipPath>
        </defs>

        <g transform={sceneTransform}>
          <image href={JAR_SCENE_URL} x="0" y="0" width={IMG_W} height={IMG_H} />

          {/* One shared mask owns every water-related layer and all fish. */}
          <g clipPath="url(#jar-interior-mask)">
            <g style={{ transform: `translateY(${waterY}px)`, transition: waterTransition }}>
              <rect x="300" y="0" width="260" height={WATER_BASE} fill="url(#jar-water-depth)" />
              <g opacity=".16" style={{ animation: reducedMotion ? undefined : 'jar-current 11s ease-in-out infinite alternate' }}>
                <path d="M326 70 C370 46 440 94 525 55" fill="none" stroke="#e9fbff" strokeWidth="9" strokeLinecap="round" />
                <path d="M320 145 C385 116 445 168 530 130" fill="none" stroke="#d9f7ff" strokeWidth="6" strokeLinecap="round" />
              </g>
              {/* Both strokes are paths, never rectangles, and are clipped by jar-interior-mask. */}
              <path d="M295 1 Q307 -2 319 1 T343 1 T367 1 T391 1 T415 1 T439 1 T463 1 T487 1 T511 1 T535 1 T559 1" fill="none" stroke="rgba(238,253,255,.88)" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M295 4 Q307 -1 319 4 T343 4 T367 4 T391 4 T415 4 T439 4 T463 4 T487 4 T511 4 T535 4 T559 4" fill="none" stroke="rgba(177,229,247,.68)" strokeWidth="2" strokeDasharray="18 6" style={{ animation: reducedMotion ? undefined : 'jar-ripple 3.4s linear infinite' }} />
            </g>

            {FISH.map((fish) => {
              const visible = waterY <= fish.y - 10;
              const height = fish.width * (391 / 638);
              return (
                <g key={`${fish.side}-${fish.y}`} transform={`translate(${fish.x} ${fish.y})`} opacity={visible ? 1 : 0} style={{ transition: 'opacity 1.25s ease-out' }}>
                  <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: reducedMotion ? undefined : `jar-fish-swim ${fish.swim}s ease-in-out ${fish.delay}s infinite` }}>
                    <g style={{ animation: reducedMotion ? undefined : `jar-fish-bob ${fish.bob}s ease-in-out ${fish.delay}s infinite alternate` }}>
                      <image href={fish.side === 'left' ? FISH_LEFT_URL : FISH_RIGHT_URL} x={-fish.width / 2} y={-height / 2} width={fish.width} height={height} style={{ filter: `hue-rotate(${fish.hue}deg) saturate(1.15) brightness(1.08)` }} />
                    </g>
                  </g>
                </g>
              );
            })}
          </g>

          <g clipPath="url(#jar-interior-mask)" style={dripVariables}>
            {!reducedMotion && [0, .5, 1].map((delay) => (
              <path key={delay} d="M0 0 C-.8 3.5 -6 7.7 -6 12.5 C-6 16.5 -3.3 19 0 19 C3.3 19 6 16.5 6 12.5 C6 7.7 .8 3.5 0 0Z" fill="url(#jar-drop)" style={{ animation: `jar-drip-svg 1.6s ease-in ${delay}s infinite`, transform: `translate(${NOZZLE.x}px,${NOZZLE.y}px)`, opacity: .84 }} />
            ))}
          </g>

          <image href={TAP_URL} x="260" y="334" width="416" height="277" clipPath="url(#tap-crop)" />
        </g>
      </svg>

      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,.06), transparent 30%, transparent 70%, rgba(255,255,255,.03))', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '60%', height: '20%', borderRadius: '50%', background: 'rgba(197,255,84,.12)', filter: 'blur(24px)', opacity: complete ? .28 : .05, pointerEvents: 'none' }} aria-hidden="true" />
    </div>
  );
}
