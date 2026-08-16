import { useEffect, useState } from 'react';
import TableScene, { type SeatOccupant } from '@/components/circle-table/TableScene';
import type { CirclePresenceStatus } from '@/lib/presence';

/*
 * Standalone dev harness for the study-circle table (route: /study-table-preview).
 * Renders the same TableScene the app screen uses, with simulated presence so
 * every animation path (arrive, exit, book open/close, simultaneous exit+close)
 * can be observed without a backend. Also doubles as the seat/book anchor
 * alignment checker when the real assets land.
 */

const ALL_STATUSES: CirclePresenceStatus[] = ['offline', 'online-idle', 'focusing', 'paused'];
const DEMO_NAMES = ['Maya', 'Dev', 'Ana', 'Kai', 'Noor'];

const STATUS_LABEL: Record<CirclePresenceStatus, string> = {
  offline: 'away',
  'online-idle': 'idle',
  focusing: 'focusing',
  paused: 'paused',
};

function stepStatus(current: CirclePresenceStatus): CirclePresenceStatus {
  return ALL_STATUSES[(ALL_STATUSES.indexOf(current) + 1) % ALL_STATUSES.length];
}

export default function StudyTablePreview() {
  const [selfStatus, setSelfStatus] = useState<CirclePresenceStatus>('online-idle');
  const [friendStatuses, setFriendStatuses] = useState<CirclePresenceStatus[]>([
    'online-idle',
    'focusing',
    'offline',
    'offline',
    'paused',
  ]);
  const [autoCycle, setAutoCycle] = useState(true);
  const [showAnchors, setShowAnchors] = useState(false);

  useEffect(() => {
    if (!autoCycle) return;
    const timer = setInterval(() => {
      setFriendStatuses((prev) => prev.map((s) => (Math.random() < 0.25 ? stepStatus(s) : s)));
    }, 2500);
    return () => clearInterval(timer);
  }, [autoCycle]);

  const self: SeatOccupant = { id: 'self', name: 'You', status: selfStatus };
  const friends: SeatOccupant[] = DEMO_NAMES.map((name, i) => ({
    id: `demo-${i}`,
    name,
    status: friendStatuses[i],
  }));

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#1A0E2E]">
      <TableScene self={self} friends={friends} showAnchors={showAnchors} />

      <div className="table-preview-panel">
        <div className="table-preview-title">Study table preview — placeholder assets</div>

        <div className="table-preview-row">
          <span className="table-preview-label">You</span>
          <button onClick={() => setSelfStatus(stepStatus(selfStatus))}>
            {STATUS_LABEL[selfStatus]}
          </button>
        </div>

        {friends.map((f, i) => (
          <div key={f.id} className="table-preview-row">
            <span className="table-preview-label">{f.name}</span>
            <button onClick={() => setFriendStatuses((prev) => prev.map((s, j) => (j === i ? stepStatus(s) : s)))}>
              {STATUS_LABEL[f.status]}
            </button>
          </div>
        ))}

        <div className="table-preview-actions">
          <button onClick={() => setAutoCycle((v) => !v)}>{autoCycle ? 'Pause cycling' : 'Auto cycle'}</button>
          <button onClick={() => setShowAnchors((v) => !v)}>{showAnchors ? 'Hide anchors' : 'Show anchors'}</button>
        </div>
      </div>
    </div>
  );
}
