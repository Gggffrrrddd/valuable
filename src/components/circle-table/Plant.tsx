import { useMemo } from 'react';
import type { Group } from 'three';
import { useModelLoader } from '@/components/focus-visuals/model-core';
import type { ObjectTransform } from './transformConfig';

const PLANT_URL = '/visuals/table/plant-table-ready.glb';

/**
 * One plant on the table. Clones the shared source model per instance — a
 * three.js object can only have one parent, so a single clone mounted in
 * several groups would only render in the last one.
 */
function PlantModel({
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

export default function Plant({
  transforms,
  origin = [0, 0],
}: {
  transforms: ObjectTransform[];
  origin?: [number, number];
}) {
  const { model, error } = useModelLoader(PLANT_URL);

  if (error) {
    console.error('[plant] load failed:', error.message);
    return null;
  }
  if (!model) return null;

  return (
    <group>
      {transforms.map((transform, i) => (
        <PlantModel
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
