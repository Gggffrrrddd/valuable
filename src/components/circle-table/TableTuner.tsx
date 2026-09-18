import { useEffect, useState } from 'react';
import type { TableTransform } from './TableScene3D';
import {
  DEFAULT_CHAIR_TRANSFORM,
  DEFAULT_TABLE_TRANSFORM,
  replicateChairs,
  roundTransform,
  SLIDER_ROWS,
  type ObjectTransform,
} from './transformConfig';

interface ChairTunerProps {
  tableTransform: TableTransform;
  onTableTransformChange: (next: TableTransform) => void;
  /** Reference chair; the scene replicates it into six. */
  chair: ObjectTransform;
  onChairChange: (next: ObjectTransform) => void;
  spin: boolean;
  onSpinChange: (next: boolean) => void;
  /** Reports the selected object so scene drags move the right one. */
  onSelect?: (target: 'table' | 'chair') => void;
}

/**
 * Chair placement tuner: position ONE reference chair by the table, press
 * Save, and the scene builds all six chairs from it (rotated 60° steps around
 * the table center, same scale/height/tilt, always facing the table).
 */
export default function TableTuner({
  tableTransform,
  onTableTransformChange,
  chair,
  onChairChange,
  spin,
  onSpinChange,
  onSelect,
}: ChairTunerProps) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<'table' | 'chair'>('chair');

  useEffect(() => {
    onSelect?.(selected);
  }, [onSelect, selected]);

  function handleSave() {
    const tableCenter = { x: tableTransform.positionX, z: tableTransform.positionZ };
    const replicated = replicateChairs(chair, tableCenter);
    const rounded = replicated.map(roundTransform);

    console.log('TABLE_AND_CHAIRS_START');
    console.log('table:', JSON.stringify(roundTransform(tableTransform), null, 2));
    console.log(`chairs (${rounded.length}):`);
    rounded.forEach((entry, i) => console.log(`  chair[${i}]:`, JSON.stringify(entry)));
    console.log('TABLE_AND_CHAIRS_END');
    console.log(
      'Paste into DEFAULT_TABLE_TRANSFORM, DEFAULT_CHAIR_TRANSFORM and DEFAULT_CHAIR_TRANSFORMS (transformConfig.ts).',
    );
  }

  const editingTransform: ObjectTransform = selected === 'table' ? tableTransform : chair;

  function setEditingTransform(next: ObjectTransform) {
    if (selected === 'table') {
      onTableTransformChange({ ...tableTransform, ...next });
    } else {
      onChairChange(next);
    }
  }

  return (
    <div
      className="table-preview-panel"
      style={{ right: '1rem', left: 'auto', bottom: '1rem', maxHeight: 'calc(100% - 2rem)', overflowY: 'auto' }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="table-preview-title"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
      >
        {open ? '▾ Table & chair' : '▸ Table & chair'}
      </button>

      {open && (
        <>
          <div className="text-[10px] text-stone-600">
            Position the chair, then Save — all six chairs build from it. Drag the scene to move the selected object.
          </div>

          <div className="table-preview-actions" style={{ marginTop: '0.35rem' }}>
            <button onClick={() => onSpinChange(!spin)} style={spin ? { background: 'rgb(197,255,84)', color: '#11130f' } : undefined}>
              {spin ? 'Rotate: on' : 'Rotate: off'}
            </button>
          </div>

          <div className="table-preview-row" style={{ marginTop: '0.35rem' }}>
            <span className="table-preview-label">Editing</span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value === 'table' ? 'table' : 'chair')}
              style={{
                background: 'rgba(9,11,10,0.9)',
                color: '#d8ffa1',
                border: '1px solid rgba(197,255,84,0.25)',
                borderRadius: '999px',
                padding: '0.18rem 0.4rem',
                fontSize: '0.6rem',
              }}
            >
              <option value="table">Table</option>
              <option value="chair">Chair (reference)</option>
            </select>
          </div>

          <div className="text-[10px] text-lime-300" style={{ marginTop: '0.35rem', fontWeight: 700 }}>
            {selected === 'table' ? 'Table' : 'Reference chair'}
          </div>

          {SLIDER_ROWS.map((row) => (
            <div key={row.key} className="table-preview-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="table-preview-label" style={{ width: '4.6rem', flexShrink: 0 }}>
                {row.label}
              </span>
              <input
                type="range"
                min={row.min}
                max={row.max}
                step={row.step}
                value={editingTransform[row.key]}
                onChange={(e) => setEditingTransform({ ...editingTransform, [row.key]: Number(e.target.value) })}
                style={{ flex: 1, accentColor: 'rgb(197,255,84)' }}
              />
              <span style={{ width: '2.8rem', textAlign: 'right', fontSize: '0.6rem', color: 'rgba(245,243,235,.75)' }}>
                {editingTransform[row.key].toFixed(2)}
              </span>
            </div>
          ))}

          {selected === 'table' && (
            <>
              <div className="text-[10px] text-stone-600" style={{ marginTop: '0.35rem' }}>
                Camera (table only)
              </div>
              {(
                [
                  { key: 'cameraDistance', label: 'Cam zoom', min: 2, max: 12, step: 0.05 },
                  { key: 'cameraHeight', label: 'Cam height', min: 0.5, max: 8, step: 0.05 },
                ] as const
              ).map((row) => (
                <div key={row.key} className="table-preview-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="table-preview-label" style={{ width: '4.6rem', flexShrink: 0 }}>
                    {row.label}
                  </span>
                  <input
                    type="range"
                    min={row.min}
                    max={row.max}
                    step={row.step}
                    value={tableTransform[row.key]}
                    onChange={(e) =>
                      onTableTransformChange({ ...tableTransform, [row.key]: Number(e.target.value) })
                    }
                    style={{ flex: 1, accentColor: 'rgb(197,255,84)' }}
                  />
                  <span style={{ width: '2.8rem', textAlign: 'right', fontSize: '0.6rem', color: 'rgba(245,243,235,.75)' }}>
                    {tableTransform[row.key].toFixed(2)}
                  </span>
                </div>
              ))}
            </>
          )}

          <div className="table-preview-actions">
            <button onClick={handleSave} style={{ background: 'rgb(197,255,84)', color: '#11130f', fontWeight: 700 }}>
              Save
            </button>
            <button
              onClick={() => {
                if (selected === 'table') onTableTransformChange(DEFAULT_TABLE_TRANSFORM);
                else onChairChange(DEFAULT_CHAIR_TRANSFORM);
              }}
            >
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  );
}
