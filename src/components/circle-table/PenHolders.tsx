import { useMemo } from 'react';
import type { Group } from 'three';
import { useModelLoader } from '@/components/focus-visuals/model-core';
import type { ObjectTransform } from './transformConfig';

const PEN_HOLDER_URL = '/visuals/table/pen-holder-table-ready.glb';

/**
 * One pen holder on the table. Clones the shared source model per instance — a
 * three.js object can only have one parent, so a single clone mounted in six
 * groups would only render in the last one.
 */
function PenHolderModel({
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

/**
 * Six pen holders on the table, one per seat, all built from a single reference
 * transform replicated 60 degrees apart. The GLB keeps its own materials so the
 * authored look survives.
 */
export default function PenHolders({
  transforms,
  origin = [0, 0],
}: {
  transforms: ObjectTransform[];
  origin?: [number, number];
}) {
  const { model, error } = useModelLoader(PEN_HOLDER_URL);

  if (error) {
    console.error('[pen-holder] load failed:', error.message);
    return null;
  }
  if (!model) return null;

  return (
    <group>
      {transforms.map((transform, i) => (
        <PenHolderModel
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
