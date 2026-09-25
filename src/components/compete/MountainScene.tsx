import { stepPositions, COMPETE_ASSETS } from './mountainConfig';

interface MountainSceneProps {
  totalSteps: number;
  currentStep: number;
}

/**
 * PLACEHOLDER mountain scene: gradient sky + SVG winding path with one marker
 * per step, and the climber parked at current_step.
 *
 * TODO(real assets): replace this whole render with the 3D mountain scene
 * (mirroring circle-table/TableScene3D.tsx) once models exist:
 * - Mountain + staircase: load via useModelLoader like TableScene3D's table OBJ.
 * - Climber character: swap the avatar <img> for a SittingCharacter-style
 *   model component, positioned by stepPositions()[currentStep].
 * - Keep mountainConfig.ts as the single source of step positions; only the
 *   rendering changes, not the progress logic or the config contract.
 */
export default function MountainScene({ totalSteps, currentStep }: MountainSceneProps) {
  const positions = stepPositions(Math.max(1, totalSteps));
  const safeStep = Math.min(Math.max(0, currentStep), positions.length - 1);
  const climber = positions[safeStep];
  const pathPoints = positions.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.6rem] border border-white/[.07] bg-gradient-to-b from-[#1a2233] via-[#131a26] to-[#0a0d0c] sm:aspect-[16/10]">
      {/* TODO(real assets): background becomes a sky/terrain render or image. */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        {/* Placeholder mountain silhouette behind the path. */}
        <polygon
          points="0,100 26,44 40,62 58,18 78,50 100,100"
          fill="#10151c"
          stroke="#232b36"
          strokeWidth="0.4"
        />
        {/* Winding path through every step marker. */}
        <polyline
          points={pathPoints}
          fill="none"
          stroke="rgba(197,255,84,.25)"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeDasharray="2.4 2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Step markers: placeholder PNGs; real markers = swap the asset file. */}
      {positions.map((p, i) => (
        <img
          key={i}
          src={COMPETE_ASSETS.stepMarker}
          alt=""
          className="absolute h-[6%] w-[6%] -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            opacity: i <= safeStep ? 1 : 0.28,
          }}
        />
      ))}

      {/* Climber marker at the current step. TODO(real assets): 3D character. */}
      <img
        src={COMPETE_ASSETS.climber}
        alt="Your climber"
        className="absolute z-10 h-[9%] w-[9%] -translate-x-1/2 -translate-y-1/2 transition-all duration-700"
        style={{ left: `${climber.x}%`, top: `${climber.y}%` }}
      />

      <div className="absolute bottom-3 left-4 font-display text-xs font-bold tracking-wide text-stone-500">
        {safeStep} / {totalSteps} steps to the summit
      </div>
    </div>
  );
}
