import { useState } from 'react';
import { DEFAULT_TABLE_TRANSFORM, type TableTransform } from '@/components/circle-table/TableScene3D';

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
  { key: 'cameraDistance', label: 'Cam zoom', min: 2, max: 12, step: 0.05 },
  { key: 'cameraHeight', label: 'Cam height', min: 0.5, max: 8, step: 0.05 },
];

/**
 * Dev-only table transform tuner. Renders nothing in production builds, so the
 * shipped screen stays clean. Drag the scene to move the table, tune with the
 * sliders, then press Save to log the values for pasting back into
 * DEFAULT_TABLE_TRANSFORM.
 */
export default function TableTuner({
  transform,
  onTransformChange,
  onDrag,
}: {
  transform: TableTransform;
  onTransformChange: (next: TableTransform) => void;
  onDrag: (dx: number, dy: number) => void;
}) {
  const [open, setOpen] = useState(false);

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

  return (
    <div className="table-preview-panel" style={{ right: '1rem', left: 'auto', maxHeight: 'calc(100% - 2rem)', overflowY: 'auto' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="table-preview-title"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
      >
        {open ? '▾ Table tuner' : '▸ Table tuner'}
      </button>

      {open && (
        <>
          <div className="text-[10px] text-stone-600">Drag the scene to move the table. Save logs values to console.</div>

          {SLIDERS.map((row) => (
            <div key={row.key} className="table-preview-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="table-preview-label" style={{ width: '4.6rem', flexShrink: 0 }}>{row.label}</span>
              <input
                type="range"
                min={row.min}
                max={row.max}
                step={row.step}
                value={transform[row.key]}
                onChange={(e) => onTransformChange({ ...transform, [row.key]: Number(e.target.value) })}
                style={{ flex: 1, accentColor: 'rgb(197,255,84)' }}
              />
              <span style={{ width: '2.8rem', textAlign: 'right', fontSize: '0.6rem', color: 'rgba(245,243,235,.75)' }}>
                {transform[row.key].toFixed(2)}
              </span>
            </div>
          ))}

          <div className="table-preview-actions">
            <button onClick={handleSave} style={{ background: 'rgb(197,255,84)', color: '#11130f', fontWeight: 700 }}>
              Save
            </button>
            <button onClick={() => onTransformChange(DEFAULT_TABLE_TRANSFORM)}>Reset</button>
            <button onClick={() => onDrag(0, 0)}>Center</button>
          </div>
        </>
      )}
    </div>
  );
}
