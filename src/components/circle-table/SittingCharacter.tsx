import { useMemo } from 'react';
import type { Group } from 'three';
import { useModelLoader } from '@/components/focus-visuals/model-core';
import type { ObjectTransform } from './transformConfig';

const CHARACTER_URL = '/visuals/table/sitting-character-final.glb';

/**
 * Sitting-character chairs: the GLB keeps its own materials (unlike the OBJ
 * chairs, which are re-wrapped) so the authored character+chair look survives.
 *
 * One reference transform is replicated into six, placed on the same seat
 * positions the original chairs use, so the character's chair legs land
 * exactly where the original chair legs were.
 */
function CharacterModel({
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

export default function SittingCharacter({
  transforms,
  origin = [0, 0],
}: {
  transforms: ObjectTransform[];
  origin?: [number, number];
}) {
  const { model, error } = useModelLoader(CHARACTER_URL);

  if (error) {
    console.error('[sitting-character] load failed:', error.message);
    return null;
  }
  if (!model) return null;

  return (
    <group>
      {transforms.map((transform, i) => (
        <CharacterModel
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