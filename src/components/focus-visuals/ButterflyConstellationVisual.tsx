import { useState } from 'react';
import type { FocusVisualProps } from './types';

/** Artwork shown in place of the constellation canvas, with a live tuner. */
const ART_URL = '/visuals/butterfly/butterfly-art.png';

interface ArtTransform {
  scale: number;
  positionX: number;
  positionY: number;
}

const DEFAULT_ART_TRANSFORM: ArtTransform = {
  scale: 1,
  positionX: 0,
  positionY: 0,
};

const ART_SLIDER_ROWS: {
  key: keyof ArtTransform;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: 'scale', label: 'Zoom', min: 0.3, max: 3, step: 0.01 },
  { key: 'positionX', label: 'Left / Right', min: -40, max: 40, step: 0.5 },
  { key: 'positionY', label: 'Up / Down', min: -40, max: 40, step: 0.5 },
];

/**
 * Butterfly visual, v1 art pass: the provided butterfly artwork fills the
 * frame; the floating tuner adjusts zoom and movement while placement is
 * being tuned. TODO(real pass): once placement is final, hardcode the
 * transform and remove the tuner, then layer the constellation/star
 * choreography on top of this art.
 */
export default function ButterflyConstellationVisual(_props: FocusVisualProps) {
  void _props; // progress/running contract kept for FocusVisual; art pass ignores them
  const [transform, setTransform] = useState<ArtTransform>(DEFAULT_ART_TRANSFORM);

  return (
    <div className="butterfly-constellation focus-visual overflow-hidden" role="img" aria-label="Butterfly constellation">
      <img
        src={ART_URL}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-contain transition-all duration-200"
        style={{
          transform: `translate(${transform.positionX}%, ${transform.positionY}%) scale(${transform.scale})`,
        }}
      />
      <div className="absolute bottom-3 right-3 z-10 w-44 space-y-2.5 rounded-[1rem] border border-white/[.07] bg-black/40 p-3 backdrop-blur-xl">
        <div className="text-[9px] font-bold uppercase tracking-[.2em] text-stone-500">Tuner</div>
        {ART_SLIDER_ROWS.map((row) => (
          <label key={row.key} className="block">
            <span className="flex items-center justify-between text-[10px] font-bold text-stone-300">
              {row.label}
              <span className="font-mono text-[9px] text-stone-500">{transform[row.key].toFixed(1)}</span>
            </span>
            <input
              type="range"
              min={row.min}
              max={row.max}
              step={row.step}
              value={transform[row.key]}
              onChange={(e) => setTransform((t) => ({ ...t, [row.key]: Number(e.target.value) }))}
              className="mt-1 w-full accent-lime-300"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
