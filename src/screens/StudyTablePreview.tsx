import { useEffect, useState } from 'react';
import TableScene3D, {
  DEFAULT_TABLE_TRANSFORM,
  type TableTransform,
  type SeatOccupant,
} from '@/components/circle-table/TableScene3D';
import type { CirclePresenceStatus } from '@/lib/presence';

/*
 * Standalone dev harness for the study-circle table (route: /study-table-preview).
 * Renders the same TableScene3D the app screen uses, with simulated presence so
 * every animation path (arrive, exit, book open/close) can be observed without
 * a backend.
 *
 * It is also the table transform tuner: adjust the sliders until the model sits
 * where you want, then press "Save transform" — the values print to the console
 * (copy them back into DEFAULT_TABLE_TRANSFORM in TableScene3D.tsx).
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

interface SliderRow {
  key: keyof TableTransform;
  label: string;
  min: number;
  max: number;
  step: number;
}

const SLIDERS: SliderRow[] = [
  { key: 'scale', label: 'Size', min: 0.2, max: 3, step: 0.01 },
  { key: 'positionX', label: 'Move X', min: -4, max: 4, step: 0.01 },
  { key: 'positionY', label: 'Move Y', min: -2, max: 4, step: 0.01 },
  { key: 'positionZ', label: 'Move Z', min: -4, max: 4, step: 0.01 },
  { key: 'rotationX', label: 'Tilt X', min: -3.14, max: 3.14, step: 0.01 },
  { key: 'rotationY', label: 'Turn Y', min: -3.14, max: 3.14, step: 0.01 },
  { key: 'rotationZ', label: 'Tilt Z', min: -3.14, max: 3.14, step: 0.01 },
  { key: 'cameraDistance', label: 'Camera zoom', min: 2, max: 12, step: 0.05 },
  { key: 'cameraHeight', label: 'Camera height', min: 0.5, max: 8, step: 0.05 },
];

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
  const [transform, setTransform] = useState<TableTransform>(DEFAULT_TABLE_TRANSFORM);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!autoCycle) return;
    const timer = setInterval(() => {
      setFriendStatuses((prev) => prev.map((s) => (Math.random() < 0.25 ? stepStatus(s) : s)));
    }, 2500);
    return () => clearInterval(timer);
  }, [autoCycle]);

  // Pointer-drag on the canvas nudges the table horizontally/vertically.
  function handleDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setTransform((prev) => ({
      ...prev,
      positionX: prev.positionX + event.movementX * 0.006,
      positionY: prev.positionY - event.movementY * 0.006,
    }));
  }

  function handleSave() {
    const rounded: TableTransform = {
      scale: Number(transform.scale.toFixed(3)),
      positionX: Number(transform.positionX.toFixed(3)),
      positionY: Number(transform.positionY.toFixed(3)),
      positionZ: Number(transform.positionZ.toFixed(3)),
      rotationX: Number(transform.rotationX.toFixed(3)),
      rotationY: Number(transform.rotationY.toFixed(3)),
      rotationZ: Number(transform.rotationZ.toFixed(3)),
      cameraDistance: Number(transform.cameraDistance.toFixed(3)),
      cameraHeight: Number(transform.cameraHeight.toFixed(3)),
    };

    console.log('TABLE_TRANSFORM_START');
    console.log(JSON.stringify(rounded, null, 2));
    console.log('TABLE_TRANSFORM_END');
    console.log('Paste into DEFAULT_TABLE_TRANSFORM in src/components/circle-table/TableScene3D.tsx');
  }

  const self: SeatOccupant = { id: 'self', name: 'You', status: selfStatus };
  const friends: SeatOccupant[] = DEMO_NAMES.map((name, i) => ({
    id: `demo-${i}`,
    name,
    status: friendStatuses[i],
  }));

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#090b0a]">
      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onPointerDown={() => setDragging(true)}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
        onPointerMove={handleDrag}
      >
        <TableScene3D self={self} friends={friends} transform={transform} />
      </div>

      <div className="table-preview-panel" style={{ maxHeight: 'calc(100% - 2rem)', overflowY: 'auto' }}>
        <div className="table-preview-title">3D table tuner</div>
        <div className="text-[10px] text-stone-600">Drag the scene to move the table. Save prints values to console.</div>

        {SLIDERS.map((row) => (
          <div key={row.key} className="table-preview-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="table-preview-label" style={{ width: '5.5rem', flexShrink: 0 }}>{row.label}</span>
            <input
              type="range"
              min={row.min}
              max={row.max}
              step={row.step}
              value={transform[row.key]}
              onChange={(e) => setTransform((prev) => ({ ...prev, [row.key]: Number(e.target.value) }))}
              style={{ flex: 1, accentColor: 'rgb(197,255,84)' }}
            />
            <span style={{ width: '3.2rem', textAlign: 'right' }}>{transform[row.key].toFixed(2)}</span>
          </div>
        ))}

        <div className="table-preview-actions">
          <button onClick={handleSave} style={{ background: 'rgb(197,255,84)', color: '#11130f', fontWeight: 700 }}>
            Save transform
          </button>
          <button onClick={() => setTransform(DEFAULT_TABLE_TRANSFORM)}>Reset</button>
          <button onClick={() => setAutoCycle((v) => !v)}>{autoCycle ? 'Pause cycling' : 'Auto cycle'}</button>
        </div>

        <div className="table-preview-row" style={{ marginTop: '0.5rem' }}>
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
      </div>
    </div>
  );
}
