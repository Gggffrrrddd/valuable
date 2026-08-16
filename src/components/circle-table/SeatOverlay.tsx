import { useEffect, useState } from 'react';
import type { CirclePresenceStatus } from '@/lib/presence';
import { useReducedMotion } from '@/components/focus-visuals/model-core/useReducedMotion';
import {
  FIGURE_URL,
  BOOK_FRAME_URLS,
  BOOK_OPEN_FRAME,
  FIGURE_OVERLAY,
  BOOK_OVERLAY,
  SEAT_STATUS_TEXT,
  type SeatAnchors,
} from './tableConfig';

/** Arrival glow pulse window (~0.5-0.8s settle-in). */
const ARRIVE_MS = 650;
/** Full book open/close sequence: 4 crossfaded steps over ~0.4-0.5s. */
const BOOK_SEQ_MS = 450;
const BOOK_STEP_MS = BOOK_SEQ_MS / BOOK_OPEN_FRAME;

interface SeatOverlayProps {
  seat: SeatAnchors;
  status: CirclePresenceStatus;
  name: string;
}

/**
 * One seat's dynamic layers over the baked scene: the student figure (present
 * whenever the occupant is in any online state) and the book sprite stack
 * (crossfades through the opening frames while a focus session runs).
 *
 * The figure element stays mounted for the screen's lifetime and animates via
 * class swaps — mounting it fresh with the settled class would skip the
 * arrival/exit transitions, since elements don't transition on first paint.
 * An exit while the book is open starts both animations in the same flush, so
 * the closing book and the departing figure complete together.
 */
export default function SeatOverlay({ seat, status, name }: SeatOverlayProps) {
  const reducedMotion = useReducedMotion();
  const present = status !== 'offline';
  const bookOpen = status === 'focusing';

  const [glowing, setGlowing] = useState(false);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (reducedMotion || !present) {
      setGlowing(false);
      return;
    }
    setGlowing(true);
    const timer = setTimeout(() => setGlowing(false), ARRIVE_MS);
    return () => clearTimeout(timer);
  }, [present, reducedMotion]);

  useEffect(() => {
    const target = bookOpen ? BOOK_OPEN_FRAME : 0;
    if (reducedMotion) {
      setFrame(target);
      return;
    }
    let current = frame;
    if (current === target) return;
    const timer = setInterval(() => {
      current += target > current ? 1 : -1;
      setFrame(current);
      if (current === target) clearInterval(timer);
    }, BOOK_STEP_MS);
    return () => clearInterval(timer);
    // `frame` is intentionally not a dependency: the interval walks to target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookOpen, reducedMotion]);

  return (
    <>
      <div
        className="seat-anchor"
        style={{
          left: seat.figure.x - FIGURE_OVERLAY.width / 2,
          top: seat.figure.y - FIGURE_OVERLAY.height / 2,
          width: FIGURE_OVERLAY.width,
          height: FIGURE_OVERLAY.height,
        }}
      >
        <span className="sr-only">{name} is {SEAT_STATUS_TEXT[status]}</span>
        {glowing && <div className="seat-glow" aria-hidden="true" />}
        <div className={`seat-figure ${present ? 'seat-figure--in' : 'seat-figure--out'}`} aria-hidden="true">
          <img src={FIGURE_URL} alt="" draggable={false} />
        </div>
      </div>

      <div
        className="seat-anchor"
        style={{
          left: seat.book.x - BOOK_OVERLAY.width / 2,
          top: seat.book.y - BOOK_OVERLAY.height / 2,
          width: BOOK_OVERLAY.width,
          height: BOOK_OVERLAY.height,
        }}
        aria-hidden="true"
      >
        {BOOK_FRAME_URLS.map((url, i) => (
          <img
            key={url}
            src={url}
            alt=""
            draggable={false}
            className="seat-book-frame"
            style={{ opacity: i === frame ? 1 : 0 }}
          />
        ))}
      </div>
    </>
  );
}
