import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, X } from 'lucide-react';

const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Small anchored help popover for the Compete labels. It is portalled above
 * the mobile chrome, closes on outside tap or Escape, and links to the tour.
 */
export default function CompeteHelp({
  anchor,
  title,
  body,
  onClose,
  onReplay,
}: {
  anchor: HTMLElement | null;
  title: string;
  body: string;
  onClose: () => void;
  onReplay: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 12, width: 300 });

  useLayoutEffect(() => {
    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(300, vw - 24);
      const rect = anchor?.getBoundingClientRect();
      let left = rect ? rect.left + rect.width / 2 - width / 2 : vw / 2 - width / 2;
      left = clamp(12, left, vw - width - 12);
      let top = rect ? rect.bottom + 10 : vh / 2 - 95;
      if (top + 210 > vh - 12) top = rect ? rect.top - 220 : vh - 222;
      top = clamp(12, top, vh - 222);
      setPosition({ left, top, width });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [anchor]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[110] bg-black/10"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="false"
        aria-label={title}
        className="fixed max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-[1.1rem] border border-[#f6e3ba]/20 bg-[#12150f]/95 p-4 text-stone-100 shadow-[0_22px_60px_rgba(0,0,0,.6)] backdrop-blur-xl"
        style={{ left: position.left, top: position.top, width: position.width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="text-[10px] font-bold uppercase tracking-[.2em] text-[#f6e3ba]/80">
            {title}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-stone-500 transition hover:bg-white/[.06] hover:text-stone-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="mt-2 text-[12px] leading-5 text-stone-400">{body}</p>

        <button
          type="button"
          onClick={onReplay}
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#f6e3ba] transition hover:text-[#fff1cf] hover:underline hover:underline-offset-4"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Replay tour
        </button>
      </div>
    </div>,
    document.body,
  );
}
