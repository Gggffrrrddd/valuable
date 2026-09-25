import { MOUNTAIN_SLIDER_ROWS, type MountainTransform } from './mountainConfig';

interface MountainTunerProps {
  transform: MountainTransform;
  onChange: (patch: Partial<MountainTransform>) => void;
}

/** Live placement tuner for the Everest model: zoom, left/right, up/down. */
export default function MountainTuner({ transform, onChange }: MountainTunerProps) {
  return (
    <div className="max-h-[70vh] space-y-3 overflow-y-auto rounded-[1.2rem] border border-white/[.07] bg-black/40 p-4 backdrop-blur-xl">
      <div className="text-[10px] font-bold uppercase tracking-[.2em] text-stone-500">
        Mountain tuner
      </div>
      {MOUNTAIN_SLIDER_ROWS.map((row) => (
        <label key={row.key} className="block">
          <span className="flex items-center justify-between text-xs font-bold text-stone-300">
            {row.label}
            <span className="font-mono text-[10px] text-stone-500">
              {transform[row.key].toFixed(2)}
            </span>
          </span>
          <input
            type="range"
            min={row.min}
            max={row.max}
            step={row.step}
            value={transform[row.key]}
            onChange={(e) => onChange({ [row.key]: Number(e.target.value) })}
            className="mt-1.5 w-full accent-lime-300"
          />
        </label>
      ))}
    </div>
  );
}
