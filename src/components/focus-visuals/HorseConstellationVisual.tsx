import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box3, DoubleSide, Group, ShaderMaterial, Vector3 } from 'three';
import type { Texture } from 'three';
import type { FocusVisualProps } from './types';
import {
  ConstellationPoints,
  ModelVisualFallback,
  applyWrapTexture,
  clamp01,
  createSpinBehaviorController,
  normalizeModel,
  preloadAssets,
  useModelLoader,
  useReducedMotion,
  useSurfacePoints,
  useTextureLoader,
} from './model-core';
import type { SpinBehaviorConfig } from './model-core';

/**
 * Thin model-visual wrapper. All loading / sampling / rotation / fallback
 * logic lives in `model-core` — this file only holds horse-specific config:
 * the reveal shader (ported 1:1 from the previous standalone WebGL pass)
 * and the slow carousel rotation.
 */

const MODEL_URL = '/visuals/horse/horse.obj';
const TEXTURE_URL = '/visuals/horse/horse-texture-web.jpg';
const HORSE_POINT_COUNT = 320;
const HORSE_TILT = -4.3 * Math.PI / 180;

/** One slow turn every 24 seconds; fully static under reduced motion. */
const HORSE_SPIN_CONFIG: SpinBehaviorConfig = {
  spinSpeed: (Math.PI * 2) / 24,
  reducedSpinSpeed: 0,
};

const VERTEX_SHADER = `
  uniform float uCenterY;
  uniform float uCenterZ;
  uniform float uRadius;
  varying vec2 vUv;
  varying float vManeWeight;
  varying float vManeStrand;

  void main() {
    vec3 displaced = position;
    float upperNeck = smoothstep(uCenterY + uRadius * 0.2, uCenterY + uRadius * 0.43, position.y)
      * (1.0 - smoothstep(uCenterY + uRadius * 0.7, uCenterY + uRadius * 0.83, position.y));
    float neckLength = smoothstep(uCenterZ - uRadius * 0.38, uCenterZ - uRadius * 0.08, position.z)
      * (1.0 - smoothstep(uCenterZ + uRadius * 0.22, uCenterZ + uRadius * 0.48, position.z));
    float maneWeight = upperNeck * neckLength;
    float strand = sin(position.y * 154.0 + position.z * 41.0) * 0.55
      + sin(position.y * 263.0 - position.z * 67.0) * 0.3
      + sin(position.y * 419.0 + position.z * 29.0) * 0.15;
    float taperedLift = maneWeight * (0.006 + (strand * 0.5 + 0.5) * 0.009);
    displaced.x += taperedLift;
    displaced.z -= maneWeight * (0.004 + strand * 0.003);
    displaced.y += maneWeight * max(0.0, strand) * 0.004;
    vUv = uv;
    vManeWeight = maneWeight;
    vManeStrand = strand;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform sampler2D uTexture;
  uniform float uProgress;
  varying vec2 vUv;
  varying float vManeWeight;
  varying float vManeStrand;

  float hash(vec2 value) {
    return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec4 textureColor = texture2D(uTexture, vUv);
    float blueStrength = textureColor.b - min(textureColor.r, textureColor.g);
    float blueMask = smoothstep(0.025, 0.14, blueStrength) * smoothstep(0.08, 0.3, textureColor.b);
    float revealOrder = clamp(vUv.y * 0.72 + hash(floor(vUv * 210.0)) * 0.28, 0.0, 1.0);
    float revealed = smoothstep(revealOrder - 0.025, revealOrder + 0.018, uProgress);
    float strandSeparation = mix(1.0, smoothstep(-0.72, -0.18, vManeStrand), vManeWeight * 0.28);
    float strandSheen = vManeWeight * smoothstep(0.35, 0.92, vManeStrand) * 0.13;
    vec3 finalColor = textureColor.rgb + vec3(0.16, 0.28, 0.4) * strandSheen;
    gl_FragColor = vec4(finalColor, textureColor.a * blueMask * revealed * strandSeparation);
  }
`;

