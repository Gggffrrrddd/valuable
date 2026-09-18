import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Group, Texture } from 'three';
import { Mesh } from 'three';
import {
  createWrapTextureMaterial,
  normalizeModel,
  useModelLoader,
  useReducedMotion,
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
  spin,
}: {
  model: Group;
  texture: Texture;
  transform: ObjectTransform;
  spin: boolean;
}) {
  const ref = useRef<Group>(null);

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

  useFrame((_state, delta) => {
    if (!ref.current) return;
    // Orbit the table when the master rotation is on; the chair keeps facing
    // the table by turning in place with the orbit angle.
    if (spin) ref.current.rotation.y += delta * 0.05;
  });

  return (
    <group
      ref={ref}
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
  spin,
}: {
  transforms: ObjectTransform[];
  spin: boolean;
}) {
  const reduced = useReducedMotion();
  const { model, error: modelError } = useModelLoader(CHAIR_OBJ_URL);
  const { texture, error: textureError } = useTextureLoader(CHAIR_TEXTURE_URL);

  useEffect(() => {
    if (modelError || textureError) {
      console.error('[chair] load failed:', (modelError ?? textureError)?.message);
    }
  }, [modelError, textureError]);

  if (!model || !texture) return null;
  if (reduced) {
    return (
      <group>
        {transforms.map((transform, i) => (
          <Chair key={i} model={model} texture={texture} transform={transform} spin={false} />
        ))}
      </group>
    );
  }

  return (
    <group>
      {transforms.map((transform, i) => (
        <Chair key={i} model={model} texture={texture} transform={transform} spin={spin} />
      ))}
    </group>
  );
}
