import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { DEFAULT_DREAM_STRETCH, type PlacementTransform, type DreamStretch } from './placementConfig';

/** Up to 3 dream circles crown the tree. */
const MAX_DREAM_IMAGES = 3;

/** No-op transform for circles without a tuner entry. */
const IDENTITY: PlacementTransform = { x: 0, y: 0, zoom: 1 };

/**
 * Ambient rose-pink glow behind each circle: soft diffused falloff
 * extending well past the edge — ambient light, not a hard ring.
 */
const GLOW = '0 0 44px 14px rgba(236, 72, 153, 0.25)';

function DreamCircle({
  src,
  offsetClass = '',
  transform,
  stretch,
  ringWidth,
  onRemove,
}: {
  src: string;
  /** Arc offset, e.g. sides sit lower than the centre circle. */
  offsetClass?: string;
  /** Per-circle tuner transform (zoom / move X / move Y). */
  transform: PlacementTransform;
  /** Stretch tuner scale for the flat photo (CSS scale inside the clip). */
  stretch: DreamStretch;
  /** Gold ring thickness in base px (tuner; scales with the transform). */
  ringWidth: number;
  onRemove: () => void;
}) {
  return (
    <div className={`group relative h-14 w-14 shrink-0 sm:h-16 sm:w-16 ${offsetClass}`}>
      <div
        className="relative h-full w-full"
        style={{
          transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.zoom})`,
        }}
      >
        {/* Premium gold gradient ring (rose-pink glow radiates from it)
            behind the flat photo circle; both scale with the transform. */}
        <div
          className="absolute rounded-full"
          style={{
            inset: `-${ringWidth}px`,
            background:
              'linear-gradient(145deg, #fdf0cd 0%, #f0d089 22%, #cf9f3a 50%, #a87b25 68%, #f2d48f 88%, #fff8e6 100%)',
            boxShadow: GLOW,
          }}
        />
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <img
            src={src}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
            style={{ transform: `scale(${stretch.x}, ${stretch.y})` }}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove dream image"
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-black/75 text-stone-300 transition hover:border-[#f6e3ba]/60 hover:text-[#f6e3ba] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/**
 * Dream circles above the tree — flat photo circles with a premium gold
 * gradient ring and a soft rose-pink halo, no cards or labels. Add button
 * sits in the gap while under the max; at 3 images the circles arc around
 * the top of the tree instead of forming a flat row.
 */
export default function DreamPicker({
  images,
  transforms,
  stretch,
  ringWidth,
  busy = false,
  onAdd,
  onRemove,
}: {
  images: string[];
  /** Per-index transform (zoom / move X / move Y); missing entries = identity. */
  transforms?: PlacementTransform[];
  /** Stretch tuner scale applied to every flat circle photo. */
  stretch?: DreamStretch;
  /** Gold ring thickness in base px (temporary tuner). */
  ringWidth?: number;
  busy?: boolean;
  onAdd: (file: File) => void;
  onRemove: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onAdd(file);
  };

  const addBtn = (
    <button
      key="add"
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={busy}
      aria-label="Add dream image"
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-dashed border-[#f6e3ba]/45 text-[#f6e3ba]/70 transition hover:border-[#f6e3ba]/80 hover:bg-[#f6e3ba]/10 hover:text-[#f6e3ba] disabled:opacity-40 sm:h-16 sm:w-16"
    >
      <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
    </button>
  );

  const circle = (i: number, offsetClass?: string, transform?: PlacementTransform) => (
    <DreamCircle
      key={`dream-${i}`}
      src={images[i]}
      offsetClass={offsetClass}
      transform={transform ?? transforms?.[i] ?? IDENTITY}
      stretch={stretch ?? DEFAULT_DREAM_STRETCH}
      ringWidth={ringWidth ?? 3}
      onRemove={() => onRemove(i)}
    />
  );

  // Arrangement (arc slots: 0 = left/lower, 1 = centre/highest, 2 = right/lower):
  //  0 → [add] centred; 1 → [centre circle] alone;
  //  2 → [left circle, right circle] symmetric, middle removed;
  //  3 → gentle arc crowning the tree — sides lower, centre highest, no add.
  // A compact add button sits under the row while under the max.
  const arcSideClass = 'translate-y-[10px] md:translate-y-[14px]';
  let items;
  if (images.length >= MAX_DREAM_IMAGES) {
    items = [
      circle(0, arcSideClass, transforms?.[0]),
      circle(1, undefined, transforms?.[1]),
      circle(2, arcSideClass, transforms?.[2]),
    ];
  } else if (images.length === 0) {
    items = [addBtn];
  } else if (images.length === 1) {
    items = [circle(0, undefined, transforms?.[1])];
  } else {
    items = [circle(0, arcSideClass, transforms?.[0]), circle(1, arcSideClass, transforms?.[2])];
  }

  return (
    <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 sm:top-6">
      <div className="flex origin-top scale-[.85] items-start justify-center gap-3 sm:scale-100 sm:gap-4">{items}</div>
      {(images.length === 1 || images.length === 2) && (
        <button
          key="add-mini"
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label="Add dream image"
          className="mx-auto mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#f6e3ba]/60 transition hover:text-[#f6e3ba] disabled:opacity-40"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
