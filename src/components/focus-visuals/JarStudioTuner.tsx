import { useEffect, useState } from 'react';

/**
 * Desktop-only calibration tool for the jar's studio backdrop image.
 *
 * Unlike the hourglass tuner, values live in SCENE coordinates (the jar
 * scene's 1672x941 space, zoom as % on top of the cover-fit) so the exact
 * same crop applies on the mobile fixed stage — tune once, both agree.
 *
 * Tuned values persist to localStorage ('jr-studio-tune-v1') and
 * JarVisual applies them live (custom window event). Copy the readout and
 * hand the numbers over to be hard-baked; remove this component then.
 */

const LS_KEY = 'jr-studio-tune-v2';
export const JAR_STUDIO_TUNE_EVENT = 'jr-studio-tune';

type Tune = { z: number; x: number; y: number };

const DEFAULTS: Tune = { z: 100, x: 0, y: 0 };

export function readStudioTune(): Tune {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const t = JSON.parse(raw) as Tune;
      if (typeof t?.z === 'number' && typeof t?.x === 'number' && typeof t?.y === 'number') return t;
    }
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

function SliderRow({ label, min, max, step, value, onChange }: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mt-2 block">
      <div className="flex items-center justify-between">
        <span className="tracking-wide">{label}</span>
        <span className="font-mono text-white">{value >= 0 ? '+' : ''}{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-1 w-full accent-[#d4a45a]"
      />
    </label>
  );
}

export default function JarStudioTuner() {
  const [tune, setTune] = useState<Tune>(readStudioTune);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(tune));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(JAR_STUDIO_TUNE_EVENT));
  }, [tune]);

  return (
    <div className="fixed bottom-4 right-4 z-[200] w-72 rounded-xl border border-white/10 bg-black/80 p-4 text-[11px] text-white/80 backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="font-semibold tracking-wide text-white">Jar studio-bg tuner</span>
        <button
          type="button"
          onClick={() => setTune(DEFAULTS)}
          className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20"
        >
          Reset
        </button>
      </div>
      <SliderRow label="Zoom (%)" min={100} max={400} step={0.5} value={tune.z} onChange={(z) => setTune((t) => ({ ...t, z }))} />
      <SliderRow label="Move X (scene px)" min={-600} max={600} step={1} value={tune.x} onChange={(x) => setTune((t) => ({ ...t, x }))} />
      <SliderRow label="Move Y (scene px)" min={-500} max={500} step={1} value={tune.y} onChange={(y) => setTune((t) => ({ ...t, y }))} />
      <div className="mt-2 select-all rounded bg-white/5 p-2 font-mono text-[10px] leading-relaxed text-[#d4a45a]">
        {`z=${tune.z.toFixed(2)} x=${tune.x.toFixed(0)} y=${tune.y.toFixed(0)}`}
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(`z=${tune.z.toFixed(2)} x=${tune.x.toFixed(0)} y=${tune.y.toFixed(0)} (scale=${(tune.z / 100).toFixed(4)})`);
          } catch {
            /* ignore */
          }
        }}
        className="mt-2 w-full rounded bg-white/10 py-1 hover:bg-white/20"
      >
        Copy values
      </button>
    </div>
  );
}
