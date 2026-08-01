import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { FocusVisualProps } from './types';

const JAR_SCENE_URL = '/visuals/jar/jar-scene.png';
const FISH_LEFT_URL = '/visuals/jar/fish-left.png';
const FISH_RIGHT_URL = '/visuals/jar/fish-right.png';
const TAP_URL = '/visuals/jar/tap-prompt.png';
const WATER_CALIBRATION_URL = '/visuals/jar/final-jar-water.png';
const IMG_W = 1672;
const IMG_H = 941;
const OBJECT_POSITION = { x: 0.4, y: 0.15 };
const WATER_IMAGE = { x: -57, y: 378, width: 956, height: 496 };
const WATER_TOP = 461;
const WATER_BASE = 843;
const NOZZLE = { x: 420, y: 432 };

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
          <mask id="jar-water-alpha-mask" maskUnits="userSpaceOnUse" x={WATER_IMAGE.x} y={WATER_IMAGE.y} width={WATER_IMAGE.width} height={WATER_IMAGE.height} style={{ maskType: 'alpha' }}>
            <image href={WATER_CALIBRATION_URL} x={WATER_IMAGE.x} y={WATER_IMAGE.y} width={WATER_IMAGE.width} height={WATER_IMAGE.height} preserveAspectRatio="none" />
          </mask>
          <linearGradient id="jar-water-depth" x1="0" y1={WATER_TOP} x2="0" y2={WATER_BASE} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8dc4b8" stopOpacity=".55" />
            <stop offset=".48" stopColor="#6bafa0" stopOpacity=".6" />
            <stop offset=".84" stopColor="#4a9b8e" stopOpacity=".65" />
            <stop offset="1" stopColor="#3c867c" stopOpacity=".55" />
          </linearGradient>
          <radialGradient id="jar-drop" cx="32%" cy="25%"><stop offset="0" stopColor="#8dc4b8" /><stop offset=".45" stopColor="#6bafa0" /><stop offset="1" stopColor="#4a9b8e" /></radialGradient>
          <clipPath id="tap-crop"><rect x="260" y="334" width="416" height="99.3" /></clipPath>
        </defs>

        <g transform={sceneTransform}>
          <image href={JAR_SCENE_URL} x="0" y="0" width={IMG_W} height={IMG_H} />

          {/* The saved reference PNG is used only as an invisible, pixel-accurate alpha mask. */}
          <g mask="url(#jar-water-alpha-mask)">
            <g style={{ transform: `translateY(${waterY}px)`, transition: waterTransition }}>
              <rect x="300" y="0" width="260" height={WATER_BASE} fill="url(#jar-water-depth)" />
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

          <g style={dripVariables}>
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
