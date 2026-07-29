import { useEffect, useRef, useState } from 'react';

interface FlipDigitProps {
  value: number;
}

interface DigitTransition {
  from: number;
  to: number;
  id: number;
}

function DigitHalf({ digit, half, animated = false, onAnimationEnd }: {
  digit: number;
  half: 'top' | 'bottom';
  animated?: boolean;
  onAnimationEnd?: () => void;
}) {
  const className = animated
    ? `flip-digit__flap flip-digit__flap--${half}`
    : `flip-digit__face flip-digit__face--${half}`;

  return (
    <div className={className} onAnimationEnd={onAnimationEnd}>
      <span className="flip-digit__number">{digit}</span>
    </div>
  );
}

function FlipDigit({ value }: FlipDigitProps) {
  const [settled, setSettled] = useState(value);
  const [transition, setTransition] = useState<DigitTransition | null>(null);
  const sequenceRef = useRef(0);
  const latestValueRef = useRef(value);
  const [prefersReducedMotion] = useState(() => (
    typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    latestValueRef.current = value;

    if (prefersReducedMotion) {
      setSettled(value);
      setTransition(null);
      return;
    }

    if (!transition && value !== settled) {
      sequenceRef.current += 1;
      setTransition({ from: settled, to: value, id: sequenceRef.current });
    }
  }, [value, settled, transition, prefersReducedMotion]);

  const finishTransition = () => {
    if (!transition) return;
    const completedValue = transition.to;
    setSettled(completedValue);
    setTransition(null);
  };

  const from = transition?.from ?? settled;
  const to = transition?.to ?? settled;

  return (
    <div className={`flip-digit ${transition ? 'flip-digit--active' : ''}`} aria-hidden="true">
      <DigitHalf digit={to} half="top" />
      <DigitHalf digit={from} half="bottom" />

      {transition && (
        <div className="flip-digit__animation" key={transition.id}>
          <DigitHalf digit={from} half="top" animated />
          <DigitHalf digit={to} half="bottom" animated onAnimationEnd={finishTransition} />
        </div>
      )}

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
    <div className="flip-clock-shell">
      <div className="flip-clock-caption" aria-hidden="true">
        <span>Time remaining</span>
        <i />
      </div>
      <div
        className="flip-clock"
        role="timer"
        aria-live="off"
        aria-label={`${String(mm).padStart(2, '0')} minutes ${String(ss).padStart(2, '0')} seconds remaining`}
      >
        <div className="flip-clock-group">
          <FlipDigit value={m1} />
          <FlipDigit value={m2} />
        </div>

        <span className="flip-colon" aria-hidden="true">:</span>

        <div className="flip-clock-group">
          <FlipDigit value={s1} />
          <FlipDigit value={s2} />
        </div>
      </div>
    </div>
  );
}
