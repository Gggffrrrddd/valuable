import { useEffect, useMemo } from 'react';
import { Mesh, MeshPhysicalMaterial, SRGBColorSpace, Vector3 } from 'three';
import type { Material, Object3D, Texture } from 'three';

/**
 * Shared texture-wrapping for model visuals.
 *
 * Parameterized by how many view textures are provided:
 * - 1 texture  → simple wrap (map + optional emissive), e.g. the beyblade.
 * - N textures → multi-angle directional blend: each texture is weighted by
 *   how strongly the surface normal faces its view direction, so a model
 *   baked from N camera angles blends seamlessly as it rotates.
 *
 * No separate code paths — the same function handles both cases.
 */

export interface WrapTextureOptions {
  emissive?: string;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  sheenColor?: string;
  transparent?: boolean;
  opacity?: number;
  /** Style tweaks shared by all views (applied to every blended texture). */
  flipY?: boolean;
  anisotropy?: number;
}

/** Default view directions used when N textures are given without explicit directions. */
export function defaultViewDirections(count: number): Vector3[] {
  const directions: Vector3[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    directions.push(new Vector3(Math.sin(angle), 0.18, Math.cos(angle)).normalize());
  }
  return directions;
}

function prepareTexture(texture: Texture, options: WrapTextureOptions): Texture {
  const prepared = texture.clone();
  prepared.colorSpace = SRGBColorSpace;
  prepared.flipY = options.flipY ?? true;
  prepared.anisotropy = options.anisotropy ?? 8;
  prepared.needsUpdate = true;
  return prepared;
}

/**
 * Create the wrap material. Provide one texture for a simple wrap or several
 * (with matching `viewDirections`) for a directional multi-view blend.
 */
export function createWrapTextureMaterial(
  textures: Texture[],
  options: WrapTextureOptions = {},
  viewDirections?: Vector3[],
): Material {
  if (textures.length === 0) {
    return new MeshPhysicalMaterial({ color: '#888888' });
  }

  const base = new MeshPhysicalMaterial({
    map: prepareTexture(textures[0], options),
    emissive: options.emissive ?? '#ffffff',
    emissiveMap: prepareTexture(textures[0], options),
    emissiveIntensity: options.emissiveIntensity ?? 0.065,
    roughness: options.roughness ?? 0.21,
    metalness: options.metalness ?? 0.31,
    clearcoat: options.clearcoat ?? 0.78,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.17,
    sheen: options.sheen ?? 0.22,
    sheenColor: options.sheenColor ?? '#d8c0a0',
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    depthWrite: !(options.transparent ?? false),
  });

  if (textures.length === 1) return base;

  // Multi-view directional blend: weight each texture by dot(normal, direction).
  const directions = viewDirections ?? defaultViewDirections(textures.length);
  const maps = textures.map((texture) => prepareTexture(texture, options));
  base.customProgramCacheKey = () => `wrap-blend-${maps.length}`;
  base.onBeforeCompile = (shader) => {
    for (let index = 1; index < maps.length; index += 1) {
      shader.uniforms[`uViewMap${index}`] = { value: maps[index] };
      shader.uniforms[`uViewDir${index}`] = { value: directions[index] };
    }
    shader.uniforms.uViewDir0 = { value: directions[0] };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        ${maps.slice(1).map((_, index) => `uniform sampler2D uViewMap${index + 1};\nuniform vec3 uViewDir${index + 1};`).join('\n')}
        uniform vec3 uViewDir0;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          vec3 blendNormal = normalize(vNormal);
          float bestWeight = max(dot(blendNormal, uViewDir0), 0.0);
          vec4 blended = texture2D(map, vMapUv) * bestWeight;
          float weightSum = bestWeight;
          ${maps
            .slice(1)
            .map(
              (_, index) => `float w${index + 1} = max(dot(blendNormal, uViewDir${index + 1}), 0.0);
          blended += texture2D(uViewMap${index + 1}, vMapUv) * w${index + 1};
          weightSum += w${index + 1};`,
            )
            .join('\n')}
          if (weightSum > 0.0) diffuseColor = blended / weightSum;
        }`,
      );
  };
  return base;
}

/**
 * Apply a wrap-texture material to every mesh of a model.
 * Usable imperatively (`applyWrapTexture`) or declaratively inside a Canvas
 * (`<ModelWrapTexture />`). Never throws — a model without meshes is a no-op.
 */
export function applyWrapTexture(
  model: Object3D | null,
  material: Material | null,
): void {
  if (!model || !material) return;
  model.traverse((child) => {
    if (child instanceof Mesh) {
      if (!child.geometry.getAttribute('normal')) child.geometry.computeVertexNormals();
      child.material = material;
    }
  });
}

interface ModelWrapTextureProps {
  model: Object3D | null;
  textures: Texture[];
  options?: WrapTextureOptions;
  viewDirections?: Vector3[];
}

/** Declarative form: applies the wrap material for as long as it is mounted. */
export default function ModelWrapTexture({ model, textures, options = {}, viewDirections }: ModelWrapTextureProps) {
  const material = useMemo(
    () => (textures.length ? createWrapTextureMaterial(textures, options, viewDirections) : null),
    // Texture identity + option JSON fully describe the material.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [textures, JSON.stringify(options), viewDirections],
  );

  useEffect(() => {
    applyWrapTexture(model, material);
  }, [model, material]);

  return null;
}
