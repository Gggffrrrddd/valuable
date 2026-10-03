import type { SliderRow } from './placementConfig';

interface PlacementTunerProps<T extends { [K in keyof T]: number }> {
  title: string;
  /** Console log tag, e.g. "compete-video". */
  logTag: string;
  transform: T;
  rows: SliderRow<T>[];
  defaults: T;
  onChange: (patch: Partial<T>) => void;
}

function logValues<T extends { [K in keyof T]: number }>(logTag: string, t: T) {
  const line = Object.entries(t)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  console.log(`[${logTag}]`, `{ ${line} }`, t);
}

/** Live placement tuner: zoom, left/right, up/down — used for video and image. */
export default function PlacementTuner<T extends { [K in keyof T]: number }>({
  title,
  logTag,
  transform,
  rows,
  defaults,
  onChange,
}: PlacementTunerProps<T>) {
  const update = (patch: Partial<T>) => {
    onChange(patch);
    logValues(logTag, { ...transform, ...patch });
  };

  const reset = () => {
    onChange(defaults);
    logValues(logTag, defaults);
  };

  return (
    <div className="max-h-[70vh] space-y-3 overflow-y-auto rounded-[1.2rem] border border-white/[.07] bg-black/40 p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[.2em] text-stone-500">
          {title}
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-bold text-stone-400 transition hover:bg-white/10"
        >
          Reset
        </button>
      </div>
      {rows.map((row) => (
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
            onChange={(e) => update({ [row.key]: Number(e.target.value) } as Partial<T>)}
            className="mt-1.5 w-full accent-lime-300"
          />
        </label>
      ))}
    </div>
  );
}
