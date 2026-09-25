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

/** Placeholder asset paths — replace the files, keep the paths. */
export const COMPETE_ASSETS = {
  stepMarker: '/visuals/compete/step-marker.png',
  climber: '/visuals/compete/climber.png',
} as const;
