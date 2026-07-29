import { useEffect, useRef, useState } from 'react';

const FULL_MS = 520;
const HALF_MS = 260;

type Phase = 'idle' | 'top' | 'bottom';

function FlipDigit({ value }: { value: number }) {
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
    if (reduced) { setDisplay(value); prevRef.current = value; return; }
    if (value === prevRef.current) return;

    const old = prevRef.current;
    prevRef.current = value;

    clearTimeout(t1.current);
    clearTimeout(t2.current);

    setOldDigit(old);
    setNewDigit(value);
    setPhase('top');

    t1.current = setTimeout(() => {
      setDisplay(value);
      setPhase('bottom');
    }, HALF_MS);

    t2.current = setTimeout(() => {
      setPhase('idle');
    }, FULL_MS);

    return () => { clearTimeout(t1.current); clearTimeout(t2.current); };
  }, [value, reduced]);

  return (
    <div className="flip-card">
      <div className="flip-card__static-top">
        <span className="flip-card__digit">{display}</span>
      </div>
      <div className="flip-card__static-bottom">
        <span className="flip-card__digit">{display}</span>
      </div>

      {phase === 'top' && (
        <div className="flip-card__flap-top">
          <span className="flip-card__digit">{oldDigit}</span>
        </div>
      )}

      {phase === 'bottom' && (
        <div className="flip-card__flap-bottom">
          <span className="flip-card__digit">{newDigit}</span>
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
