import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import { Mesh, SRGBColorSpace } from 'three';
import {
  ModelVisualFallback,
  createWrapTextureMaterial,
  normalizeModel,
  useModelLoader,
  useTextureLoader,
} from '@/components/focus-visuals/model-core';
import type { MountainTransform } from './mountainConfig';

const EVEREST_OBJ_URL = '/visuals/compete/model/everest.obj';
const EVEREST_TEXTURE_URL = '/visuals/compete/model/everest-texture.png';

export default function EverestScene3D({ transform }: { transform: MountainTransform }) {
  const { model, error: modelError } = useModelLoader(EVEREST_OBJ_URL);
  const { texture, error: textureError } = useTextureLoader(EVEREST_TEXTURE_URL);

  const error = modelError ?? textureError;

  if (error) {
    return <ModelVisualFallback visualLabel="Everest" reason={error} progress={0} />;
  }
  if (!model || !texture) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-xs text-stone-600 animate-pulse-soft">Loading the mountain…</div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{
          position: [0, transform.cameraHeight, transform.cameraDistance],
          fov: 38,
        }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ambientLight intensity={0.4} color="#d8dce4" />
        <directionalLight position={[4, 6, 3]} intensity={1.4} color="#fff3dd" />
        <directionalLight position={[-4, 3, -2]} intensity={0.5} color="#9fb4d8" />

        <EverestModel model={model} texture={texture} transform={transform} />
      </Canvas>
    </div>
  );
}

function EverestModel({
  model,
  texture,
  transform,
}: {
  model: NonNullable<ReturnType<typeof useModelLoader>['model']>;
  texture: NonNullable<ReturnType<typeof useTextureLoader>['texture']>;
  transform: MountainTransform;
}) {
  const staged = useMemo(() => {
    const clone = model.clone(true);
    texture.colorSpace = SRGBColorSpace;
    const material = createWrapTextureMaterial([texture], {
      roughness: 0.9,
      metalness: 0.02,
    });
    clone.traverse((child) => {
      if (child instanceof Mesh) child.material = material;
    });
    normalizeModel(clone, 3.2);
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
