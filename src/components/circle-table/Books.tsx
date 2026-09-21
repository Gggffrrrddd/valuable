import { useMemo } from 'react';
import { normalizeModel, useModelLoader } from '@/components/focus-visuals/model-core';
import type { ObjectTransform } from './transformConfig';

const BOOK_URL = '/visuals/table/book-v2.glb';

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

  const staged = useMemo(() => {
    if (!model) return null;
    const clone = model.clone(true);
    // Books are small desktop props; normalize to a ~0.5-unit book.
    normalizeModel(clone, 0.5);
    return clone;
  }, [model]);

  if (error) {
    console.error('[book] load failed:', error.message);
    return null;
  }
  if (!model || !staged) return null;

  return (
    <group>
      {transforms.map((transform, i) => (
        <group
          key={i}
          position={[
            transform.positionX - origin[0],
            transform.positionY,
            transform.positionZ - origin[1],
          ]}
          rotation={[transform.rotationX, transform.rotationY, transform.rotationZ]}
          scale={transform.scale}
        >
          <primitive object={staged} />
        </group>
      ))}
    </group>
  );
}
