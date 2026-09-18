import { useEffect, useMemo } from 'react';
import type { Group, Texture } from 'three';
import { Mesh } from 'three';
import {
  createWrapTextureMaterial,
  normalizeModel,
  useModelLoader,
  useTextureLoader,
} from '@/components/focus-visuals/model-core';
import type { ObjectTransform } from './transformConfig';

const CHAIR_OBJ_URL = '/visuals/table/chair-3d.obj';
const CHAIR_TEXTURE_URL = '/visuals/table/chair-3d-texture.png';

/**
 * Shared chair asset staged once, then instanced per seat by <Chairs/>.
 *
 * The chair's own +Y is its up axis (tallest span), so it needs no re-tiling —
 * it sits upright as loaded. Table-space conversion happens at the group level.
 */
function Chair({
  model,
  texture,
  transform,
}: {
  model: Group;
  texture: Texture;
  transform: ObjectTransform;
}) {
  const staged = useMemo(() => {
    const clone = model.clone(true);
    const material = createWrapTextureMaterial([texture], {
      roughness: 0.28,
      metalness: 0.3,
      clearcoat: 0.8,
      clearcoatRoughness: 0.16,
      sheen: 0.18,
      sheenColor: '#e2d3b8',
    });
    clone.traverse((child) => {
      if (child instanceof Mesh) child.material = material;
    });
    // Chair spans ~0.92 tall; normalize to a 0.9-unit chair.
    normalizeModel(clone, 0.9);
    return clone;
  }, [model, texture]);

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
  const { model, error: modelError } = useModelLoader(CHAIR_OBJ_URL);
  const { texture, error: textureError } = useTextureLoader(CHAIR_TEXTURE_URL);

  useEffect(() => {
    if (modelError || textureError) {
      console.error('[chair] load failed:', (modelError ?? textureError)?.message);
    }
  }, [modelError, textureError]);

  if (!model || !texture) return null;
  return (
    <group>
      {transforms.map((transform, i) => (
        <Chair
          key={i}
          model={model}
          texture={texture}
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
