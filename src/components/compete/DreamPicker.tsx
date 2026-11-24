import { useRef, type ChangeEvent } from "react";
import { Plus, X } from "lucide-react";
import { DEFAULT_DREAM_STRETCH, type DreamStretch } from "./placementConfig";

/** One dream only: to the right of Today's tree, centred in the gap. */
export default function DreamPicker({
  images,
  stretch,
  ringWidth,
  busy = false,
  onAdd,
  onRemove,
}: {
  images: string[];
  /** Kept for compatibility with the old arc tuner. */
  transforms?: unknown;
  stretch?: DreamStretch;
  ringWidth?: number;
  busy?: boolean;
  onAdd: (file: File) => void;
  onRemove: (index: number) => void;
  onHelp?: (anchor: HTMLElement) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasDream = images.length > 0;
  const src = images[0] ?? "";

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onAdd(file);
  };

  return (
    <div
      className="compete-dreams absolute left-[calc(50%+123px)] top-[118px] z-20 -translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2"
      data-tour="dreams"
    >
      <div className="flex w-max flex-col items-center gap-3">
        {hasDream ? (
          <div className="group relative h-20 w-20 sm:h-24 sm:w-24 shrink-0">
            <div className="relative h-full w-full" data-dream-circle>
              <div
                className="h-full w-full rounded-full"
                style={{
                  padding: ringWidth ?? 3,
                  background:
                    "linear-gradient(145deg, #fdf0cd 0%, #f0d089 22%, #cf9f3a 50%, #a87b25 68%, #f2d48f 88%, #fff8e6 100%)",
                }}
              >
                <div className="h-full w-full overflow-hidden rounded-full">
                  <img
                    src={src}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-cover"
                    style={{
                      transform: `scale(${(stretch ?? DEFAULT_DREAM_STRETCH).x}, ${(stretch ?? DEFAULT_DREAM_STRETCH).y})`,
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(0)}
                aria-label="Remove dream image"
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black/80 text-stone-300 transition hover:border-[#f6e3ba]/60 hover:text-[#f6e3ba] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-label="Add dream image"
            data-tour="add-dream"
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-dashed border-[#f6e3ba]/45 text-[#f6e3ba]/70 transition hover:border-[#f6e3ba]/80 hover:bg-[#f6e3ba]/10 hover:text-[#f6e3ba] disabled:opacity-40"
          >
            <Plus className="h-7 w-7 sm:h-8 sm:w-8" />
          </button>
        )}

        <div
          className="flex items-center justify-center whitespace-nowrap text-center text-[12px] font-extrabold uppercase leading-none tracking-[.16em] text-[#f6e3ba] sm:text-[13px]"
          data-tour="dreams-label"
        >
          <span>{hasDream ? "Your dream" : "Add your dream"}</span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
