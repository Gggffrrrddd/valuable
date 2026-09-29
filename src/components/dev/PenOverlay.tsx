/**
 * Freehand measuring pen for the butterfly focus timer.
 *
 * Press the floating Pen button, then draw ANY shape (line, zig-zag,
 * rectangle, arrows — whatever). On release the whole path is logged to the
 * console in viewport pixels AND as viewport fractions (the unit the garden
 * config uses), plus the bounding box. Esc disarms; a new stroke replaces
 * the previous path.
 */
import { useEffect, useRef, useState } from 'react';

interface Pt {
  x: number;
  y: number;
}

/** Minimum distance (px) between logged points while drawing. */
const MIN_STEP = 5;

export default function PenOverlay() {
  const [armed, setArmed] = useState(false);
  const [path, setPath] = useState<Pt[]>([]);
  const drawingRef = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArmed(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toPoint = (e: React.PointerEvent): Pt => ({ x: e.clientX, y: e.clientY });

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    drawingRef.current = true;
    const p = toPoint(e);
    setPath([p]);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const p = toPoint(e);
    setPath((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < MIN_STEP) return prev;
      return [...prev, p];
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const p = toPoint(e);
    setPath((prev) => {
      const last = prev[prev.length - 1];
      const pts =
        last && Math.hypot(p.x - last.x, p.y - last.y) >= 1 ? [...prev, p] : prev;
      if (pts.length < 2) return prev;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const xs = pts.map((q) => q.x);
      const ys = pts.map((q) => q.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      console.log(
        `[pen] path ${pts.length} pts | bbox (${Math.round(minX)}, ${Math.round(minY)}) - ` +
          `(${Math.round(maxX)}, ${Math.round(maxY)}) px | viewport ${w}x${h}`,
      );
      console.log(
        `[pen] px: ${pts.map((q) => `(${Math.round(q.x)},${Math.round(q.y)})`).join(' ')}`,
      );
      console.log(
        `[pen] frac: ${pts
          .map((q) => `(${(q.x / w).toFixed(3)},${(q.y / h).toFixed(3)})`)
          .join(' ')}`,
      );
      return pts;
    });
  };

  const pointsAttr = path.map((q) => `${q.x},${q.y}`).join(' ');

  return (
    <>
      {/* Drawing surface — only interactive while armed. */}
      <svg
        className={`fixed inset-0 z-[9999] ${armed ? 'cursor-crosshair' : 'pointer-events-none'}`}
        style={{ touchAction: armed ? 'none' : 'auto' }}
        onPointerDown={armed ? onPointerDown : undefined}
        onPointerMove={armed ? onPointerMove : undefined}
        onPointerUp={armed ? onPointerUp : undefined}
      >
        {path.length > 1 && (
          <>
            <polyline
              points={pointsAttr}
              fill="none"
              stroke="#ff3b6b"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 0 6px rgba(255,59,107,0.9))' }}
            />
            <circle cx={path[0].x} cy={path[0].y} r={4} fill="#ff3b6b" stroke="#fff" strokeWidth={1} />
            <circle
              cx={path[path.length - 1].x}
              cy={path[path.length - 1].y}
              r={4}
              fill="#ff3b6b"
              stroke="#fff"
              strokeWidth={1}
            />
          </>
        )}
      </svg>

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
