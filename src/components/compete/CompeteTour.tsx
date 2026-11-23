import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, X } from 'lucide-react';

interface TourStep {
  id: 'tree' | 'dreams' | 'add' | 'tracker';
  title: string;
  body: string;
  /** First match is the target; all matches are unioned for a highlight box. */
  selectors: string[];
  /** Used when the primary target is unavailable (e.g. "+" at 3 dreams). */
  fallbackSelectors?: string[];
  radius?: number;
  /** Tree step puts the card at the bottom so it never hides the growth. */
  bottomCard?: boolean;
}

const STEPS: TourStep[] = [
  {
    id: 'tree',
    title: 'Your tree',
    body: 'Your tree grows as you focus. Reach your daily goal for full bloom. It resets every midnight.',
    selectors: ['[data-tour="tree"]'],
    radius: 22,
    bottomCard: true,
  },
  {
    id: 'dreams',
    title: 'Your dreams',
    body: "Add what you're working toward — a car, a place, a goal. Seeing it every day keeps you going.",
    selectors: ['[data-dream-circle]', '[data-tour="dreams-label"]'],
    fallbackSelectors: ['[data-tour="dreams"]'],
    radius: 26,
  },
  {
    id: 'add',
    title: 'Add a dream',
    body: 'Tap + to add a dream. Tap × on a dream to remove it.',
    selectors: ['[data-tour="add-dream"]'],
    fallbackSelectors: ['[data-tour="dreams-label"]', '[data-tour="dreams"]'],
    radius: 9999,
  },
  {
    id: 'tracker',
    title: 'Daily tracker',
    body: "Today's tree shows your focus time against your daily goal. The Discipline tracker below your dreams has your full history.",
    selectors: ['[data-tour="tracker"]'],
    radius: 18,
  },
];

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

function unionRect(elements: HTMLElement[]): Box | null {
  if (elements.length === 0) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const el of elements) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (!Number.isFinite(left) || right <= left || bottom <= top) return null;
  return { left, top, width: right - left, height: bottom - top };
}

function targetFor(step: TourStep): Box | null {
  const find = (selectors: string[]) =>
    selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)),
    );
  const primary = unionRect(find(step.selectors));
  if (primary) return primary;
  return step.fallbackSelectors ? unionRect(find(step.fallbackSelectors)) : null;
}

/**
 * One-time coach-mark tour for the Compete screen. Rendered in a body portal
 * so it sits above the mobile header/nav, with a cut-out spotlight on the
 * step's real element and a compact dark-glass card. Outside taps are inert.
 */
export default function CompeteTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1024,
    h: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));
  const nextRef = useRef<HTMLButtonElement>(null);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const addButtonPresent =
    typeof document !== 'undefined' && document.querySelector('[data-tour="add-dream"]') !== null;
  const body =
    current.id === 'add' && !addButtonPresent
      ? 'You already have three dreams. Tap × on a dream to remove one, and the + button returns.'
      : current.body;

  useLayoutEffect(() => {
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setBox(targetFor(current));
        setViewport({ w: window.innerWidth, h: window.innerHeight });
      });
    };
    measure();
    const settle = window.setTimeout(measure, 140);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [current]);

  useEffect(() => {
    nextRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pad = 6;
  const spot = box
    ? {
        left: Math.max(0, box.left - pad),
        top: Math.max(0, box.top - pad),
        width: box.width + pad * 2,
        height: box.height + pad * 2,
      }
    : null;

  const cardWidth = Math.min(330, viewport.w - 24);
  const cardHeight = 196;
  let cardLeft = box ? box.left + box.width / 2 - cardWidth / 2 : viewport.w / 2 - cardWidth / 2;
  cardLeft = clamp(12, cardLeft, viewport.w - cardWidth - 12);

  let cardTop: number;
  if (current.bottomCard) {
    cardTop = viewport.h - cardHeight - 16;
  } else if (box) {
    const below = box.top + box.height + 14;
    const above = box.top - cardHeight - 14;
    cardTop = below + cardHeight <= viewport.h - 12 ? below : above >= 12 ? above : viewport.h - cardHeight - 12;
  } else {
    cardTop = viewport.h / 2 - cardHeight / 2;
  }
  cardTop = clamp(12, cardTop, viewport.h - cardHeight - 12);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Compete guided tour"
      onClick={(e) => e.stopPropagation()}
    >
      {spot ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed"
          style={{
            left: spot.left,
            top: spot.top,
            width: spot.width,
            height: spot.height,
            borderRadius: current.radius ?? 18,
            boxShadow:
              '0 0 0 9999px rgba(0,0,0,.72), 0 0 0 1px rgba(246,227,186,.7), 0 0 34px rgba(246,227,186,.22)',
          }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-black/70" />
      )}

      <div
        className="fixed rounded-[1.15rem] border border-[#f6e3ba]/20 bg-[#12150f]/95 p-4 text-stone-100 shadow-[0_24px_70px_rgba(0,0,0,.65)] backdrop-blur-xl"
        style={{ left: cardLeft, top: cardTop, width: cardWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-bold uppercase tracking-[.2em] text-[#f6e3ba]/80">
            Step {step + 1} of {STEPS.length}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Skip tour"
            className="flex h-6 w-6 items-center justify-center rounded-full text-stone-500 transition hover:bg-white/[.06] hover:text-stone-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <h3 className="mt-2 font-display text-lg font-extrabold tracking-[-.02em] text-stone-50">
          {current.title}
        </h3>
        <p aria-live="polite" className="mt-1.5 text-[12px] leading-5 text-stone-400">
          {body}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-semibold text-stone-500 transition hover:text-stone-300"
          >
            Skip
          </button>
          <button
            ref={nextRef}
            type="button"
            onClick={() => {
              if (last) onClose();
              else setStep((s) => Math.min(STEPS.length - 1, s + 1));
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#f6e3ba] px-4 py-2 text-[11px] font-extrabold text-[#11130f] transition hover:bg-[#fff1cf] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f6e3ba]"
          >
            {last ? 'Got it' : 'Next'}
            {last ? <Check className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
