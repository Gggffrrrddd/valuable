import { useState } from 'react';
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

/** Editable value box: type a precise value — stays in sync with the slider. */
function NumberBox({
  value,
  step,
  onCommit,
}: {
  value: number;
  step: number;
  onCommit: (v: number) => void;
}) {
  const [edit, setEdit] = useState<string | null>(null);
  return (
    <input
      type="number"
      step={step}
      value={edit ?? String(value)}
      onFocus={() => setEdit(String(value))}
      onChange={(e) => {
        setEdit(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== '' && Number.isFinite(n)) onCommit(n);
      }}
      onBlur={() => setEdit(null)}
      className="w-20 rounded-md border border-white/10 bg-black/50 px-1.5 py-0.5 text-right font-mono text-[10px] text-stone-200 outline-none focus:border-lime-300/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
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
            <NumberBox
              value={transform[row.key]}
              step={row.step}
              onCommit={(n) => update({ [row.key]: n } as Partial<T>)}
            />
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
