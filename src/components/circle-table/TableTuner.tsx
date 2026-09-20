import type { PointerEvent } from 'react';
import type { TableTransform } from './TableScene3D';
import {
  DEFAULT_CHAIR_TRANSFORMS,
  DEFAULT_TABLE_TRANSFORM,
  SLIDER_ROWS,
  roundTransform,
  type ObjectTransform,
} from './transformConfig';

interface TableTunerProps {
  table: TableTransform;
  chairs: ObjectTransform[];
  rotating: boolean;
  onTableChange: (table: TableTransform) => void;
  onChairsChange: (chairs: ObjectTransform[]) => void;
  onRotationChange: (rotating: boolean) => void;
  onDragStart: (event: PointerEvent<HTMLDivElement>) => void;
  onDragMove: (event: PointerEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

export default function TableTuner({
  table,
  chairs,
  rotating,
  onTableChange,
  onChairsChange,
  onRotationChange,
  onDragStart,
  onDragMove,
  onDragEnd,
}: TableTunerProps) {
  const activeChair = chairs[0] ?? DEFAULT_CHAIR_TRANSFORMS[0];

  function save() {
    console.log('TABLE_TUNER_SAVE_START');
    console.log('TABLE_TRANSFORM', JSON.stringify(table, null, 2));
    console.log('CHAIR_TRANSFORMS', JSON.stringify(chairs.map(roundTransform), null, 2));
    console.log('TABLE_TUNER_SAVE_END');
  }

  function reset() {
    onTableChange(DEFAULT_TABLE_TRANSFORM);
    onChairsChange(DEFAULT_CHAIR_TRANSFORMS);
  }

  return (
    <>
      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      />
      <div className="table-preview-panel" style={{ maxHeight: 'calc(100% - 2rem)', overflowY: 'auto' }} onPointerDown={(event) => event.stopPropagation()}>
        <div className="table-preview-title">3D table tuner</div>
        <div className="text-[10px] text-stone-600">Drag the scene to position it. Tune the reference chair, then save.</div>
        <div className="table-preview-title" style={{ marginTop: '0.6rem', fontSize: '0.65rem' }}>Table</div>
        {SLIDER_ROWS.map((row) => (
          <div key={`table-${row.key}`} className="table-preview-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="table-preview-label" style={{ width: '5.5rem', flexShrink: 0 }}>{row.label}</span>
            <input type="range" min={row.min} max={row.max} step={row.step} value={table[row.key]} onChange={(event) => onTableChange({ ...table, [row.key]: Number(event.target.value) })} style={{ flex: 1, accentColor: 'rgb(197,255,84)' }} />
            <span style={{ width: '3.2rem', textAlign: 'right' }}>{table[row.key].toFixed(2)}</span>
          </div>
        ))}
        <div className="table-preview-title" style={{ marginTop: '0.6rem', fontSize: '0.65rem' }}>Chair 1 reference</div>
        {SLIDER_ROWS.slice(0, 7).map((row) => (
          <div key={`chair-${row.key}`} className="table-preview-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="table-preview-label" style={{ width: '5.5rem', flexShrink: 0 }}>{row.label}</span>
            <input type="range" min={row.min} max={row.max} step={row.step} value={activeChair[row.key]} onChange={(event) => onChairsChange(chairs.map((chair, index) => index === 0 ? { ...chair, [row.key]: Number(event.target.value) } : chair))} style={{ flex: 1, accentColor: 'rgb(197,255,84)' }} />
            <span style={{ width: '3.2rem', textAlign: 'right' }}>{activeChair[row.key].toFixed(2)}</span>
          </div>
        ))}
        <div className="table-preview-actions">
          <button onClick={save} style={{ background: 'rgb(197,255,84)', color: '#11130f', fontWeight: 700 }}>Save transform</button>
          <button onClick={reset}>Reset</button>
          <button onClick={() => onRotationChange(!rotating)}>{rotating ? 'Stop rotation' : 'Rotate table'}</button>
        </div>
      </div>
    </>
  );
}
