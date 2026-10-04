import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Plus, X } from 'lucide-react';

/** Up to 3 dream circles crown the tree. */
const MAX_DREAM_IMAGES = 3;

/**
 * Ambient gold glow behind each circle: soft radial falloff extending past
 * the edge — light from behind, not a drawn ring. No border on the circle.
 */
const GLOW = '0 0 40px 12px rgba(246, 227, 186, 0.25)';

function DreamCircle({
  src,
  offsetClass = '',
  onRemove,
}: {
  src: string;
  /** Arc offset, e.g. sides sit lower than the centre circle. */
  offsetClass?: string;
  onRemove: () => void;
}) {
  return (
    <div className={`group relative h-14 w-14 shrink-0 sm:h-16 sm:w-16 ${offsetClass}`}>
      <img
        src={src}
        alt=""
        draggable={false}
        className="h-full w-full rounded-full object-cover"
        style={{ boxShadow: GLOW }}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove dream image"
        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-black/75 text-stone-300 transition hover:border-[#f6e3ba]/60 hover:text-[#f6e3ba] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/**
 * Bare circular dream images above the tree — soft gold halo, no cards or
 * labels. Add button sits in the gap while under the max; at 3 images the
 * circles arc around the top of the tree instead of forming a flat row.
 */
export default function DreamPicker({
  images,
  busy = false,
  onAdd,
  onRemove,
}: {
  images: string[];
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

  const circle = (i: number, offsetClass?: string) => (
    <DreamCircle
      key={`dream-${i}`}
      src={images[i]}
      offsetClass={offsetClass}
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
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
