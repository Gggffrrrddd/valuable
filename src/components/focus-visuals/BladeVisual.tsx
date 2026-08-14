import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, CanvasTexture, Group, Mesh, PointLight, SRGBColorSpace, SpriteMaterial } from 'three';
import type { Texture } from 'three';
import type { FocusVisualProps } from './types';
import {
  BLADE_SPIN_CONFIG,
  ModelVisualFallback,
  clamp01,
  createGlowTexture,
  createSpinBehaviorController,
  createWrapTextureMaterial,
  normalizeModel,
  preloadAssets,
  smoothstep,
  useModelLoader,
  useReducedMotion,
  useTextureLoader,
} from './model-core';

/**
 * Thin model-visual wrapper. All loading / texturing / spin behavior lives in
 * `model-core` — this file only holds blade-specific config and staging.
 */

const BLADE_OBJ_URL = 'https://res.cloudinary.com/dcydj6gao/raw/upload/v1785732533/beyblade_poes3s.obj';
const BLADE_TEXTURE_URL = '/visuals/blade/texture-vibrant.jpg';
const DEFECT_CENTER = { x: -.008, z: .178 };
const DEFECT_RADIUS = { x: .092, z: .075 };
const DEFECT_BASE_Y = -.176;

/** Blade-specific: soften a visible mold defect under the tip. */
function applyBladeDefect(clone: Group) {
  clone.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const geometry = child.geometry.clone();
    const positions = geometry.attributes.position.clone() as BufferAttribute;
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const z = positions.getZ(index);
      if (y >= DEFECT_BASE_Y) continue;
      const distance = Math.hypot((x - DEFECT_CENTER.x) / DEFECT_RADIUS.x, (z - DEFECT_CENTER.z) / DEFECT_RADIUS.z);
      if (distance >= 1) continue;
      positions.setY(index, y + (DEFECT_BASE_Y - y) * Math.pow(1 - distance, .65));
    }
    geometry.setAttribute('position', positions);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    child.geometry = geometry;
  });
}

function BladeModel({ sourceModel, sourceTexture, progress, finaleActive, complete, running, reducedMotion, reflection = false }: {
  sourceModel: Group;
  sourceTexture: Texture;
  progress: number;
  finaleActive: boolean;
  complete: boolean;
  running: boolean;
  reducedMotion: boolean;
  reflection?: boolean;
}) {
  const poseRef = useRef<Group>(null);
  const spinGroupRef = useRef<Group>(null);
  const controller = useMemo(() => createSpinBehaviorController(BLADE_SPIN_CONFIG), []);

  const model = useMemo(() => {
    const clone = sourceModel.clone(true);
    applyBladeDefect(clone);
    // Single-texture wrap via the shared core (reflection gets muted values).
    const material = createWrapTextureMaterial([sourceTexture], reflection ? {
      emissive: '#9d8e7a',
      emissiveIntensity: .04,
      roughness: .5,
      metalness: .06,
      transparent: true,
      opacity: .13,
    } : {});
    clone.traverse((child) => {
      if (child instanceof Mesh) child.material = material;
    });
    normalizeModel(clone, 3.25);
    return clone;
  }, [reflection, sourceModel, sourceTexture]);

  useFrame((_state, delta) => {
    if (!poseRef.current || !spinGroupRef.current) return;
    const pose = controller.update(delta, { progress, running, finaleActive, complete, reducedMotion });
    const speed = reducedMotion ? BLADE_SPIN_CONFIG.reducedSpinSpeed ?? 1.15 : BLADE_SPIN_CONFIG.spinSpeed;
    const wobblePhase = pose.elapsed * (2.4 + speed * .26);
    spinGroupRef.current.rotation.y = pose.spinAngle;
    poseRef.current.rotation.x = reflection ? 0 : -9 * Math.PI / 180 + pose.topple * 1.35 + Math.sin(wobblePhase) * pose.wobble * .22;
    poseRef.current.rotation.z = reflection ? 0 : pose.topple * .26 + Math.cos(wobblePhase * .87) * pose.wobble * .17;
    poseRef.current.position.y = reflection ? -.445 : pose.y;
    poseRef.current.position.x = pose.orbitX + pose.topple * .24;
    poseRef.current.position.z = pose.orbitZ;
  });

  return (
    <group ref={poseRef}>
      <group ref={spinGroupRef}>
        <group scale={reflection ? [.45, .02025, .45] : .45}>
          <primitive object={model} />
        </group>
      </group>
    </group>
  );
}

function LoadingBlade() {
  return <mesh><cylinderGeometry args={[.72, .96, .2, 48]} /><meshStandardMaterial color="#52604b" wireframe /></mesh>;
}

