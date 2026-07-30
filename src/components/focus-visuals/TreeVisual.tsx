import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { FocusVisualProps } from './types';

interface TreeVisualProps extends FocusVisualProps {
  duration: number;
}

interface PlacedLeaf {
  id: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  hue: number;
  brightness: number;
}

interface DragState {
  leafId: number;
  pointerId: number;
  startX: number;
  startY: number;
  leafX: number;
  leafY: number;
}

const TREE_SCENE_URL = '/visuals/tree/tree-scene.png';
const LEAF_URL = '/visuals/tree/leaf-01.png';
const LEAF_STORAGE_KEY = 'valuable-tree-leaf-layout-v1';
const DEFAULT_LEAF: PlacedLeaf = {
  id: 1,
  x: 0.45,
  y: 0.3,
  scale: 1,
  rotation: 0,
  hue: 0,
  brightness: 1,
};

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

function readLeaves(): PlacedLeaf[] {
  try {
    const saved = JSON.parse(localStorage.getItem(LEAF_STORAGE_KEY) ?? 'null') as PlacedLeaf[] | null;
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {
    return [DEFAULT_LEAF];
  }
  return [DEFAULT_LEAF];
}

export default function TreeVisual({ progress, duration }: TreeVisualProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const activeSession = duration > 0;
  const [leaves, setLeaves] = useState<PlacedLeaf[]>(readLeaves);
  const [selectedId, setSelectedId] = useState(() => readLeaves()[0]?.id ?? 1);
  const [editing, setEditing] = useState(() => activeSession && localStorage.getItem(LEAF_STORAGE_KEY) === null);
  const selectedLeaf = leaves.find((leaf) => leaf.id === selectedId) ?? leaves[0];
  const complete = progress >= 1;

  const updateSelected = (change: Partial<PlacedLeaf>) => {
    setLeaves((current) => current.map((leaf) => leaf.id === selectedId ? { ...leaf, ...change } : leaf));
  };

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, leaf: PlacedLeaf) => {
    if (!editing || !editorRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(leaf.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      leafId: leaf.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      leafX: leaf.x,
      leafY: leaf.y,
    };
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const editor = editorRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !editor) return;
    const rect = editor.getBoundingClientRect();
    setLeaves((current) => current.map((leaf) => leaf.id === drag.leafId ? {
      ...leaf,
      x: clamp(drag.leafX + (event.clientX - drag.startX) / rect.width, 0, 1),
      y: clamp(drag.leafY + (event.clientY - drag.startY) / rect.height, 0, 1),
    } : leaf));
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const addLeaf = () => {
    const id = Math.max(0, ...leaves.map((leaf) => leaf.id)) + 1;
    const offset = (leaves.length % 7) * 0.015;
    const leaf = { ...DEFAULT_LEAF, id, x: 0.5 + offset, y: 0.35 + offset };
    setLeaves((current) => [...current, leaf]);
    setSelectedId(id);
  };

  const deleteSelected = () => {
    if (leaves.length === 1) return;
    const remaining = leaves.filter((leaf) => leaf.id !== selectedId);
    setLeaves(remaining);
    setSelectedId(remaining[0].id);
  };

  const saveLayout = () => {
    localStorage.setItem(LEAF_STORAGE_KEY, JSON.stringify(leaves));
    setEditing(false);
  };

  const sceneClass = activeSession ? 'tree-leaf-editor--fullscreen' : 'tree-leaf-editor--preview';

  return (
    <div
      ref={editorRef}
      className={`tree-leaf-editor focus-visual ${sceneClass} ${complete ? 'visual-complete' : ''}`}
      role="img"
      aria-label={`Tree ${Math.round(progress * 100)} percent complete with ${leaves.length} placed leaves`}
    >
      {!activeSession && <img className="tree-leaf-editor__preview-bg" src={TREE_SCENE_URL} alt="" aria-hidden="true" />}
      <div className="tree-scene__completion-glow visual-finish-glow" aria-hidden="true" />

      {leaves.map((leaf) => {
        const style: CSSProperties = {
          left: `${leaf.x * 100}%`,
          top: `${leaf.y * 100}%`,
          transform: `translate(-50%, -50%) rotate(${leaf.rotation}deg) scale(${leaf.scale})`,
          filter: `hue-rotate(${leaf.hue}deg) brightness(${leaf.brightness})`,
        };
        return (
          <button
            type="button"
            className={`tree-placed-leaf ${editing && leaf.id === selectedId ? 'tree-placed-leaf--selected' : ''}`}
            style={style}
            onPointerDown={(event) => startDrag(event, leaf)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClick={() => editing && setSelectedId(leaf.id)}
            aria-label={`Leaf ${leaf.id}`}
          >
            <img src={LEAF_URL} alt="" draggable={false} />
          </button>
        );
      })}

      {activeSession && editing && selectedLeaf && (
        <div className="tree-leaf-controls">
          <div className="tree-leaf-controls__header">
            <strong>Place leaves</strong>
            <span>{leaves.length} leaves</span>
          </div>
          <p>Drag the selected leaf anywhere on the tree.</p>
          <label>
            Size
            <input type="range" min="0.3" max="2.5" step="0.01" value={selectedLeaf.scale} onChange={(event) => updateSelected({ scale: Number(event.target.value) })} />
          </label>
          <label>
            Rotate
            <input type="range" min="-180" max="180" step="1" value={selectedLeaf.rotation} onChange={(event) => updateSelected({ rotation: Number(event.target.value) })} />
            <output>{Math.round(selectedLeaf.rotation)}°</output>
          </label>
          <label>
            Color
            <input type="range" min="-180" max="180" step="1" value={selectedLeaf.hue} onChange={(event) => updateSelected({ hue: Number(event.target.value) })} />
          </label>
          <label>
            Light
            <input type="range" min="0.5" max="1.5" step="0.01" value={selectedLeaf.brightness} onChange={(event) => updateSelected({ brightness: Number(event.target.value) })} />
          </label>
          <div className="tree-leaf-controls__actions">
            <button type="button" onClick={addLeaf}>+ Add leaf</button>
            <button type="button" onClick={deleteSelected} disabled={leaves.length === 1}>Delete</button>
            <button type="button" className="tree-leaf-controls__save" onClick={saveLayout}>Save layout</button>
          </div>
        </div>
      )}

      {activeSession && !editing && (
        <button type="button" className="tree-leaf-edit-button" onClick={() => setEditing(true)}>Edit leaves</button>
      )}
    </div>
  );
}
