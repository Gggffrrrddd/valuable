/**
 * Scene layout for the Compete mountain. Everything positional lives here so
 * swapping the placeholder for a real 3D mountain/staircase later only means
 * editing this file (mirrors circle-table's transformConfig.ts).
 */

/** A point on the climb path, in % of the scene box (0,0 = top-left). */
export interface StepPosition {
  x: number;
  y: number;
}

/** Layered background ridges, drawn far-to-near for atmospheric depth. */
export interface Ridge {
  /** SVG polygon points in the 0-100 scene space. */
  points: string;
  fill: string;
}

export const RIDGES: Ridge[] = [
  { points: '0,62 9,40 17,50 26,30 34,44 43,26 52,42 61,22 70,38 80,26 90,44 100,34 100,100 0,100', fill: '#161d29' },
  { points: '0,74 12,56 22,66 33,48 45,62 55,44 66,58 78,46 90,62 100,54 100,100 0,100', fill: '#111722' },
  { points: '0,86 14,72 27,82 41,66 56,80 70,68 84,80 100,70 100,100 0,100', fill: '#0c1118' },
];

/** Hero summit used by the front ridge, snow cap, and beacon. */
export const PEAK = { summitX: 61, summitY: 22 };

/** 3D mountain transform: scene placement tuned via the live tuner. */
export interface MountainTransform {
  scale: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  cameraDistance: number;
  cameraHeight: number;
}

export const DEFAULT_MOUNTAIN_TRANSFORM: MountainTransform = {
  scale: 1,
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  cameraDistance: 5,
  cameraHeight: 2.5,
};

/** Tuner slider rows: zoom (scale), left/right (X), up/down (Y). */
export const MOUNTAIN_SLIDER_ROWS: {
  key: keyof Pick<MountainTransform, 'scale' | 'positionX' | 'positionY'>;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: 'scale', label: 'Zoom', min: 0.2, max: 4, step: 0.01 },
  { key: 'positionX', label: 'Left / Right', min: -5, max: 5, step: 0.01 },
  { key: 'positionY', label: 'Up / Down', min: -3, max: 4, step: 0.01 },
];

/**
 * Winding path from base camp to summit, drawn as a polyline of control
 * points. Step markers are spaced evenly along this polyline, so any
 * total_steps value works without editing the component.
 */
export const MOUNTAIN_PATH: StepPosition[] = [
  { x: 12, y: 90 },
  { x: 34, y: 80 },
  { x: 20, y: 68 },
  { x: 46, y: 56 },
  { x: 30, y: 44 },
  { x: 56, y: 32 },
  { x: 44, y: 20 },
  { x: 68, y: 10 },
];

/**
 * Returns totalSteps + 1 evenly spaced points along MOUNTAIN_PATH:
 * index 0 is base camp (before any step), index i is the position after
 * i completed steps. The last point is always the summit.
 */
export function stepPositions(totalSteps: number): StepPosition[] {
  const pts = MOUNTAIN_PATH;
  if (totalSteps <= 0) return [pts[0]];

  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    lengths.push(len);
    total += len;
  }

  const out: StepPosition[] = [];
  for (let s = 0; s <= totalSteps; s++) {
    const target = (s / totalSteps) * total;
    let remaining = target;
    let seg = 0;
    while (seg < lengths.length - 1 && remaining > lengths[seg]) {
      remaining -= lengths[seg];
      seg++;
    }
    const t = lengths[seg] > 0 ? remaining / lengths[seg] : 0;
    out.push({
      x: pts[seg].x + (pts[seg + 1].x - pts[seg].x) * t,
      y: pts[seg].y + (pts[seg + 1].y - pts[seg].y) * t,
    });
  }
  return out;
}
