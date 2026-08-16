import { useEffect, useRef, useState } from 'react';
import SeatOverlay from './SeatOverlay';
import { SCENE, SEATS } from './tableConfig';
import type { CirclePresenceStatus } from '@/lib/presence';

export interface SeatOccupant {
  id: string;
  name: string;
  status: CirclePresenceStatus;
}

interface TableSceneProps {
  /** Seat 1 occupant — the current user, always present while the screen shows. */
  self: SeatOccupant;
  /** Friends assigned to seats 2-6 in order (may be fewer than 5 or empty). */
  friends: SeatOccupant[];
  /** Crosshair anchor markers for alignment fine-tuning (preview harness only). */
  showAnchors?: boolean;
}

/**
 * Full-bleed table scene: the background PNG renders cover-fit (cropped, never
 * letterboxed — same treatment as Tree/Jar), and every overlay lives inside a
 * scene-pixel-space layer that carries the identical transform, so seat/book
 * anchors stay pixel-aligned at every viewport size.
 */
export default function TableScene({ self, friends, showAnchors = false }: TableSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const ready = viewport.width > 0 && viewport.height > 0;
  const scale = ready ? Math.max(viewport.width / SCENE.width, viewport.height / SCENE.height) : 0;
  const offsetX = (viewport.width - SCENE.width * scale) / 2;
  const offsetY = (viewport.height - SCENE.height * scale) / 2;

  const seated = friends.slice(0, SEATS.length - 1);

  return (
    <div ref={containerRef} className="table-scene" role="img" aria-label="Study table with your circle's live presence">
      {ready && (
        <div
          className="table-scene__space"
          style={{
            width: SCENE.width,
            height: SCENE.height,
            transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          }}
        >
          <img className="table-scene__image" src={SCENE.url} alt="" draggable={false} />
          <SeatOverlay seat={SEATS[0]} status={self.status} name={self.name} />
          {seated.map((friend, index) => (
            <SeatOverlay key={friend.id} seat={SEATS[index + 1]} status={friend.status} name={friend.name} />
          ))}
          {showAnchors &&
            SEATS.flatMap((seat, i) => [
              <span key={`f${i}`} className="table-anchor" style={{ left: seat.figure.x, top: seat.figure.y }} />,
              <span key={`b${i}`} className="table-anchor table-anchor--book" style={{ left: seat.book.x, top: seat.book.y }} />,
            ])}
        </div>
      )}
    </div>
  );
}
