import type { TableTransform } from './TableScene3D';

export interface ObjectTransform {
  scale: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

export const DEFAULT_TABLE_TRANSFORM: TableTransform = {
  scale: 0.74,
  positionX: -0.05,
  positionY: 0.64,
  positionZ: 0.66,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  cameraDistance: 5.4,
  cameraHeight: 3.4,
};

export const DEFAULT_CHAIR_TRANSFORM: ObjectTransform = {
  scale: 1,
  positionX: 1.15,
  positionY: 0.86,
  positionZ: 0.94,
  rotationX: 0,
  rotationY: -1.87,
  rotationZ: 0,
};

/**
 * Six chairs around the round table. Chair 0 is the hand-tuned reference chair;
 * the other five are replicas of it, rotated 60° steps around the table center
 * so one chair seats every section of the table.
 */
export const DEFAULT_CHAIR_TRANSFORMS: ObjectTransform[] = [
  {
    scale: 1,
    positionX: 1.15,
    positionY: 0.86,
    positionZ: 0.94,
    rotationX: 0,
    rotationY: -1.82,
    rotationZ: 0,
  },
  {
    scale: 1,
    positionX: 0.792,
    positionY: 0.86,
    positionZ: -0.239,
    rotationX: 0,
    rotationY: -0.773,
    rotationZ: 0,
  },
  {
    scale: 1,
    positionX: -0.408,
    positionY: 0.86,
    positionZ: -0.519,
    rotationX: 0,
    rotationY: 0.274,
    rotationZ: 0,
  },
  {
    scale: 1,
    positionX: -1.25,
    positionY: 0.86,
    positionZ: 0.38,
    rotationX: 0,
    rotationY: 1.322,
    rotationZ: 0,
  },
  {
    scale: 1,
    positionX: -0.892,
    positionY: 0.86,
    positionZ: 1.559,
    rotationX: 0,
    rotationY: 2.369,
    rotationZ: 0,
  },
  {
    scale: 1,
    positionX: 0.308,
    positionY: 0.86,
    positionZ: 1.839,
    rotationX: 0,
    rotationY: 3.416,
    rotationZ: 0,
  },
];

/**
 * Replicate one reference chair into six around the table center.
 *
 * Chair 0 is the reference, placed as-is. Chairs 1-5 are rotated copies: the
 * chair's offset from the table center is rotated 60° per step (Three.js Y
 * rotation), and its facing turns by the same angle so every chair faces the
 * table. Scale, height and tilt are carried over unchanged.
 */
export function replicateChairs(
  reference: ObjectTransform,
  tableCenter: { x: number; z: number },
  count = 6,
): ObjectTransform[] {
  const offsetX = reference.positionX - tableCenter.x;
  const offsetZ = reference.positionZ - tableCenter.z;

  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const positionX = tableCenter.x + offsetX * cos + offsetZ * sin;
    const positionZ = tableCenter.z - offsetX * sin + offsetZ * cos;
    return {
      scale: reference.scale,
      positionX,
      positionY: reference.positionY,
      positionZ,
      rotationX: reference.rotationX,
      rotationY: reference.rotationY + angle,
      rotationZ: reference.rotationZ,
    };
  });
}

export function roundTransform(t: ObjectTransform): ObjectTransform {
  return {
    scale: Number(t.scale.toFixed(3)),
    positionX: Number(t.positionX.toFixed(3)),
    positionY: Number(t.positionY.toFixed(3)),
    positionZ: Number(t.positionZ.toFixed(3)),
    rotationX: Number(t.rotationX.toFixed(3)),
    rotationY: Number(t.rotationY.toFixed(3)),
    rotationZ: Number(t.rotationZ.toFixed(3)),
  };
}

export const SLIDER_ROWS: { key: keyof ObjectTransform; label: string; min: number; max: number; step: number }[] = [
  { key: 'scale', label: 'Size', min: 0.2, max: 3, step: 0.01 },
  { key: 'positionX', label: 'Move X', min: -4, max: 4, step: 0.01 },
  { key: 'positionY', label: 'Move Y', min: -2, max: 4, step: 0.01 },
  { key: 'positionZ', label: 'Move Z', min: -4, max: 4, step: 0.01 },
  { key: 'rotationX', label: 'Tilt X', min: -3.14, max: 3.14, step: 0.01 },
  { key: 'rotationY', label: 'Turn Y', min: -3.14, max: 3.14, step: 0.01 },
  { key: 'rotationZ', label: 'Tilt Z', min: -3.14, max: 3.14, step: 0.01 },
];
