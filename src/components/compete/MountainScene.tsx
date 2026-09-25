import { stepPositions, RIDGES, PEAK } from './mountainConfig';

interface MountainSceneProps {
  totalSteps: number;
  currentStep: number;
}

const STARS: [number, number][] = [
  [6, 12], [14, 7], [24, 15], [33, 5], [47, 11], [58, 6], [70, 14], [82, 8], [92, 16],
  [10, 24], [38, 21], [66, 24], [88, 27],
];

/**
 * Mountain scene: layered alpine ridges under a night sky, a luminous
 * switchback trail with one node per step, and the climber at current_step.
 *
 * TODO(real assets): replace this render with the 3D mountain scene
 * (mirroring circle-table/TableScene3D.tsx) once models exist:
 * - Mountain + staircase: load via useModelLoader like TableScene3D's table OBJ.
 * - Climber character: swap the climber badge for a SittingCharacter-style
 *   model component, positioned by stepPositions()[currentStep].
 * - Keep mountainConfig.ts as the single source of step positions and ridge
 *   geometry; only the rendering changes, not the progress logic or the
 *   config contract.
 */
export default function MountainScene({ totalSteps, currentStep }: MountainSceneProps) {
  const positions = stepPositions(Math.max(1, totalSteps));
  const safeStep = Math.min(Math.max(0, currentStep), positions.length - 1);
  const climber = positions[safeStep];

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.75rem] border border-white/[.07] bg-[#0b0f16] shadow-[inset_0_1px_0_rgba(255,255,255,.05)] sm:aspect-[16/10]">
      {/* TODO(real assets): sky becomes a graded environment render or image. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_85%_at_68%_-10%,rgba(120,150,210,.16),transparent_55%),linear-gradient(to_bottom,#0d1220_0%,#0b0f16_58%,#090c10_100%)]" />

      {/* Stars: sparse, restrained. */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-70">
        {STARS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 0.22 : 0.14} fill="#cdd6e4" opacity={0.5} />
        ))}
      </svg>

      {/* TODO(real assets): ridges become the terrain mesh / model. */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {/* Atmospheric depth: far ridge lighter, near ridge darkest. */}
        {RIDGES.map((ridge, i) => (
          <polygon key={i} points={ridge.points} fill={ridge.fill} />
        ))}

        {/* Hero summit ridge + moonlit snow cap. */}
        <polygon
          points={`0,100 26,44 40,62 ${PEAK.summitX},${PEAK.summitY} 78,50 100,100`}
          fill="#1b2432"
        />
        <polygon
          points={`${PEAK.summitX},${PEAK.summitY} 64.5,27.5 62.5,29 60,28 58.5,30 56,28.5`}
          fill="#dfe6ef"
          opacity="0.85"
        />
        {/* Rime light on the summit edge. */}
        <polyline
          points={`26,44 40,62 ${PEAK.summitX},${PEAK.summitY}`}
          fill="none"
          stroke="#7d93b8"
          strokeWidth="0.5"
          opacity="0.4"
          strokeLinecap="round"
        />
      </svg>

      {/* Summit beacon. */}
      <div
        className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200/90 shadow-[0_0_18px_6px_rgba(253,230,138,.3)]"
        style={{ left: `${PEAK.summitX}%`, top: `${PEAK.summitY - 2}%` }}
      />

      {/* Switchback trail through every step node. */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <polyline
          points={positions.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="rgba(197,255,84,.14)"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Trail nodes: completed = lit lime ring, upcoming = faint slate pip. */}
      {positions.map((p, i) => (
        <div
          key={i}
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-700 ${
            i <= safeStep
              ? 'h-[1.4%] min-h-[6px] w-[1.4%] min-w-[6px] bg-lime-300 shadow-[0_0_12px_3px_rgba(197,255,84,.3)]'
              : 'h-[1%] min-h-[4px] w-[1%] min-w-[4px] bg-stone-500/40'
          }`}
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
        />
      ))}

      {/* Climber at the current step. TODO(real assets): 3D character. */}
      <div
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-700"
        style={{ left: `${climber.x}%`, top: `${climber.y}%` }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-lime-300/40 bg-[#111a10]/90 shadow-[0_0_24px_rgba(197,255,84,.22)] backdrop-blur">
          <div className="h-2.5 w-2.5 rounded-full bg-lime-300 shadow-[0_0_10px_rgba(197,255,84,.8)]" />
        </div>
      </div>

      {/* Elevation readout. */}
      <div className="absolute bottom-4 left-5 flex items-baseline gap-2">
        <span className="font-display text-2xl font-extrabold tracking-[-.03em] text-stone-50">
          {safeStep}
        </span>
        <span className="text-[11px] font-bold tracking-wide text-stone-500">
          of {totalSteps} steps climbed
        </span>
      </div>
      <div className="absolute bottom-4 right-5 text-[10px] font-bold uppercase tracking-[.2em] text-stone-600">
        Summit ahead
      </div>
    </div>
  );
}