function HorseModel({ sourceModel, sourceTexture, progress, running, preview, reducedMotion }: {
  sourceModel: Group;
  sourceTexture: Texture;
  progress: number;
  running: boolean;
  preview: boolean;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const progressRef = useRef(clamp01(progress));
  progressRef.current = clamp01(progress);
  const controller = useMemo(() => createSpinBehaviorController(HORSE_SPIN_CONFIG), []);

  const prepared = useMemo(() => {
    const clone = sourceModel.clone(true);
    // Raw-space bounds feed the mane mask uniforms; then normalize for display.
    const bounds = new Box3().setFromObject(clone);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const radius = Math.max(size.x, size.y, size.z) / 2;
    normalizeModel(clone, 1.76);
    return { clone, centerY: center.y, centerZ: center.z, radius };
  }, [sourceModel]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTexture: { value: sourceTexture },
          uProgress: { value: clamp01(progress) },
          uCenterY: { value: prepared.centerY },
          uCenterZ: { value: prepared.centerZ },
          uRadius: { value: prepared.radius },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        side: DoubleSide,
      }),
    // Uniforms are mutated per-frame; recreate only when the assets change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prepared, sourceTexture],
  );

  useEffect(() => {
    applyWrapTexture(prepared.clone, material);
  }, [prepared, material]);

  useEffect(() => () => material.dispose(), [material]);

  const { points } = useSurfacePoints(prepared.clone, HORSE_POINT_COUNT, { normalize: false, seed: 4211 });

  useFrame((_state, delta) => {
    const pose = controller.update(delta, {
      progress: progressRef.current,
      running: running && !preview,
      finaleActive: false,
      complete: progressRef.current >= 1,
      reducedMotion,
    });
    if (groupRef.current) {
      groupRef.current.rotation.y = (preview ? -0.42 : 0) + pose.spinAngle;
    }
    material.uniforms.uProgress.value = progressRef.current;
  });

  return (
    <group ref={groupRef} rotation={[0, 0, HORSE_TILT]}>
      <primitive object={prepared.clone} />
      <ConstellationPoints
        points={points ?? []}
        progress={progress}
        color="#7cb6ff"
        accentColor="#eaf5ff"
        size={0.05}
        staticMode={reducedMotion}
      />
    </group>
  );
}

interface HorseConstellationProps extends FocusVisualProps {
  duration: number;
}

export default function HorseConstellationVisual({ progress, duration }: HorseConstellationProps) {
  const reducedMotion = useReducedMotion();
  const { model, isLoading: modelLoading, error: modelError } = useModelLoader(MODEL_URL);
  const { texture, isLoading: textureLoading, error: textureError } = useTextureLoader(TEXTURE_URL);

  const error = modelError ?? textureError;
  if (error) {
    return <ModelVisualFallback visualLabel="Starlight Horse" reason={error} progress={progress} duration={duration} />;
  }

  const loading = modelLoading || textureLoading || !model || !texture;
  const preview = duration <= 0;
  const complete = progress >= 1;

  return (
    <div
      className={`horse-constellation focus-visual ${loading ? 'horse-constellation--loading' : 'horse-constellation--ready'} ${complete ? 'visual-complete' : ''}`}
      role="img"
      aria-label={`Horse constellation ${Math.round(clamp01(progress) * 100)} percent complete`}
    >
      <div className="horse-constellation__aura" aria-hidden="true" />
      <div className="horse-constellation__floor" aria-hidden="true" />
      <div className="horse-constellation__canvas" aria-hidden="true">
        {model && texture && (
          <Canvas camera={{ position: [0, 0.12, 2.6], fov: 42 }} dpr={[1, 1.75]} gl={{ alpha: true, antialias: true }}>
            <ambientLight intensity={0.4} />
            <HorseModel
              sourceModel={model}
              sourceTexture={texture}
              progress={clamp01(progress)}
              running={!preview}
              preview={preview}
              reducedMotion={reducedMotion}
            />
          </Canvas>
        )}
      </div>
      <div className="horse-constellation__completion visual-finish-glow" aria-hidden="true" />
    </div>
  );
}

preloadAssets(MODEL_URL, TEXTURE_URL);
