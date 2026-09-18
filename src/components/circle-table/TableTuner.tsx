import { useEffect, useState } from 'react';
import type { TableTransform } from './TableScene3D';
import {
  DEFAULT_CHAIR_TRANSFORM,
  roundTransform,
  SLIDER_ROWS,
  type ObjectTransform,
} from './transformConfig';

interface ChairTunerProps {
  tableTransform: TableTransform;
  onTableTransformChange: (next: TableTransform) => void;
  chairs: ObjectTransform[];
  onChairsChange: (next: ObjectTransform[]) => void;
  spin: boolean;
  onSpinChange: (next: boolean) => void;
  /** Reports the currently selected object so scene drags move the right one. */
  onSelect?: (target: 'table' | number) => void;
}

/**
 * Tuner for placing the 3D table and its chairs on the live site.
 *
 * - "Add chair" drops in another chair (up to six, the table's seat count).
 * - Every chair gets its own sliders: size, move X/Y/Z, tilt X/Y/Z.
 * - Dragging the scene moves whichever object is selected (table or chair).
 * - "Rotate" toggles the master rotation: table spins and the chairs orbit
 *   along with it.
 * - "Save" prints everything to the console between markers, for pasting back
 *   into the defaults.
 */
export default function TableTuner({
  tableTransform,
  onTableTransformChange,
  chairs,
  onChairsChange,
  spin,
  onSpinChange,
  onSelect,
}: ChairTunerProps) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<'table' | number>('table');

  useEffect(() => {
    onSelect?.(selected);
  }, [onSelect, selected]);

  const selectedTransform: ObjectTransform =
    selected === 'table' ? tableTransform : chairs[selected] ?? DEFAULT_CHAIR_TRANSFORM;

  function setSelectedTransform(next: ObjectTransform) {
    if (selected === 'table') {
      onTableTransformChange({ ...tableTransform, ...next });
    } else {
      onChairsChange(chairs.map((chair, i) => (i === selected ? next : chair)));
    }
  }

  function handleAddChair() {
    if (chairs.length >= 6) return;
    onChairsChange([...chairs, { ...DEFAULT_CHAIR_TRANSFORM }]);
    setSelected(chairs.length);
  }

  function handleRemoveChair() {
    if (chairs.length === 0) return;
    const next = chairs.slice(0, -1);
    onChairsChange(next);
    setSelected((current) => (current === 'table' ? 'table' : Math.min(current, next.length - 1)));
    if (next.length === 0) setSelected('table');
  }

  function handleSave() {
    const roundedTable = roundTransform(tableTransform);
    const roundedChairs = chairs.map(roundTransform);

    console.log('TABLE_AND_CHAIRS_START');
    console.log('table:', JSON.stringify(roundedTable, null, 2));
    console.log(`chairs (${roundedChairs.length}):`);
    roundedChairs.forEach((chair, i) => console.log(`  chair[${i}]:`, JSON.stringify(chair)));
    console.log('TABLE_AND_CHAIRS_END');
    console.log('Paste table into DEFAULT_TABLE_TRANSFORM and chairs into DEFAULT_CHAIR_TRANSFORMS (transformConfig.ts).');
  }

  const label =
    selected === 'table' ? 'Table' : `Chair ${selected + 1}`;

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
        {open ? '▾ Table & chairs' : '▸ Table & chairs'}
      </button>

      {open && (
        <>
          <div className="text-[10px] text-stone-600">
            Select an object, drag the scene to move it, or use the sliders. Save logs to console.
          </div>

          <div className="table-preview-actions" style={{ marginTop: '0.35rem' }}>
            <button onClick={handleAddChair} disabled={chairs.length >= 6}>
              + Add chair ({chairs.length}/6)
            </button>
            <button onClick={handleRemoveChair} disabled={chairs.length === 0}>
              Remove
            </button>
            <button onClick={() => onSpinChange(!spin)} style={spin ? { background: 'rgb(197,255,84)', color: '#11130f' } : undefined}>
              {spin ? 'Rotate: on' : 'Rotate: off'}
            </button>
          </div>

          <div className="table-preview-row" style={{ marginTop: '0.35rem' }}>
            <span className="table-preview-label">Editing</span>
            <select
              value={selected === 'table' ? 'table' : String(selected)}
              onChange={(e) => {
                const value = e.target.value;
                setSelected(value === 'table' ? 'table' : Number(value));
              }}
              style={{
                background: 'rgba(9,11,10,0.9)',
                color: '#d8ffa1',
                border: '1px solid rgba(197,255,84,0.25)',
                borderRadius: '999px',
                padding: '0.18rem 0.4rem',
                fontSize: '0.6rem',
                maxWidth: '7.5rem',
              }}
            >
              <option value="table">Table</option>
              {chairs.map((_, i) => (
                <option key={i} value={String(i)}>
                  Chair {i + 1}
                </option>
              ))}
            </select>
          </div>

          <div className="text-[10px] text-lime-300" style={{ marginTop: '0.35rem', fontWeight: 700 }}>
            {label}
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
                value={selectedTransform[row.key]}
                onChange={(e) => setSelectedTransform({ ...selectedTransform, [row.key]: Number(e.target.value) })}
                style={{ flex: 1, accentColor: 'rgb(197,255,84)' }}
              />
              <span style={{ width: '2.8rem', textAlign: 'right', fontSize: '0.6rem', color: 'rgba(245,243,235,.75)' }}>
                {selectedTransform[row.key].toFixed(2)}
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
                if (selected === 'table') {
                  onTableTransformChange(DEFAULT_TABLE_TRANSFORM_PRESERVE_CAMERA(tableTransform));
                } else {
                  setSelectedTransform({ ...DEFAULT_CHAIR_TRANSFORM });
                }
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

function DEFAULT_TABLE_TRANSFORM_PRESERVE_CAMERA(current: TableTransform): TableTransform {
  return {
    scale: 0.74,
    positionX: -0.05,
    positionY: 0.64,
    positionZ: 0.66,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    cameraDistance: current.cameraDistance,
    cameraHeight: current.cameraHeight,
  };
}
