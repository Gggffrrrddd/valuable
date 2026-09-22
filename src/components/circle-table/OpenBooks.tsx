import { useMemo } from 'react';
import type { Group } from 'three';
import { useModelLoader } from '@/components/focus-visuals/model-core';
import type { ObjectTransform } from './transformConfig';

const OPEN_BOOK_URL = '/visuals/table/open-book-table-ready.glb';

function OpenBookModel({ model, transform }: { model: Group; transform: ObjectTransform }) {
  const staged = useMemo(() => model.clone(true), [model]);
  return (
    <group
      position={[transform.positionX, transform.positionY, transform.positionZ]}
      rotation={[0, transform.rotationY, 0]}
      scale={transform.scale}
    >
      {/* Tilt lives on an inner group so the seat's Y turn cannot leak into the
          X/Z tilt (default XYZ Euler order would couple them). */}
      <group rotation={[transform.rotationX, 0, transform.rotationZ]}>
        <primitive object={staged} />
      </group>
    </group>
  );
}

export default function OpenBooks({ transforms, origin = [0, 0] }: { transforms: ObjectTransform[]; origin?: [number, number] }) {
  const { model, error } = useModelLoader(OPEN_BOOK_URL);
  if (error) { console.error('[open-book] load failed:', error.message); return null; }
  if (!model) return null;
  return (
    <group>
      {transforms.map((t, i) => (
        <OpenBookModel key={i} model={model} transform={{ ...t, positionX: t.positionX - origin[0], positionZ: t.positionZ - origin[1] }} />
      ))}
    </group>
  );
}
