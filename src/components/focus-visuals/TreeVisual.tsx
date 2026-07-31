import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { FocusVisualProps } from './types';

interface TreeVisualProps extends FocusVisualProps {
  duration: number;
  running?: boolean;
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

const TREE_SCENE_URL = '/visuals/tree/tree-scene.png';
const LEAF_URL = '/visuals/tree/leaf-01.png';

const LEAVES: PlacedLeaf[] = [{"rotation":0,"hue":0,"brightness":1,"x":0.45366032210834556,"y":0.24550810014727539,"scale":0.59,"id":1},{"rotation":13,"hue":0,"brightness":1,"x":0.22144216691068819,"y":0.05277614138438879,"scale":0.65,"id":2},{"rotation":-45,"hue":3,"brightness":1,"x":0.33307467057101026,"y":0.22241531664212078,"scale":0.6,"id":3},{"rotation":-109,"hue":0,"brightness":1,"x":0.21264275256222553,"y":0.020920471281295983,"scale":0.56,"id":4},{"rotation":-129,"hue":0,"brightness":1,"x":0.20714494875549055,"y":0.0373932253313696,"scale":0.57,"id":5},{"rotation":66,"hue":-5,"brightness":1,"x":0.33415080527086383,"y":0.1319219440353461,"scale":0.57,"id":6},{"rotation":41,"hue":0,"brightness":1,"x":0.40551976573938509,"y":0.18815905743740793,"scale":0.54,"id":7},{"rotation":-85,"hue":0,"brightness":1,"x":0.32357247437774528,"y":0.11877761413843886,"scale":0.51,"id":8},{"rotation":-35,"hue":0,"brightness":1,"x":0.17532210834553444,"y":0.05424889543446243,"scale":0.57,"id":9},{"rotation":38,"hue":0,"brightness":1,"x":0.33307467057101031,"y":0.035375552282768792,"scale":0.59,"id":10},{"rotation":-78,"hue":0,"brightness":1,"x":0.32025622254758424,"y":0.13579528718703976,"scale":0.54,"id":11},{"rotation":-71,"hue":0,"brightness":1,"x":0.30597364568082003,"y":0.2524153166421208,"scale":0.68,"id":12},{"rotation":38,"hue":0,"brightness":1,"x":0.44981698389458263,"y":0.27772459499263619,"scale":0.6,"id":13},{"rotation":-58,"hue":2,"brightness":1,"x":0.40698389458272322,"y":0.24854197349042703,"scale":0.59,"id":14},{"rotation":-141,"hue":0,"brightness":1,"x":0.16398243045387989,"y":0.068703976435935177,"scale":0.64,"id":15},{"rotation":-108,"hue":0,"brightness":1,"x":0.38981698389458275,"y":0.16323269513991162,"scale":0.67,"id":16},{"rotation":7,"hue":-6,"brightness":1,"x":0.42970717423133242,"y":0.24450662739322537,"scale":0.59,"id":17},{"rotation":-22,"hue":0,"brightness":1,"x":0.22435578330893122,"y":0.14021354933726066,"scale":0.72,"id":18},{"rotation":0,"hue":0,"brightness":1,"x":1, "y":1, "scale":0, "id":999}];

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

const LAND_DATA = new Map<number, { landX: number; landY: number; landRotation: number; zIndex: number; scale: number }>(
  LEAVES.map((leaf) => {
    const u1 = seededUnit(leaf.id + 101), u2 = seededUnit(leaf.id + 211);
    const u3 = seededUnit(leaf.id + 311), u4 = seededUnit(leaf.id + 411);
    const u5 = seededUnit(leaf.id + 511), u7 = seededUnit(leaf.id + 711);
    const tri = (u1 + u2) / 2;
    const rotDir = u4 < 0.5 ? -1 : 1;
    return [leaf.id, {
      landX: 0.05 + tri * 0.9,
      landY: 0.76 + u3 * 0.18,
      landRotation: leaf.rotation + rotDir * (8 + u5 * 22),
      zIndex: 3 + Math.floor(u7 * 3),
      scale: leaf.scale,
    }];
  })
);

const SHED_ORDER: number[] = LEAVES
  .map((l) => ({ id: l.id, order: seededUnit(l.id + 1) }))
  .sort((a, b) => a.order - b.order)
  .map((x) => x.id);

const SHED_RANK = new Map<number, number>(
  SHED_ORDER.map((id, idx) => [id, idx])
);

const TOTAL_LEAVES = LEAVES.length;

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const u = () => setR(q.matches);
    u(); q.addEventListener('change', u);
    return () => q.removeEventListener('change', u);
  }, []);
  return r;
}

