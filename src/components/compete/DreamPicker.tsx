import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { DEFAULT_DREAM_STRETCH, type PlacementTransform, type DreamStretch } from './placementConfig';

/** Up to 3 dream circles crown the tree. */
const MAX_DREAM_IMAGES = 3;

/** No-op transform for circles without a tuner entry. */
const IDENTITY: PlacementTransform = { x: 0, y: 0, zoom: 1 };

/** Longest dream name, spaces included. */
const MAX_NAME_LEN = 18;

/**
 * Ambient rose-pink glow behind each circle: soft diffused falloff
 * extending well past the edge — ambient light, not a hard ring.
 */
const GLOW = '0 0 44px 14px rgba(236, 72, 153, 0.25)';

function DreamCircle({
  src,
  name,
  offsetClass = '',
  transform,
  stretch,
  onRemove,
}: {
  src: string;
  /** Dream name shown in the pill under the circle (empty = no pill). */
  name: string;
  /** Arc offset, e.g. sides sit lower than the centre circle. */
  offsetClass?: string;
  /** Per-circle tuner transform (zoom / move X / move Y). */
  transform: PlacementTransform;
  /** Stretch tuner scale for the flat photo (CSS scale inside the clip). */
  stretch: DreamStretch;
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
            inset: '-3px',
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
        {/* Name pill, centred directly under the circle (scales with it). */}
        {name.trim() && (
          <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#f5ede0] px-2.5 py-[3px] text-[8px] font-bold uppercase leading-none tracking-[0.05em] text-[#8a6a3a]">
            {name.trim()}
          </span>
        )}
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
 * gradient ring, a soft rose-pink halo and a cream name pill under each,
 * no cards or labels. Upload flow:
 * add button opens a small panel with a required name input (max 18
 * chars, live counter), then the file picker. Add button sits in the gap
 * while under the max; at 3 images the circles arc around the top of the
 * tree instead of forming a flat row.
 */
export default function DreamPicker({
  images,
  names,
  transforms,
  stretch,
  busy = false,
  onAdd,
  onRemove,
}: {
  images: string[];
  /** Dream names parallel to `images` (index-aligned); missing = no pill. */
  names?: string[];
  /** Per-index transform (zoom / move X / move Y); missing entries = identity. */
  transforms?: PlacementTransform[];
  /** Stretch tuner scale applied to every flat circle photo. */
  stretch?: DreamStretch;
  busy?: boolean;
  onAdd: (file: File, name: string) => void;
  onRemove: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  /** Trimmed, length-capped name — the only name we ever submit. */
  const trimmed = name.trim().slice(0, MAX_NAME_LEN);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !trimmed) return;
    onAdd(file, trimmed);
    setAdding(false);
    setName('');
  };

  const closeAdd = () => {
    setAdding(false);
    setName('');
  };

  const addBtn = (
    <button
      key="add"
      type="button"
      onClick={() => setAdding((a) => !a)}
      disabled={busy}
      aria-label="Add dream image"
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-dashed border-[#f6e3ba]/45 text-[#f6e3ba]/70 transition hover:border-[#f6e3ba]/80 hover:bg-[#f6e3ba]/10 hover:text-[#f6e3ba] disabled:opacity-40 sm:h-16 sm:w-16"
    >
      <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
    </button>
  );

  const circle = (i: number, offsetClass?: string) => (
    <DreamCircle
      key={`dream-${i}`}
      src={images[i]}
      name={names?.[i] ?? ''}
      offsetClass={offsetClass}
      transform={transforms?.[i] ?? IDENTITY}
      stretch={stretch ?? DEFAULT_DREAM_STRETCH}
      onRemove={() => onRemove(i)}
    />
  );

  // Arrangement:
  //  0 → [add] centred; 1 → [add, circle] (circle right of centre);
  //  2 → [circle, add, circle] symmetric with add between;
  //  3 → gentle arc crowning the tree — sides lower, centre highest, no add.
  let items;
  if (images.length >= MAX_DREAM_IMAGES) {
    items = [
      circle(0, 'translate-y-[10px] md:translate-y-[14px]'),
      circle(1),
      circle(2, 'translate-y-[10px] md:translate-y-[14px]'),
    ];
  } else if (images.length === 0) {
    items = [addBtn];
  } else if (images.length === 1) {
    items = [addBtn, circle(0)];
  } else {
    items = [circle(0), addBtn, circle(1)];
  }

  return (
    <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 sm:top-6">
      <div className="flex items-start justify-center gap-3 sm:gap-4">{items}</div>
      {adding && (
        <div className="absolute left-1/2 top-full mt-2 w-56 -translate-x-1/2 rounded-xl border border-[#f6e3ba]/25 bg-[#1c1917]/95 p-3 text-left shadow-xl backdrop-blur">
          <input
            type="text"
            value={name}
            autoFocus
            maxLength={MAX_NAME_LEN}
            placeholder="Dream name"
            aria-label="Dream name (max 18 characters)"
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LEN))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && trimmed && !busy) inputRef.current?.click();
            }}
            className="w-full rounded-lg border border-[#f6e3ba]/25 bg-black/40 px-2.5 py-1.5 text-sm text-stone-200 outline-none placeholder:text-stone-500 focus:border-[#f6e3ba]/60"
          />
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="text-stone-500">Required · max 18 chars</span>
            <span
              className={`tabular-nums ${
                name.length >= MAX_NAME_LEN ? 'text-rose-300' : 'text-stone-400'
              }`}
            >
              {name.length}/{MAX_NAME_LEN}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeAdd}
              className="rounded-lg px-2.5 py-1.5 text-xs text-stone-400 transition hover:text-stone-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!trimmed || busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-[#f6e3ba] px-3 py-1.5 text-xs font-semibold text-[#292524] transition hover:bg-[#f6e3ba]/90 disabled:opacity-40"
            >
              Choose photo
            </button>
          </div>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
