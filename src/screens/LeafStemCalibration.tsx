import { useEffect, useRef, useState } from 'react';

const LEAVES = [
  { id: 1, src: '/visuals/leaves/app-leaf-1.png' },
  { id: 2, src: '/visuals/leaves/app-leaf-2.png' },
  { id: 3, src: '/visuals/leaves/app-leaf-3.png' },
  { id: 4, src: '/visuals/leaves/app-leaf-4.png' },
  { id: 5, src: '/visuals/leaves/app-leaf-5.png' },
  { id: 6, src: '/visuals/leaves/app-leaf-6.png' },
  { id: 7, src: '/visuals/leaves/app-leaf-7.png' },
  { id: 8, src: '/visuals/leaves/app-leaf-8.png' },
];

const STORAGE_KEY = 'leafStemAnchors';

type Anchors = Record<number, { x: number; y: number }>;

function loadAnchors(): Anchors {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Anchors) : {};
  } catch {
    return {};
  }
}

function saveAnchors(anchors: Anchors) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(anchors));
  } catch {
    // ignore
  }
}

export default function LeafStemCalibration() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [anchors, setAnchors] = useState<Anchors>({});
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setAnchors(loadAnchors());
  }, []);

  const activeLeaf = LEAVES[activeIndex];

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const node = containerRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setAnchors((current) => {
      const next = { ...current, [activeLeaf.id]: { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 } };
      saveAnchors(next);
      return next;
    });
  }

  function exportToConsole() {
    const sortedEntries = LEAVES.map((leaf) => [leaf.id, anchors[leaf.id] ?? null] as const);
    const payload = Object.fromEntries(sortedEntries);
    console.info('[LeafStemAnchors]', JSON.stringify(payload, null, 2));
  }

  function clearAnchor(id: number) {
    setAnchors((current) => {
      const next = { ...current };
      delete next[id];
      saveAnchors(next);
      return next;
    });
  }

  return (
    <div className="leaf-stem-calibrator">
      <header className="leaf-stem-calibrator__header">
        <h1>Leaf stem calibration</h1>
        <p>Click the branch attachment point on each leaf. Values are saved locally and logged to the console.</p>
        <div className="leaf-stem-calibrator__actions">
          <button type="button" onClick={exportToConsole}>Save to console</button>
        </div>
      </header>

      <aside className="leaf-stem-calibrator__list">
        {LEAVES.map((leaf, index) => {
          const anchor = anchors[leaf.id];
          const isActive = index === activeIndex;
          return (
            <button
              key={leaf.id}
              type="button"
              className={`leaf-stem-calibrator__item ${isActive ? 'is-active' : ''}`}
              onClick={() => setActiveIndex(index)}
            >
              <span className="leaf-stem-calibrator__thumb"><img src={leaf.src} alt={`Leaf ${leaf.id}`} /></span>
              <span className="leaf-stem-calibrator__meta">
                <span className="leaf-stem-calibrator__title">Leaf {leaf.id}</span>
                <span className="leaf-stem-calibrator__anchor">
                  {anchor ? `x=${anchor.x}, y=${anchor.y}` : 'Click attachment point'}
                </span>
              </span>
              {anchor && (
                <span
                  role="button"
                  tabIndex={0}
                  className="leaf-stem-calibrator__clear"
                  onClick={(event) => {
                    event.stopPropagation();
                    clearAnchor(leaf.id);
                  }}
                >
                  clear
                </span>
              )}
            </button>
          );
        })}
      </aside>

      <main className="leaf-stem-calibrator__stage">
        <div
          ref={containerRef}
          className="leaf-stem-calibrator__canvas"
          onClick={handleClick}
        >
          <img src={activeLeaf.src} alt={`Leaf ${activeLeaf.id} preview`} className="leaf-stem-calibrator__image" draggable={false} />
          {anchors[activeLeaf.id] && (
            <div
              className="leaf-stem-calibrator__marker"
              style={{ left: `${anchors[activeLeaf.id].x * 100}%`, top: `${anchors[activeLeaf.id].y * 100}%` }}
            />
          )}
        </div>
        <div className="leaf-stem-calibrator__status">
          {anchors[activeLeaf.id]
            ? `Marked at x=${anchors[activeLeaf.id].x}, y=${anchors[activeLeaf.id].y}`
            : 'Click on the stem/attachment point of the leaf.'}
        </div>
      </main>
    </div>
  );
}
