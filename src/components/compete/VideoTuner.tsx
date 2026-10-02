import { DEFAULT_VIDEO_TRANSFORM, VIDEO_SLIDER_ROWS, type VideoTransform } from './videoConfig';

interface VideoTunerProps {
  transform: VideoTransform;
  onChange: (patch: Partial<VideoTransform>) => void;
}

function logTransform(t: VideoTransform) {
  const line = `{ x: ${t.x}, y: ${t.y}, zoom: ${t.zoom} }`;
  console.log('[compete-video]', line, t);
}

/** Live placement tuner for the Compete video: zoom, left/right, up/down. */
export default function VideoTuner({ transform, onChange }: VideoTunerProps) {
  const update = (patch: Partial<VideoTransform>) => {
    onChange(patch);
    logTransform({ ...transform, ...patch });
  };

  const reset = () => {
    onChange(DEFAULT_VIDEO_TRANSFORM);
    logTransform(DEFAULT_VIDEO_TRANSFORM);
  };

  return (
    <div className="max-h-[70vh] space-y-3 overflow-y-auto rounded-[1.2rem] border border-white/[.07] bg-black/40 p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[.2em] text-stone-500">
          Video tuner
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-bold text-stone-400 transition hover:bg-white/10"
        >
          Reset
        </button>
      </div>
      {VIDEO_SLIDER_ROWS.map((row) => (
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
            onChange={(e) => update({ [row.key]: Number(e.target.value) })}
            className="mt-1.5 w-full accent-lime-300"
          />
        </label>
      ))}
    </div>
  );
}
