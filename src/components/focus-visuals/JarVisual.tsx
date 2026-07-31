import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { FocusVisualProps } from './types';

const JAR_SCENE_URL = '/visuals/jar/jar-scene.png';
const FISH_URL = '/visuals/jar/fish-01.png';

const VIEW_W = 1448;
const VIEW_H = 1086;

const JAR_INTERIOR = {
  x: 470,
  width: 360,
  baseY: 970,
  topY: 520,
};

const FISH_COUNT = 4;
const FISH_VARIANTS = [
  { hue: 18, saturate: 1.5, brightness: 1.15, scale: 1.0 },
  { hue: -10, saturate: 1.6, brightness: 1.1, scale: 0.95 },
  { hue: 200, saturate: 0.4, brightness: 1.05, scale: 1.05 },
  { hue: 45, saturate: 1.4, brightness: 1.2, scale: 0.9 },
];

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

interface FishInstance {
  id: number;
  startX: number;
  startY: number;
  revealY: number;
  scale: number;
  faceLeft: boolean;
  hue: number;
  saturate: number;
  brightness: number;
  bobDur: number;
  bobDelay: number;
  swimDur: number;
  swimDelay: number;
  swimKeyframes: { dx: number; rot: number }[];
  fishW: number;
  fishH: number;
}

const FISH_W = 130;
const FISH_H = FISH_W * (391 / 638);
const CENTER_X = JAR_INTERIOR.x + JAR_INTERIOR.width / 2;
const SWIM_MIN = JAR_INTERIOR.x - CENTER_X + FISH_W / 2;
const SWIM_MAX = JAR_INTERIOR.x + JAR_INTERIOR.width - CENTER_X - FISH_W / 2;

function buildFish(): FishInstance[] {
  const out: FishInstance[] = [];
  for (let i = 0; i < FISH_COUNT; i++) {
    const variant = FISH_VARIANTS[i % FISH_VARIANTS.length];
    const u1 = seededUnit(i + 101);
    const u2 = seededUnit(i + 211);
    const u3 = seededUnit(i + 311);
    const u5 = seededUnit(i + 511);
    const u6 = seededUnit(i + 611);
    const u7 = seededUnit(i + 711);
    const u8 = seededUnit(i + 811);

    const revealY = JAR_INTERIOR.baseY - 80 - u3 * (JAR_INTERIOR.baseY - JAR_INTERIOR.topY - 160);
    const startY = revealY - FISH_H / 2;

    const swimKeyframes: { dx: number; rot: number }[] = [];
    const keyframeCount = 6;
    for (let k = 0; k < keyframeCount; k++) {
      const ku = seededUnit(i * 100 + k + 901);
      const ku2 = seededUnit(i * 100 + k + 951);
      const dx = SWIM_MIN + ku * (SWIM_MAX - SWIM_MIN);
      const rot = (ku2 - 0.5) * 8;
      swimKeyframes.push({ dx, rot });
    }

    out.push({
      id: i,
      startX: CENTER_X,
      startY,
      revealY,
      scale: variant.scale * (0.9 + u5 * 0.2),
      faceLeft: u6 < 0.5,
      hue: variant.hue + (u7 - 0.5) * 12,
      saturate: variant.saturate,
      brightness: variant.brightness,
      bobDur: 2.4 + u1 * 1.6,
      bobDelay: u2 * 2,
      swimDur: 8 + u8 * 8,
      swimDelay: u1 * 3,
      swimKeyframes,
      fishW: FISH_W,
      fishH: FISH_H,
    });
  }
  return out;
}

