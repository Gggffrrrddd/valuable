import { useEffect, useRef, useState } from 'react';

interface FlipDigitProps {
  value: number;
}

const FLIP_DURATION_MS = 520;

function FlipDigit({ value }: FlipDigitProps) {
  const [current, setCurrent] = useState(value);
  const [isFlipping, setIsFlipping] = useState(false);
  const isFlippingRef = useRef(isFlipping);
  const latestValueRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    isFlippingRef.current = isFlipping;
  }, [isFlipping]);

  useEffect(() => {
    latestValueRef.current = value;

    if (prefersReducedMotion) {
      setCurrent(value);
      setIsFlipping(false);
      return;
    }

    if (value === current) {
      if (isFlippingRef.current) setIsFlipping(false);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    setIsFlipping(true);

    timerRef.current = setTimeout(() => {
      setCurrent(latestValueRef.current);
      setIsFlipping(false);
      timerRef.current = null;
    }, FLIP_DURATION_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, current, prefersReducedMotion]);

  const digit = prefersReducedMotion ? value : current;
  const target = prefersReducedMotion ? value : value;

  return (
    <div className="flip-digit" aria-hidden="true">
      {/* Static face showing the settled/current digit */}
      <div className="digit-face digit-face-top">
        <span className="digit-char">{digit}</span>
      </div>
      <div className="digit-face digit-face-bottom">
        <span className="digit-char">{digit}</span>
      </div>

      {/* Animated split-flap overlays — only the changing digits flip */}
      {isFlipping && !prefersReducedMotion && (
        <>
          <div className="flip-flap flip-flap-top">
            <span className="digit-char">{digit}</span>
          </div>
          <div className="flip-flap flip-flap-bottom">
            <span className="digit-char">{target}</span>
          </div>
        </>
      )}

      {/* Subtle seam/glint line at the vertical midpoint */}
      <div className="digit-seam" />
    </div>
  );
}

interface FlipClockProps {
  secondsLeft: number;
}

export default function FlipClock({ secondsLeft }: FlipClockProps) {
  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  const m1 = Math.floor(mm / 10);
  const m2 = mm % 10;
  const s1 = Math.floor(ss / 10);
  const s2 = ss % 10;

  return (
    <div
      className="flip-clock"
      role="timer"
      aria-live="off"
      aria-label={`${String(mm).padStart(2, '0')} minutes ${String(ss).padStart(2, '0')} seconds remaining`}
    >
      <div className="flip-clock-group">
        <FlipDigit value={m1} />
        <FlipDigit value={m2} />
        <span className="flip-clock-label">min</span>
      </div>

      <span className="flip-colon" aria-hidden="true">:</span>

      <div className="flip-clock-group">
        <FlipDigit value={s1} />
        <FlipDigit value={s2} />
        <span className="flip-clock-label">sec</span>
      </div>
    </div>
  );
}
