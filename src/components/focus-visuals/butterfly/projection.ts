import { Vector3 } from 'three';

export interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
  scale: number;
  rotation: number;
  frontFacing: boolean;
}

export function projectPoint(position: Vector3, normal: Vector3, angle: number): ProjectedPoint {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = position.x * cos + position.z * sin;
  const z = -position.x * sin + position.z * cos;
  const normalX = normal.x * cos + normal.z * sin;
  const normalZ = -normal.x * sin + normal.z * cos;
  const perspective = 1 / (2.9 - z * .42);
  return {
    x: 50 + x * perspective * 72,
    y: 51 - position.y * perspective * 74,
    depth: z,
    scale: .76 + perspective * .9,
    rotation: Math.atan2(normal.y, normalX) * 180 / Math.PI + 90,
    frontFacing: normalZ >= 0,
  };
}

export function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}
