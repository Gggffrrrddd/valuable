import { Box3, Mesh, Vector3 } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

const LION_MODEL_URL = '/visuals/butterfly-mosaic/models/lion.obj';

export interface LionConstellationPoint {
  id: number;
  position: Vector3;
  revealRank: number;
  twinklePhase: number;
  twinkleSpeed: number;
  accent: number;
}

function randomFactory(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffledRanks(count: number, random: () => number) {
  const ranks = Array.from({ length: count }, (_, index) => index);
  for (let index = count - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [ranks[index], ranks[swap]] = [ranks[swap], ranks[index]];
  }
  return ranks;
}

export async function sampleLionConstellation(count: number, seed: number): Promise<LionConstellationPoint[]> {
  const root = await new OBJLoader().loadAsync(LION_MODEL_URL);
  let mesh: Mesh | null = null;
  root.traverse((child) => {
    if (!mesh && child instanceof Mesh) mesh = child;
  });
  if (!mesh) throw new Error('Lion model contains no mesh');

  const bounds = new Box3().setFromObject(root);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const normalize = 1.9 / Math.max(size.x, size.y, size.z);
  const random = randomFactory(seed);
  const ranks = shuffledRanks(count, random);
  const sampler = new MeshSurfaceSampler(mesh).build();
  const position = new Vector3();
  const nativeRandom = Math.random;
  Math.random = random;
  try {
    return Array.from({ length: count }, (_, id) => {
      sampler.sample(position);
      return {
        id,
        position: position.clone().sub(center).multiplyScalar(normalize),
        revealRank: ranks[id],
        twinklePhase: random() * Math.PI * 2,
        twinkleSpeed: .0009 + random() * .00085,
        accent: random(),
      };
    });
  } finally {
    Math.random = nativeRandom;
  }
}
