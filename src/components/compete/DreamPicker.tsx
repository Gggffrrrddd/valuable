import { useRef, type ReactNode } from 'react';
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
        {/* Premium gold gradient ring (rose-pink glow radiates from it):
            padding-band so the ring is always a clean uniform circle,
            photo clipped inside. */}
        <div
          className="h-full w-full rounded-full"
          style={{
            padding: ringWidth,
            background:
              'linear-gradient(145deg, #fdf0cd 0%, #f0d089 22%, #cf9f3a 50%, #a87b25 68%, #f2d48f 88%, #fff8e6 100%)',
            boxShadow: GLOW,
          }}
        >
          <div className="h-full w-full overflow-hidden rounded-full">
            <img
              src={src}
              alt=""
              draggable={false}
              className="h-full w-full object-cover"
              style={{ transform: `scale(${stretch.x}, ${stretch.y})` }}
            />
          </div>
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

  const addBtn = (key: string, extraClass = '') => (
    <button
      key={key}
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={busy}
      aria-label="Add dream image"
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-dashed border-[#f6e3ba]/45 text-[#f6e3ba]/70 transition hover:border-[#f6e3ba]/80 hover:bg-[#f6e3ba]/10 hover:text-[#f6e3ba] disabled:opacity-40 sm:h-16 sm:w-16 ${extraClass}`}
    >
      <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
    </button>
  );

  // Circle for image i placed on arc slot s (0 = left, 1 = middle, 2 = right).
  // The slot transform is the exact hardcoded value — never altered here.
  const circle = (i: number, slotIdx: number, offsetClass?: string) => (
    <DreamCircle
      key={`dream-${i}`}
      src={images[i]}
      offsetClass={offsetClass}
      transform={transforms?.[slotIdx] ?? IDENTITY}
      stretch={stretch ?? DEFAULT_DREAM_STRETCH}
      ringWidth={ringWidth ?? 3}
      onRemove={() => onRemove(i)}
    />
  );

  // Plus is deliberately smaller than dream circles (same box keeps the
  // slot-transform alignment exact; the shrink happens via scale).
  const PLUS_SCALE = 0.7;
  // Plus button pinned to an arc slot (always clickable). It follows the
  // slot transform so it sits in the visible tree area on both platforms
  // — never stranded at the row top behind the mobile header. liftPct
  // raises it above the slot (1-image peek).
  const plusAt = (key: string, slotIdx: number, liftPct = 0) => {
    const t = transforms?.[slotIdx] ?? IDENTITY;
    return (
      <div
        key={key}
        className="absolute left-1/2 top-0"
        style={{
          transform: `translate(-50%, ${liftPct}%) translate(${t.x}%, ${t.y}%) scale(${t.zoom * PLUS_SCALE})`,
        }}
      >
        {addBtn(`${key}-btn`)}
      </div>
    );
  };

  // Arrangement (derived from count → removing images reverses it):
  //  0 → plus in the middle slot (where the middle dream would be);
  //  1 → first dream in the middle slot, plus peeking just above it;
  //  2 → dreams on the side slots, plus in the middle slot;
  //  3 → full arc, no plus.
  // The row itself never moves, so circles land exactly on the
  // hardcoded desktop / mobile slot values.
  let items: ReactNode[];
  let plus: ReactNode = null;
  if (images.length >= MAX_DREAM_IMAGES) {
    items = [
      circle(0, 0, 'translate-y-[10px] md:translate-y-[14px]'),
      circle(1, 1),
      circle(2, 2, 'translate-y-[10px] md:translate-y-[14px]'),
    ];
  } else if (images.length === 0) {
    items = [];
    plus = plusAt('add', 1);
  } else if (images.length === 1) {
    items = [circle(0, 1)];
    // Lifted clear above the dream: full plus visible, bottom edge just
    // kissing the dream top (header is far above this spot).
    plus = plusAt('add', 1, -120);
  } else {
    items = [circle(0, 0), circle(1, 2)];
    plus = plusAt('add', 1);
  }

  return (
    <div className="compete-dreams absolute left-1/2 top-4 z-20 -translate-x-1/2 sm:top-6">
      <div className="relative flex items-start justify-center gap-3 sm:gap-4">
        {plus}
        {items}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