function CompletionAura({ finaleActive, complete, running }: { finaleActive: boolean; complete: boolean; running: boolean }) {
  const groupRef = useRef<Group>(null);
  const warmMaterialRef = useRef<SpriteMaterial>(null);
  const limeMaterialRef = useRef<SpriteMaterial>(null);
  const lightRef = useRef<PointLight>(null);
  const progressRef = useRef(0);
  const warmTexture = useMemo(() => createGlowTexture('255,220,162'), []);
  const limeTexture = useMemo(() => createGlowTexture('182,232,90'), []);
  useEffect(() => () => { warmTexture.dispose(); limeTexture.dispose(); }, [limeTexture, warmTexture]);
  useFrame((_state, delta) => {
    if (complete) progressRef.current = 1;
    else if (!finaleActive) progressRef.current = 0;
    else if (running) progressRef.current = Math.min(1, progressRef.current + delta / 5);
    const value = progressRef.current;
    const glow = smoothstep(.68, 1, value);
    if (groupRef.current) {
      groupRef.current.position.y = smoothstep(.28, .84, value) * 1.05;
      groupRef.current.scale.setScalar(.72 + glow * .42);
    }
    if (warmMaterialRef.current) warmMaterialRef.current.opacity = glow * .56;
    if (limeMaterialRef.current) limeMaterialRef.current.opacity = glow * .22;
    if (lightRef.current) lightRef.current.intensity = glow * 2.1;
  });
  return (
    <group ref={groupRef}>
      <sprite scale={[3.1, 3.1, 1]}><spriteMaterial ref={warmMaterialRef} map={warmTexture} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} /></sprite>
      <sprite scale={[2.1, 2.1, 1]}><spriteMaterial ref={limeMaterialRef} map={limeTexture} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} /></sprite>
      <pointLight ref={lightRef} intensity={0} distance={4} decay={2} color="#f5d39d" />
    </group>
  );
}

function createPedestalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) return new CanvasTexture(canvas);
  const gradient = context.createRadialGradient(220, 205, 20, 256, 256, 250);
  gradient.addColorStop(0, 'rgba(69,61,52,.98)');
  gradient.addColorStop(.36, 'rgba(43,38,33,.96)');
  gradient.addColorStop(.68, 'rgba(24,21,19,.78)');
  gradient.addColorStop(.86, 'rgba(13,12,11,.3)');
  gradient.addColorStop(1, 'rgba(8,8,7,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 512);
  context.strokeStyle = 'rgba(196,169,130,.16)';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(256, 256, 208, 0, Math.PI * 2);
  context.stroke();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function GalleryPedestal() {
  const pedestalTexture = useMemo(() => createPedestalTexture(), []);
  useEffect(() => () => pedestalTexture.dispose(), [pedestalTexture]);
  return (
    <group>
      <mesh position={[0, -.5, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.06, 1.06, 1]}>
        <planeGeometry args={[4.7, 4.7]} />
        <meshBasicMaterial map={pedestalTexture} transparent opacity={.3} depthWrite={false} />
      </mesh>
      <mesh position={[0, -.465, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.7, 4.7]} />
        <meshPhysicalMaterial map={pedestalTexture} transparent roughness={.17} metalness={.44} clearcoat={1} clearcoatRoughness={.16} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default function BladeVisual({ progress, running = false, duration = 0 }: FocusVisualProps & { duration?: number }) {
  const reducedMotion = useReducedMotion();
  const { model, error: modelError } = useModelLoader(BLADE_OBJ_URL);
  const { texture, error: textureError } = useTextureLoader(BLADE_TEXTURE_URL);

  const value = clamp01(progress);
  const finaleStart = duration > 0 ? Math.max(0, 1 - 5 / duration) : .98;
  const finaleActive = value >= finaleStart;
  const complete = value >= 1;

  const error = modelError ?? textureError;
  if (error) {
    return <ModelVisualFallback visualLabel="Spin Blade" reason={error} progress={value} running={running} duration={duration} />;
  }

  // While assets are in flight the wireframe placeholder below keeps the
  // gallery scene alive (same behavior as the previous Suspense fallback).
  const ready = !!model && !!texture;

  return (
    <div className="relative h-full w-full overflow-visible">
      <div className="blade-gallery-beam" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-[-30%] bg-[radial-gradient(ellipse_at_43%_8%,rgba(255,228,184,.17)_0%,rgba(214,180,128,.07)_26%,transparent_67%)] blur-[60px]" />
      <Canvas camera={{ position: [0, 2.6, 6.2], fov: 36 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', toneMappingExposure: 1.08 }} style={{ position: 'absolute', inset: 0 }}>
        <ambientLight intensity={.3} color="#d8d1c7" />
        <spotLight position={[1.1, 4.8, 3.5]} intensity={8.6} color="#ffe0ac" angle={.48} penumbra={1} distance={11} decay={1.65} />
        <pointLight position={[-1.8, -.1, -2.4]} intensity={1.25} distance={5.4} decay={2} color="#b6e85a" />
        <pointLight position={[2.6, 1.15, 1.6]} intensity={.85} distance={6} decay={2} color="#f4cea0" />
        <pointLight position={[-2.2, 1.5, 1]} intensity={.42} distance={5} decay={2} color="#d5d9d4" />
        <GalleryPedestal />
        {ready && model && texture ? (
          <>
            <BladeModel sourceModel={model} sourceTexture={texture} progress={value} finaleActive={finaleActive} complete={complete} running={running} reducedMotion={reducedMotion} reflection />
            <BladeModel sourceModel={model} sourceTexture={texture} progress={value} finaleActive={finaleActive} complete={complete} running={running} reducedMotion={reducedMotion} />
            <CompletionAura finaleActive={finaleActive} complete={complete} running={running} />
          </>
        ) : (
          <LoadingBlade />
        )}
      </Canvas>
      <div className="pointer-events-none absolute inset-[-2%] bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(9,11,10,.16)_70%,rgba(9,11,10,.66)_100%)]" />
    </div>
  );
}

preloadAssets(BLADE_OBJ_URL, BLADE_TEXTURE_URL);