export default function TreeVisual({ progress, duration }: TreeVisualProps) {
  const activeSession = duration > 0;
  const complete = progress >= 1;
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const boundaryRef = useRef(1);

  useEffect(() => {
    if (!activeSession) return;
    const colon = document.querySelector('.flip-colon');
    const container = containerRef.current;
    if (colon && container) {
      const cr = container.getBoundingClientRect();
      const loc = colon.getBoundingClientRect();
      boundaryRef.current = Math.max(0.15, Math.min(0.98, (loc.left - cr.left) / cr.width));
    }
  }, [activeSession]);

  const shedCount = useMemo(() => {
    if (!activeSession || progress <= 0) return 0;
    if (complete || progress >= 0.95) return TOTAL_LEAVES;
    return Math.min(TOTAL_LEAVES, Math.floor(progress * TOTAL_LEAVES));
  }, [activeSession, complete, progress]);

  const leafStyles = useMemo(() => {
    const clampX = (rawX: number) => Math.min(rawX, boundaryRef.current - 0.008);
    return LEAVES.map((leaf) => {
      const rank = SHED_RANK.get(leaf.id) ?? Infinity;
      const hasShed = activeSession && rank < shedCount;
      const land = LAND_DATA.get(leaf.id);

      let x: number, y: number, rot: number, zIdx: number | undefined;
      if (hasShed && land) {
        x = clampX(land.landX);
        y = land.landY;
        rot = land.landRotation;
        zIdx = land.zIndex;
      } else {
        x = clampX(leaf.x);
        y = leaf.y;
        rot = leaf.rotation;
        zIdx = undefined;
      }

      const cx = activeSession ? x * 100 : leaf.x * 100;
      const cy = activeSession ? y * 100 : leaf.y * 100;

      const style: CSSProperties = {
        left: `${cx}%`,
        top: `${cy}%`,
        transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${leaf.scale})`,
        filter: `hue-rotate(${leaf.hue}deg) brightness(${leaf.brightness})`,
        zIndex: zIdx,
      };
      const cls = (hasShed ? 'tree-placed-leaf tree-placed-leaf--landed' : 'tree-placed-leaf')
        + (reducedMotion ? ' tree-placed-leaf--instant' : '');
      return { id: leaf.id, style, cls };
    });
  }, [activeSession, shedCount, reducedMotion]);

  return (
    <div
      ref={containerRef}
      className={`tree-leaf-editor focus-visual ${activeSession ? 'tree-leaf-editor--fullscreen' : 'tree-leaf-editor--preview'} ${complete ? 'visual-complete' : ''}`}
      role="img"
      aria-label={`Tree ${Math.round(progress * 100)} percent complete with ${TOTAL_LEAVES} placed leaves`}
    >
      {!activeSession && <img className="tree-leaf-editor__preview-bg" src={TREE_SCENE_URL} alt="" aria-hidden="true" />}
      <div className="tree-scene__completion-glow visual-finish-glow" aria-hidden="true" />

      {leafStyles.map((ls) => (
        <span
          key={ls.id}
          className={ls.cls}
          style={ls.style}
          aria-hidden="true"
        >
          <img src={LEAF_URL} alt="" draggable={false} />
        </span>
      ))}
    </div>
  );
}