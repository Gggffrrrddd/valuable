import { useMemo } from 'react';
import type { Group } from 'three';
import { normalizeModel, useModelLoader } from '@/components/focus-visuals/model-core';
import type { ObjectTransform } from './transformConfig';

const BOOK_URL = '/visuals/table/open_book_table_ready.glb';

/**
 * One book on the table. Clones the shared source model per instance — a
 * three.js object can only have one parent, so a single clone mounted in six
 * groups would only render in the last one.
 */
function BookModel({
  model,
  transform,
}: {
  model: Group;
  transform: ObjectTransform;
}) {
  const staged = useMemo(() => {
    const clone = model.clone(true);
    // Books are small desktop props; normalize to a ~0.5-unit book.
    normalizeModel(clone, 0.5);
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

/**
 * Six book models on the table, one per seat, all built from a single reference
 * transform. The GLB keeps its own materials so the authored look survives.
 */
export default function Books({
  transforms,
  origin = [0, 0],
}: {
  transforms: ObjectTransform[];
  origin?: [number, number];
}) {
  const { model, error } = useModelLoader(BOOK_URL);

  if (error) {
    console.error('[book] load failed:', error.message);
    return null;
  }
  if (!model) return null;

  return (
    <group>
      {transforms.map((transform, i) => (
        <BookModel
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
