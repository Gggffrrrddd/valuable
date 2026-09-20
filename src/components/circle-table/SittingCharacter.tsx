import { useMemo } from 'react';
import type { Group } from 'three';
import { useModelLoader } from '@/components/focus-visuals/model-core';
import type { ObjectTransform } from './transformConfig';

const CHARACTER_URL = '/visuals/table/sitting-character-fixed.glb';

/**
 * Temporary preview of the sitting-character GLB, staged alongside the table
 * and chairs so its fit/orientation can be checked before it replaces them.
 *
 * The GLB keeps its own materials (unlike the OBJ chairs, which are re-wrapped)
 * so the authored character look survives as-is.
 */
function CharacterModel({ model, transform }: { model: Group; transform: ObjectTransform }) {
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

export default function SittingCharacter({ transform }: { transform: ObjectTransform }) {
  const { model, error } = useModelLoader(CHARACTER_URL);

  if (error) {
    console.error('[sitting-character] load failed:', error.message);
    return null;
  }
  if (!model) return null;

  return <CharacterModel model={model} transform={transform} />;
}
