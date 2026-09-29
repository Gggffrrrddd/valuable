/**
 * Measuring pen — always available on every screen.
 *
 * Press the floating Pen button, drag to mark a straight line; the endpoints
 * are logged to the console in viewport pixels AND as fractions of the
 * viewport (the unit the garden config uses). Esc disarms, the marked line
 * stays on screen until the next stroke.
 */
import { useEffect, useRef, useState } from 'react';

interface Pt {
  x: number;
  y: number;
}

export default function PenOverlay() {
  const [armed, setArmed] = useState(false);
  const [line, setLine] = useState<{ a: Pt; b: Pt } | null>(null);
  const startRef = useRef<Pt | null>(null);

  useEffect(() => {
    console.log(
      `[pen] ready — viewport ${window.innerWidth}x${window.innerHeight}. ` +
        'Press the Pen button (bottom right), drag to mark a line, Esc to disarm.',
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArmed(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pointerPos = (e: React.PointerEvent): Pt => ({ x: e.clientX, y: e.clientY });

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const p = pointerPos(e);
    startRef.current = p;
    setLine({ a: p, b: p });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const start = startRef.current;
    if (!start) return;
    setLine({ a: start, b: pointerPos(e) });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;
    const end = pointerPos(e);
    if (Math.abs(start.x - end.x) < 2 && Math.abs(start.y - end.y) < 2) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const len = Math.hypot(end.x - start.x, end.y - start.y);
    const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
    console.log(
      `[pen] line (${start.x}, ${start.y}) -> (${end.x}, ${end.y}) px | ` +
        `frac (${(start.x / w).toFixed(4)}, ${(start.y / h).toFixed(4)}) -> ` +
        `(${(end.x / w).toFixed(4)}, ${(end.y / h).toFixed(4)}) | ` +
        `len ${len.toFixed(1)}px angle ${angle.toFixed(1)}deg | viewport ${w}x${h}`,
    );
  };

  let geometry: { left: number; top: number; width: number; rotate: number } | null = null;
  if (line) {
    const dx = line.b.x - line.a.x;
    const dy = line.b.y - line.a.y;
    geometry = {
      left: line.a.x,
      top: line.a.y,
      width: Math.hypot(dx, dy),
      rotate: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
  }

  return (
    <>
      {/* Drawing surface — only interactive while armed. */}
      <div
        className={`fixed inset-0 z-[9999] ${armed ? 'cursor-crosshair' : 'pointer-events-none'}`}
        style={{ touchAction: armed ? 'none' : 'auto' }}
        onPointerDown={armed ? onPointerDown : undefined}
        onPointerMove={armed ? onPointerMove : undefined}
        onPointerUp={armed ? onPointerUp : undefined}
      >
        {line && geometry && (
          <>
            <div
              className="absolute h-0.5 bg-[#ff3b6b] shadow-[0_0_8px_rgba(255,59,107,0.9)]"
              style={{
                left: geometry.left,
                top: geometry.top - 1,
                width: geometry.width,
                transformOrigin: 'left center',
                transform: `rotate(${geometry.rotate}deg)`,
              }}
            />
            <div
              className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[#ff3b6b]"
              style={{ left: line.a.x, top: line.a.y }}
            />
            <div
              className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[#ff3b6b]"
              style={{ left: line.b.x, top: line.b.y }}
            />
          </>
        )}
      </div>

      {/* Toggle */}
      <button
        onClick={() => setArmed((v) => !v)}
        className={`fixed bottom-24 right-4 z-[10000] rounded-full px-3.5 py-2 text-xs font-bold shadow-lg transition ${
          armed ? 'bg-[#ff3b6b] text-white' : 'bg-black/70 text-stone-300 ring-1 ring-white/20'
        }`}
        style={{ backdropFilter: 'blur(8px)' }}
      >
        {armed ? 'Pen: on' : 'Pen'}
      </button>
    </>
  );
}
