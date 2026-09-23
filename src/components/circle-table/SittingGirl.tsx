import { useMemo } from 'react';
import type { Group } from 'three';
import { useModelLoader } from '@/components/focus-visuals/model-core';
import type { ObjectTransform } from './transformConfig';

const GIRL_URL = '/visuals/table/girl-project-premium.glb';

/**
 * Girl character chairs: same staging/orbit pattern as SittingCharacter,
 * loading the premium girl GLB instead of the boy model.
 */
function GirlModel({
  model,
  transform,
}: {
  model: Group;
  transform: ObjectTransform;
}) {
  const staged = useMemo(() => model.clone(true), [model]);

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

export default function SittingGirl({
  transforms,
  origin = [0, 0],
}: {
  transforms: ObjectTransform[];
  origin?: [number, number];
}) {
  const { model, error } = useModelLoader(GIRL_URL);

  if (error) {
    console.error('[sitting-girl] load failed:', error.message);
    return null;
  }
  if (!model) return null;

  return (
    <group>
      {transforms.map((transform, i) => (
        <GirlModel
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
