import { Box3, BufferGeometry, Camera, Mesh, Object3D, Vector2, Vector3 } from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

export interface SurfaceSample {
  position: Vector3;
  normal: Vector3;
  uv: Vector2;
  revealRank: number;
  twinklePhase: number;
  twinkleSpeed: number;
}

export interface ProjectedSurfaceSample extends SurfaceSample {
  x: number;
  y: number;
  depth: number;
}

interface SamplerEntry {
  sampler: MeshSurfaceSampler;
  mesh: Mesh;
  cumulativeArea: number;
}

export interface SampleModelSurfaceOptions {
  count: number;
  maxAttempts?: number;
  seed?: number;
  materialPath?: string;
  normalize?: boolean;
  acceptSample?: (sample: Pick<SurfaceSample, 'position' | 'normal' | 'uv'>) => boolean;
}

function seededRandom(seed: number) {
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

function geometrySurfaceArea(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  let area = 0;
  const triangleCount = index ? index.count / 3 : position.count / 3;
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    a.fromBufferAttribute(position, index ? index.getX(offset) : offset);
    b.fromBufferAttribute(position, index ? index.getX(offset + 1) : offset + 1);
    c.fromBufferAttribute(position, index ? index.getX(offset + 2) : offset + 2);
    area += b.sub(a).cross(c.sub(a)).length() * 0.5;
  }
  return area;
}

function collectSamplers(root: Object3D) {
  const entries: SamplerEntry[] = [];
  let cumulativeArea = 0;
  root.updateWorldMatrix(true, true);
  root.traverse((child) => {
    if (!(child instanceof Mesh) || !child.geometry.getAttribute('position')) return;
    cumulativeArea += Math.max(geometrySurfaceArea(child.geometry), 0.0001);
    entries.push({ sampler: new MeshSurfaceSampler(child).build(), mesh: child, cumulativeArea });
  });
  return entries;
}

export async function sampleModelSurface(modelPath: string, options: SampleModelSurfaceOptions): Promise<SurfaceSample[]> {
  const { count, maxAttempts = count * 12, seed = 9137, materialPath, normalize = true, acceptSample } = options;
  const loader = new OBJLoader();
  if (materialPath) {
    const materials = await new MTLLoader().loadAsync(materialPath);
    materials.preload();
    loader.setMaterials(materials);
  }
  const root = await loader.loadAsync(modelPath);
  const samplers = collectSamplers(root);
  if (samplers.length === 0) throw new Error(`Model contains no renderable mesh: ${modelPath}`);

  const bounds = new Box3().setFromObject(root);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const normalizationScale = normalize ? 1.9 / Math.max(size.x, size.y, size.z, 0.0001) : 1;
  const random = seededRandom(seed);
  const samples: SurfaceSample[] = [];
  const localPosition = new Vector3();
  const localNormal = new Vector3();
  const localUv = new Vector2();

  const nativeRandom = Math.random;
  Math.random = random;
  try {
    for (let attempt = 0; attempt < maxAttempts && samples.length < count; attempt += 1) {
      const targetArea = random() * samplers[samplers.length - 1].cumulativeArea;
      const entry = samplers.find((candidate) => targetArea <= candidate.cumulativeArea) ?? samplers[samplers.length - 1];
      entry.sampler.sample(localPosition, localNormal, undefined, localUv);
      const position = entry.mesh.localToWorld(localPosition.clone());
      if (normalize) position.sub(center).multiplyScalar(normalizationScale);
      const normal = localNormal.clone().transformDirection(entry.mesh.matrixWorld).normalize();
      const uv = localUv.clone();
      if (acceptSample && !acceptSample({ position, normal, uv })) continue;
      samples.push({
        position,
        normal,
        uv,
        revealRank: 0,
        twinklePhase: random() * Math.PI * 2,
        twinkleSpeed: 0.0009 + random() * 0.00085,
      });
    }
  } finally {
    Math.random = nativeRandom;
  }
  const revealRanks = shuffledRanks(samples.length, random);
  samples.forEach((sample, index) => {
    sample.revealRank = revealRanks[index];
  });
  return samples;
}

export function projectSurfaceSamples(
  samples: SurfaceSample[],
  camera: Camera,
  width: number,
  height: number,
): ProjectedSurfaceSample[] {
  return samples.map((sample) => {
    const projected = sample.position.clone().project(camera);
    return {
      ...sample,
      x: (projected.x * 0.5 + 0.5) * width,
      y: (-projected.y * 0.5 + 0.5) * height,
      depth: projected.z,
    };
  });
}
