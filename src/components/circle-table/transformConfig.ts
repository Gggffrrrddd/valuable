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
  positionX: 0,
  positionY: 0,
  positionZ: 1.15,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
};

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
