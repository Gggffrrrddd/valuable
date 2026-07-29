import { useEffect, useRef, useState } from 'react';

const FLIP_MS = 520;
const HALF_MS = FLIP_MS / 2;

type Phase = 'idle' | 'top' | 'bottom';

interface FlipDigitProps {
  value: number;
}

function FlipDigit({ value }: FlipDigitProps) {
  const [display, setDisplay] = useState(value);
  const [phase, setPhase] = useState<Phase>('idle');
  const [oldDigit, setOldDigit] = useState(value);
  const [newDigit, setNewDigit] = useState(value);
  const prevRef = useRef(value);
  const t1 = useRef<ReturnType<typeof setTimeout>>();
  const t2 = useRef<ReturnType<typeof setTimeout>>();
  const [reduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (value === prevRef.current) return;
    if (reduced) { setDisplay(value); prevRef.current = value; return; }

    const old = prevRef.current;
    prevRef.current = value;

    clearTimeout(t1.current);
    clearTimeout(t2.current);

    setPhase('top');
    setOldDigit(old);
    setNewDigit(value);

    t1.current = setTimeout(() => {
      setDisplay(value);
      setPhase('bottom');
    }, HALF_MS);

    t2.current = setTimeout(() => {
      setPhase('idle');
    }, FLIP_MS);

    return () => { clearTimeout(t1.current); clearTimeout(t2.current); };
  }, [value, reduced]);

  return (
    <div className="flip-card" aria-hidden="true">
      <div className="flip-card__half flip-card__half--top">
        <span className="flip-card__char">{display}</span>
      </div>
      <div className="flip-card__half flip-card__half--bottom">
        <span className="flip-card__char">{display}</span>
      </div>

      {phase === 'top' && (
        <div className="flip-card__flap flip-card__flap--top">
          <span className="flip-card__char">{oldDigit}</span>
        </div>
      )}

      {phase === 'bottom' && (
        <div className="flip-card__flap flip-card__flap--bottom">
          <span className="flip-card__char">{newDigit}</span>
        </div>
      )}

      <div className="flip-card__divider" />
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
