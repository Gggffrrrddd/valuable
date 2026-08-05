import { Box3, Mesh, Vector3 } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import type { ButterflyPoint } from './types';

const LION_MODEL_URL = '/visuals/butterfly-mosaic/models/lion.obj';

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffledRanks(count: number, seed: number) {
  const ranks = Array.from({ length: count }, (_, index) => index);
  const random = seededRandom(seed);
  for (let index = count - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [ranks[index], ranks[swap]] = [ranks[swap], ranks[index]];
  }
  return ranks;
}

export async function sampleLionSurface(count: number, seed = 48271): Promise<ButterflyPoint[]> {
  const object = await new OBJLoader().loadAsync(LION_MODEL_URL);
  let mesh: Mesh | null = null;
  object.traverse((child) => {
    if (!mesh && child instanceof Mesh) mesh = child;
  });
  if (!mesh) throw new Error('Lion model contains no mesh');

  const bounds = new Box3().setFromObject(object);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const normalize = 1.82 / Math.max(size.x, size.y, size.z);
  const random = seededRandom(seed);
  const sampler = new MeshSurfaceSampler(mesh).build();
  const ranks = shuffledRanks(count, seed + 17);
  const position = new Vector3();
  const normal = new Vector3();

  const nativeRandom = Math.random;
  Math.random = random;
  try {
    return Array.from({ length: count }, (_, id) => {
      sampler.sample(position, normal);
      const targetPosition = position.clone().sub(center).multiplyScalar(normalize);
      targetPosition.y += .02;
      const targetNormal = normal.clone().normalize();
      const side = Math.floor(seededUnit(id + seed + 91) * 4);
      const entryX = side === 0 ? -58 : side === 1 ? 158 : 28 + seededUnit(id + 31) * 44;
      const entryY = side === 2 ? -42 : side === 3 ? 142 : 22 + seededUnit(id + 53) * 56;
      const scale = .72 + seededUnit(id + 71) * .42;
      return {
        id,
        position: targetPosition.clone(),
        normal: targetNormal,
        revealRank: ranks[id],
        frontFacing: targetNormal.z >= 0,
        rotation: Math.atan2(targetNormal.y, targetNormal.x) * 180 / Math.PI + 90 + (seededUnit(id + 81) - .5) * 22,
        scale,
        wingSpeed: 2.8 + seededUnit(id + 101) * 2.4,
        wingAmplitude: 18 + seededUnit(id + 121) * 16,
        depth: 0,
        opacity: 0,
        state: 'waiting' as const,
        targetPosition,
        targetRotation: 0,
        targetScale: scale,
        targetOpacity: 1,
        arrivalProgress: 0,
        formationGroup: 'lion',
        entryX,
        entryY,
      };
    });
  } finally {
    Math.random = nativeRandom;
  }
}
