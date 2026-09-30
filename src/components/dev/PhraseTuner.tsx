import { useState } from 'react';

interface PhraseTunerState {
  zoom: number;
  x: number;
  y: number;
}

const ROWS: { key: keyof PhraseTunerState; label: string; min: number; max: number; step: number }[] = [
  { key: 'zoom', label: 'Zoom', min: 0.02, max: 0.2, step: 0.002 },
  { key: 'x', label: 'Left / Right', min: 0, max: 1, step: 0.005 },
  { key: 'y', label: 'Up / Down', min: 0, max: 1, step: 0.005 },
];

/**
 * Phrase placement tuner (MountainTuner style): zoom, left/right, up/down
 * sliders over a live letter preview. "Save" prints the values to console.
 */
export default function PhraseTuner() {
  const [transform, setTransform] = useState<PhraseTunerState>({
    zoom: 0.05,
    x: 0.1,
    y: 0.5,
  });

  const onChange = (patch: Partial<PhraseTunerState>) =>
    setTransform((t) => ({ ...t, ...patch }));

  return (
    <>
      {/* Live letter preview */}
      <div
        className="pointer-events-none absolute z-[9999] font-serif italic text-yellow-300 drop-shadow-[0_0_8px_rgba(255,200,0,.8)]"
        style={{
          left: `${transform.x * 100}%`,
          top: `${transform.y * 100}%`,
          fontSize: `${transform.zoom * 100}vh`,
          transform: 'translate(-50%, -50%)',
        }}
        aria-hidden="true"
      >
        A
      </div>

      {/* Tuner panel */}
      <div className="absolute bottom-32 right-4 z-[10000] w-56 max-h-[60vh] space-y-3 overflow-y-auto rounded-[1.2rem] border border-white/[.07] bg-black/60 p-4 backdrop-blur-xl">
        <div className="text-[10px] font-bold uppercase tracking-[.2em] text-stone-500">
          Phrase tuner
        </div>
        {ROWS.map((row) => (
          <label key={row.key} className="block">
            <span className="flex items-center justify-between text-xs font-bold text-stone-300">
              {row.label}
              <span className="font-mono text-[10px] text-stone-500">
                {transform[row.key].toFixed(3)}
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
        <button
          onClick={() => {
            console.log(
              `[phrase tuner] zoom: ${transform.zoom.toFixed(4)}, x: ${transform.x.toFixed(4)}, y: ${transform.y.toFixed(4)}`,
            );
          }}
          className="w-full rounded-xl bg-lime-300 py-2 text-xs font-bold text-[#11130f] transition hover:bg-lime-200"
        >
          Save
        </button>
      </div>
    </>
  );
}
