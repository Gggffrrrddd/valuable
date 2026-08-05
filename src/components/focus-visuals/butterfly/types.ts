import type { Vector3 } from 'three';

export type ButterflyState = 'waiting' | 'flying' | 'landed';

export interface ButterflyPoint {
  id: number;
  position: Vector3;
  normal: Vector3;
  revealRank: number;
  frontFacing: boolean;
  rotation: number;
  scale: number;
  wingSpeed: number;
  wingAmplitude: number;
  depth: number;
  opacity: number;
  state: ButterflyState;
  targetPosition: Vector3;
  targetRotation: number;
  targetScale: number;
  targetOpacity: number;
  arrivalProgress: number;
  formationGroup: string;
  entryX: number;
  entryY: number;
}

export interface ButterflyNode {
  slot: HTMLSpanElement | null;
  flight: HTMLSpanElement | null;
  point: ButterflyPoint;
  startedAt: number;
}
