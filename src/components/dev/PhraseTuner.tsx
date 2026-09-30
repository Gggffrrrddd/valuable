import { useState } from 'react';

interface PhraseTunerState {
  zoom: string;
  x: string;
  y: string;
}

const ROWS: { key: keyof PhraseTunerState; label: string; min: number; max: number; step: number }[] = [
  { key: 'zoom', label: 'Zoom', min: 0.02, max: 0.2, step: 0.002 },
  { key: 'x', label: 'Left / Right', min: 0, max: 1, step: 0.005 },
  { key: 'y', label: 'Up / Down', min: 0, max: 1, step: 0.005 },
];

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function toNum(raw: string, fallback: number) {
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Phrase placement tuner (MountainTuner style): zoom, left/right, up/down.
 * Sliders for quick moves + editable number boxes for precise values.
 * Tuned values are hardcoded in garden/config.ts (PHRASE).
 */
export default function PhraseTuner() {
  const [state, setState] = useState<PhraseTunerState>({ zoom: '0.058', x: '0.185', y: '0.420' });

  const num = (key: keyof PhraseTunerState) => {
    const row = ROWS.find((r) => r.key === key)!;
    return clamp(toNum(state[key], row.min), row.min, row.max);
  };

  const setSlider = (key: keyof PhraseTunerState, v: number) =>
    setState((s) => ({ ...s, [key]: v.toFixed(3) }));

  const setBox = (key: keyof PhraseTunerState, raw: string) =>
    setState((s) => ({ ...s, [key]: raw }));

  const normalize = (key: keyof PhraseTunerState) => {
    const row = ROWS.find((r) => r.key === key)!;
    setState((s) => ({ ...s, [key]: clamp(toNum(s[key], row.min), row.min, row.max).toFixed(3) }));
  };

  return (
    <>
      {/* Live letter preview */}
      <div
        className="pointer-events-none fixed z-[100] font-serif italic text-yellow-300 drop-shadow-[0_0_8px_rgba(255,200,0,.8)]"
        style={{
          left: `${num('x') * 100}%`,
          top: `${num('y') * 100}%`,
          fontSize: `${num('zoom') * 100}vh`,
          transform: 'translate(-50%, -50%)',
        }}
        aria-hidden="true"
      >
        A
      </div>

      {/* Tuner panel */}
      <div className="fixed bottom-32 right-4 z-[100] w-60 space-y-3 rounded-[1.2rem] border border-white/[.07] bg-black/70 p-4 backdrop-blur-xl">
        <div className="text-[10px] font-bold uppercase tracking-[.2em] text-stone-500">
          Phrase tuner
        </div>
        {ROWS.map((row) => (
          <label key={row.key} className="block">
            <span className="flex items-center justify-between text-xs font-bold text-stone-300">
              {row.label}
              <input
                type="text"
                inputMode="decimal"
                value={state[row.key]}
                onChange={(e) => setBox(row.key, e.target.value)}
                onBlur={() => normalize(row.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') normalize(row.key);
                }}
                className="w-16 rounded-md border border-white/15 bg-black/60 px-1.5 py-0.5 text-right font-mono text-[10px] text-lime-200 outline-none focus:border-lime-300"
              />
            </span>
            <input
              type="range"
              min={row.min}
              max={row.max}
              step={row.step}
              value={num(row.key)}
              onChange={(e) => setSlider(row.key, Number(e.target.value))}
              className="mt-1.5 w-full accent-lime-300"
            />
          </label>
        ))}
      </div>
    </>
  );
}
