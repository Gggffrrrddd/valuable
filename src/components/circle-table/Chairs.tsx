import { useEffect, useMemo } from 'react';
import type { Group } from 'three';
import {
  normalizeModel,
  useModelLoader,
} from '@/components/focus-visuals/model-core';
import type { ObjectTransform } from './transformConfig';

const CHAIR_MODEL_URL = '/visuals/table/sitting-character-fixed.glb';

/**
 * Shared chair asset staged once, then instanced per seat by <Chairs/>.
 *
 * The chair's own +Y is its up axis (tallest span), so it needs no re-tiling —
 * it sits upright as loaded. Table-space conversion happens at the group level.
 */
function Chair({
  model,
  transform,
}: {
  model: Group;
  transform: ObjectTransform;
}) {
  const staged = useMemo(() => {
    const clone = model.clone(true);
    normalizeModel(clone, 0.9);
    return clone;
  }, [model]);

  return (
    <group
      position={[transform.positionX, transform.positionY, transform.positionZ]}
      rotation={[transform.rotationX, transform.rotationY, transform.rotationZ]}
      scale={transform.scale}
    >
      <primitive object={staged} />
    </group>
  );
}

export default function Chairs({
  transforms,
  origin = [0, 0],
}: {
  transforms: ObjectTransform[];
  origin?: [number, number];
}) {
  const { model, error: modelError } = useModelLoader(CHAIR_MODEL_URL);

  useEffect(() => {
    if (modelError) {
      console.error('[chair] load failed:', modelError.message);
    }
  }, [modelError]);

  if (!model) return null;
  return (
    <group>
      {transforms.map((transform, i) => (
        <Chair
          key={i}
          model={model}
          transform={{
            ...transform,
            positionX: transform.positionX - origin[0],
            positionZ: transform.positionZ - origin[1],
          }}
        />
      ))}
    </group>
  );
}
