import { useMemo, useState, useEffect } from 'react';

// Simple seeded random to keep tree stable per session
function LCG(seed: number) {
  let state = seed;
  return function () {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

interface Branch {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
  thickness: number;
  startTime: number;
  duration: number;
}
interface Leaf {
  id: string;
  x: number;
  y: number;
  angle: number;
  spawnTime: number;
  scale: number;
}
interface Fruit {
  id: string;
  x: number;
  y: number;
  spawnTime: number;
}
interface Sparkle {
  id: string;
  x: number;
  y: number;
  spawnTime: number;
}

function generateTree() {
  const rand = LCG(42); // Stable seed

  const branches: Branch[] = [];
  const leaves: Leaf[] = [];
  const fruits: Fruit[] = [];
  const sparkles: Sparkle[] = [];

  function buildBranch(id: string, x: number, y: number, angle: number, length: number, depth: number, maxDepth: number) {
    const startTimes = [0, 0.15, 0.35, 0.60];
    const durations = [0.15, 0.20, 0.25, 0.25];
    const thicknessArray = [7, 4.5, 2.5, 1.5];

    const startTime = startTimes[depth];
    const duration = durations[depth];
    const thickness = thicknessArray[depth];

    const x2 = x + Math.cos(angle) * length;
    const y2 = y + Math.sin(angle) * length;

    branches.push({ id, x1: x, y1: y, x2, y2, length, thickness, startTime, duration });

    // Sparkle at tip when finished drawing
    sparkles.push({ id: `${id}-sp-tip`, x: x2, y: y2, spawnTime: startTime + duration });

    if (depth < maxDepth) {
      const numBranches = Math.floor(rand() * 3) + 2; // 2 to 4 branches
      const spread = 1.4; // ~80 degrees total spread
      const startAngle = angle - spread / 2;
      const step = spread / Math.max(1, numBranches - 1);

      for (let i = 0; i < numBranches; i++) {
        const baseChildAngle = startAngle + step * i;
        const childAngle = baseChildAngle + (rand() - 0.5) * 0.5;
        const childLength = length * (0.65 + rand() * 0.25);
        buildBranch(`${id}-${i}`, x2, y2, childAngle, childLength, depth + 1, maxDepth);
      }
    }

    const numLeaves = depth === 0 ? 0 : Math.floor(rand() * 4) + depth * 2;
    for (let i = 0; i < numLeaves; i++) {
      const t = 0.1 + rand() * 0.8;
      const lx = x + (x2 - x) * t;
      const ly = y + (y2 - y) * t;
      const lAngle = angle + (rand() > 0.5 ? 1 : -1) * (0.5 + rand() * 0.5);

      const pointReachedTime = startTime + duration * t;
      let spawnTime = pointReachedTime + 0.05 + rand() * 0.2;
      if (spawnTime > 0.85) spawnTime = pointReachedTime + 0.05;

      leaves.push({ id: `${id}-l-${i}`, x: lx, y: ly, angle: lAngle, spawnTime, scale: 0.5 + rand() * 0.6 });
      sparkles.push({ id: `${id}-sp-l-${i}`, x: lx, y: ly, spawnTime });
    }

    if (depth >= 2) {
      if (rand() > 0.3) {
        const t = 0.8 + rand() * 0.2;
        const fx = x + (x2 - x) * t;
        const fy = y + (y2 - y) * t;
        const spawnTime = 0.85 + rand() * 0.1; // Fruits appear late
        fruits.push({ id: `${id}-f`, x: fx, y: fy, spawnTime });
        sparkles.push({ id: `${id}-sp-f`, x: fx, y: fy, spawnTime });
      }
    }
  }

  buildBranch('root', 250, 450, -Math.PI / 2, 120, 0, 3);
  return { branches, leaves, fruits, sparkles };
}

export default function ProceduralTreeVisual({ progress }: { progress: number }) {
  const treeData = useMemo(() => generateTree(), []);

  return (
    <svg viewBox="0 0 500 500" className="w-full h-full overflow-visible drop-shadow-[0_0_12px_rgba(246,227,186,0.15)]">
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="fruitGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d9f99d" />
          <stop offset="100%" stopColor="#65a30d" />
        </linearGradient>
        <linearGradient id="fruitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>

      {/* Ground / Soil Mound */}
      <path d="M 170 450 Q 250 420 330 450 Z" fill="#1a1613" />

      {/* Branches */}
      <g filter="url(#glow)">
        {treeData.branches.map((b) => {
          const drawFrac = Math.min(1, Math.max(0, (progress - b.startTime) / b.duration));
          if (drawFrac === 0) return null;
          return (
            <line
              key={b.id}
              x1={b.x1}
              y1={b.y1}
              x2={b.x2}
              y2={b.y2}
              stroke="#f6e3ba"
              strokeWidth={b.thickness}
              strokeLinecap="round"
              strokeDasharray={b.length}
              strokeDashoffset={b.length * (1 - drawFrac)}
              style={{ transition: 'stroke-dashoffset 0.1s linear' }}
            />
          );
        })}
      </g>

      {/* Leaves */}
      <g>
        {treeData.leaves.map((l) => {
          const p = Math.min(1, Math.max(0, (progress - l.spawnTime) / 0.08));
          if (p === 0) return null;
          return (
            <g
              key={l.id}
              transform={`translate(${l.x}, ${l.y}) rotate(${(l.angle * 180) / Math.PI}) scale(${p * l.scale})`}
              opacity={p}
            >
              <path d="M 0 0 Q 12 -15 24 0 Q 12 15 0 0 Z" fill="url(#leafGrad)" />
            </g>
          );
        })}
      </g>

      {/* Fruits */}
      <g filter="url(#fruitGlow)">
        {treeData.fruits.map((f) => {
          const p = Math.min(1, Math.max(0, (progress - f.spawnTime) / 0.1));
          if (p === 0) return null;
          const pulse = progress >= 0.95 ? 1 + 0.08 * Math.sin((progress - 0.95) * 80) : 1;
          return (
            <g key={f.id} transform={`translate(${f.x}, ${f.y}) scale(${p * pulse})`} opacity={p}>
              <circle cx="0" cy="2" r="6" fill="url(#fruitGrad)" />
              <path d="M 0 2 L 0 -6" stroke="#f6e3ba" strokeWidth="1.5" />
            </g>
          );
        })}
      </g>

      {/* Sparkles */}
      <g>
        {treeData.sparkles.map((sp) => {
          const p = (progress - sp.spawnTime) / 0.05;
          if (p <= 0 || p >= 1) return null;
          const scale = p * (1 - p) * 4; // peaks at 1 when p=0.5
          return (
            <g key={sp.id} transform={`translate(${sp.x}, ${sp.y}) scale(${scale})`} opacity={1 - p}>
              <path d="M 0 -8 L 1 -1 L 8 0 L 1 1 L 0 8 L -1 1 L -8 0 L -1 -1 Z" fill="#ffffff" filter="url(#glow)" />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function ProceduralTreeDemo() {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;

    const startTime = performance.now();
    let frameId: number;

    function tick(now: number) {
      const elapsed = (now - startTime) / 1000;
      const p = Math.min(1, elapsed / 30); // 30 seconds
      setProgress(p);
      if (p < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
      }
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#090b0a] font-sans text-white">
      <div className="mb-4 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#f6e3ba]">Compete Tree Preview</h1>
        <p className="text-sm text-stone-400">Pure SVG Procedural Line-Art</p>
      </div>

      <div className="relative h-[65vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-white/5 bg-[#141714]/90 shadow-[0_24px_80px_rgba(0,0,0,.28)]">
        <ProceduralTreeVisual progress={progress} />
      </div>

      <div className="mt-8 flex flex-col items-center gap-5">
        <div className="font-mono text-sm tracking-widest text-stone-500">
          PROGRESS: {(progress * 100).toFixed(1)}%
        </div>
        <button
          onClick={() => {
            setProgress(0);
            setPlaying(true);
          }}
          className="rounded-xl border border-[#c9a24a]/25 bg-[#1a1613] px-6 py-2.5 text-sm font-bold text-[#c9a24a] transition hover:border-[#c9a24a]/40 hover:bg-[#201c17]"
        >
          {playing ? 'Restart Growth' : 'Replay 30s Growth'}
        </button>
      </div>
    </div>
  );
}