function buildSwimKeyframeCSS(fishes: FishInstance[]): string {
  return fishes
    .map((f) => {
      const stops = f.swimKeyframes
        .map((k, idx) => `${Math.round((idx / (f.swimKeyframes.length - 1)) * 100)}% { transform: translate(${k.dx.toFixed(2)}px, 0) rotate(${k.rot.toFixed(2)}deg); }`)
        .join(' ');
      return `@keyframes jar-swim-${f.id} { ${stops} }`;
    })
    .join('\n');
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
  const fishes = useMemo(() => buildFish(), []);
  const swimKeyframeCSS = useMemo(() => buildSwimKeyframeCSS(fishes), [fishes]);

  const waterY = JAR_INTERIOR.baseY - (JAR_INTERIOR.baseY - JAR_INTERIOR.topY) * value;
  const waterHeight = JAR_INTERIOR.baseY - waterY;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      className={`focus-visual ${complete ? 'visual-complete' : ''}`}
      role="img"
      aria-label={`Water jar ${Math.round(value * 100)} percent complete`}
    >
      <defs>
        <style>{`@keyframes jar-bob { from { transform: translateY(0); } to { transform: translateY(-5px); } } ${swimKeyframeCSS}`}</style>
        <clipPath id="jar-inside">
          <path
            d={`M ${JAR_INTERIOR.x} ${JAR_INTERIOR.topY}
                H ${JAR_INTERIOR.x + JAR_INTERIOR.width}
                V ${JAR_INTERIOR.baseY - 30}
                Q ${JAR_INTERIOR.x + JAR_INTERIOR.width} ${JAR_INTERIOR.baseY}
                  ${JAR_INTERIOR.x + JAR_INTERIOR.width - 40} ${JAR_INTERIOR.baseY}
                H ${JAR_INTERIOR.x + 40}
                Q ${JAR_INTERIOR.x} ${JAR_INTERIOR.baseY}
                  ${JAR_INTERIOR.x} ${JAR_INTERIOR.baseY - 30}
                Z`}
          />
        </clipPath>
        <linearGradient id="jar-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fd3ff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#1a6fbf" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="jar-water-surface" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe8ff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#7fd3ff" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      <image href={JAR_SCENE_URL} x="0" y="0" width={VIEW_W} height={VIEW_H} />

      <g clipPath="url(#jar-inside)">
        <rect
          x={JAR_INTERIOR.x}
          y={waterY}
          width={JAR_INTERIOR.width}
          height={waterHeight}
          fill="url(#jar-water)"
        />
        <path
          d={`M ${JAR_INTERIOR.x - 10} ${waterY}
              Q ${JAR_INTERIOR.x + 60} ${waterY - 6}
                ${JAR_INTERIOR.x + 120} ${waterY}
              T ${JAR_INTERIOR.x + 240} ${waterY}
              T ${JAR_INTERIOR.x + 360} ${waterY}
              T ${JAR_INTERIOR.x + 400} ${waterY}`}
          fill="none"
          stroke="url(#jar-water-surface)"
          strokeWidth="6"
          strokeLinecap="round"
          className="jar-wave"
        />
        <path
          d={`M ${JAR_INTERIOR.x - 10} ${waterY + 4}
              Q ${JAR_INTERIOR.x + 60} ${waterY - 2}
                ${JAR_INTERIOR.x + 120} ${waterY + 4}
              T ${JAR_INTERIOR.x + 240} ${waterY + 4}
              T ${JAR_INTERIOR.x + 360} ${waterY + 4}`}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
          strokeLinecap="round"
          className="jar-wave-2"
        />
      </g>

      {fishes.map((f) => {
        const revealed = waterY <= f.revealY;
        const opacity = revealed ? 1 : 0;

        const revealStyle: CSSProperties = {
          opacity,
          transition: reducedMotion ? 'opacity 1.2s ease-out' : 'opacity 1.2s ease-out',
        };

        const bobStyle: CSSProperties = reducedMotion
          ? {}
          : {
              animation: `jar-bob ${f.bobDur}s ease-in-out ${f.bobDelay}s infinite alternate`,
            };

        const swimStyle: CSSProperties = reducedMotion
          ? {}
          : {
              animation: `jar-swim-${f.id} ${f.swimDur}s ease-in-out ${f.swimDelay}s infinite alternate`,
            };

        const scaleTransform = `scale(${f.faceLeft ? -f.scale : f.scale}, ${f.scale})`;

        return (
          <g key={f.id} transform={`translate(${f.startX}, ${f.startY})`} style={revealStyle}>
            <g style={swimStyle}>
              <g style={bobStyle}>
                <g transform={scaleTransform}>
                  <image
                    href={FISH_URL}
                    x={-f.fishW / 2}
                    y={-f.fishH / 2}
                    width={f.fishW}
                    height={f.fishH}
                    filter={`hue-rotate(${f.hue}deg) saturate(${f.saturate}) brightness(${f.brightness})`}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </g>
              </g>
            </g>
          </g>
        );
      })}

      <ellipse
        cx={CENTER_X}
        cy={JAR_INTERIOR.baseY + 20}
        rx={JAR_INTERIOR.width / 2.2}
        ry={12}
        fill="#c5ff54"
        opacity={complete ? 0.28 : 0.05}
        className="visual-finish-glow"
      />
    </svg>
  );
}
