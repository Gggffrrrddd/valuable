import { useEffect, useState } from 'react';

/**
 * Desktop-only calibration tool for the extended jar backdrop.
 *
 * Shows the new terrarium scene image centered on the viewport with three
 * sliders — X offset (vw), Y offset (vh) and zoom (percentage of viewport
 * width) — plus a compare overlay that puts the original jar scene
 * underneath at 50 % opacity so the framing can be matched exactly by eye.
 *
 * Values persist to localStorage and are displayed in a baked-value readout
 * (copy button) ready to be turned into permanent CSS constants. Remove this
 * component once the match is locked in.
 */

const EXT_SRC = '/visuals/jar/jar-scene-ext-2.png';
const OLD_SRC = '/visuals/jar/jar-scene.png';
const LS_KEY = 'jr-wide-tune-v2';

type Tune = { x: number; y: number; z: number };

const DEFAULTS: Tune = { x: 0, y: 0, z: 100 };

function loadTune(): Tune {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const t = JSON.parse(raw) as Tune;
      if (typeof t?.x === 'number' && typeof t?.y === 'number' && typeof t?.z === 'number') {
        return t;
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

function SliderRow({
  label,
  unit,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  unit: string;
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
        <span className="font-mono text-white">
          {value >= 0 && label !== 'Zoom' ? '+' : ''}
          {value.toFixed(1)}
          {unit}
        </span>
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

export default function JarWideTuner() {
  const [tune, setTune] = useState<Tune>(loadTune);
  const [compare, setCompare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(tune));
    } catch {
      /* ignore */
    }
  }, [tune]);

  const bakeValue = `x=${tune.x.toFixed(2)}vw y=${tune.y.toFixed(2)}vh zoom=${tune.z.toFixed(2)}%`;

  return (
    <>
      <img
        src={EXT_SRC}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute z-0 select-none"
        style={{
          left: '50%',
          top: '50%',
          width: `${tune.z}vw`,
          maxWidth: 'none',
          height: 'auto',
          transform: `translate(calc(-50% + ${tune.x}vw), calc(-50% + ${tune.y}vh))`,
        }}
      />
      {compare && (
        <img
          src={OLD_SRC}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 select-none"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.5 }}
        />
      )}
      <div className="fixed bottom-4 right-4 z-[200] w-72 rounded-xl border border-white/10 bg-black/80 p-4 text-[11px] text-white/80 backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="font-semibold tracking-wide text-white">Jar backdrop tuner</span>
          <button
            type="button"
            onClick={() => setTune(DEFAULTS)}
            className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20"
          >
            Reset
          </button>
        </div>
        <SliderRow
          label="Zoom"
          unit="%"
          min={100}
          max={400}
          step={0.1}
          value={tune.z}
          onChange={(z) => setTune((t) => ({ ...t, z }))}
        />
        <SliderRow
          label="Move X"
          unit="vw"
          min={-100}
          max={100}
          step={0.1}
          value={tune.x}
          onChange={(x) => setTune((t) => ({ ...t, x }))}
        />
        <SliderRow
          label="Move Y"
          unit="vh"
          min={-100}
          max={100}
          step={0.1}
          value={tune.y}
          onChange={(y) => setTune((t) => ({ ...t, y }))}
        />
        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
            className="accent-[#d4a45a]"
          />
          <span>Compare with original (50 %)</span>
        </label>
        <div className="mt-2 select-all rounded bg-white/5 p-2 font-mono text-[10px] leading-relaxed text-[#d4a45a]">
          {bakeValue}
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`x=${tune.x.toFixed(2)} y=${tune.y.toFixed(2)} zoom=${tune.z.toFixed(2)}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* ignore */
            }
          }}
          className="mt-2 w-full rounded bg-white/10 py-1 hover:bg-white/20"
        >
          {copied ? 'Copied!' : 'Copy values'}
        </button>
      </div>
    </>
  );
}
