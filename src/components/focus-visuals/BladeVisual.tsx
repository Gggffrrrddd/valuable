import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { AdditiveBlending, Box3, BufferAttribute, CanvasTexture, Group, Mesh, MeshPhysicalMaterial, PointLight, SpriteMaterial, SRGBColorSpace, TextureLoader, Vector3 } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { FocusVisualProps } from './types';

const BLADE_OBJ_URL = 'https://res.cloudinary.com/dcydj6gao/raw/upload/v1785732533/beyblade_poes3s.obj';
const BLADE_TEXTURE_URL = '/visuals/blade/texture-vibrant.jpg';
const DEFECT_CENTER = { x: -.008, z: .178 };
const DEFECT_RADIUS = { x: .092, z: .075 };
const DEFECT_BASE_Y = -.176;

function smoothstep(min: number, max: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function BladeModel({ progress, finaleActive, complete, running, reducedMotion, reflection = false }: { progress: number; finaleActive: boolean; complete: boolean; running: boolean; reducedMotion: boolean; reflection?: boolean }) {
  const poseRef = useRef<Group>(null);
  const spinGroupRef = useRef<Group>(null);
  const spinAngleRef = useRef(0);
  const orbitAngleRef = useRef(0);
  const finaleClockRef = useRef(0);
  const elapsedRef = useRef(0);
  const scaleStateRef = useRef({ baseScale: 0 });
  const sourceModel = useLoader(OBJLoader, BLADE_OBJ_URL);
  const sourceTexture = useLoader(TextureLoader, BLADE_TEXTURE_URL);
  const model = useMemo(() => {
    const clone = sourceModel.clone(true);
    const texture = sourceTexture.clone();
    texture.colorSpace = SRGBColorSpace;
    texture.flipY = true;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    const material = new MeshPhysicalMaterial({
      map: texture,
      emissive: reflection ? '#9d8e7a' : '#ffffff',
      emissiveMap: texture,
      emissiveIntensity: reflection ? .04 : .065,
      roughness: reflection ? .5 : .21,
      metalness: reflection ? .06 : .31,
      clearcoat: .78,
      clearcoatRoughness: .17,
      sheen: .22,
      sheenColor: '#d8c0a0',
      transparent: reflection,
      opacity: reflection ? .13 : 1,
      depthWrite: !reflection,
    });

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
        child.material = material;
      });
      const rawBounds = new Box3().setFromObject(clone);
      const rawSize = rawBounds.getSize(new Vector3());
      const baseLargestDimension = Math.max(rawSize.x, rawSize.y, rawSize.z) || 1;
      scaleStateRef.current = { baseScale: 3.25 / baseLargestDimension };
      return clone;
    }, [reflection, sourceModel, sourceTexture]);

  useEffect(() => {
    const bounds = new Box3().setFromObject(model);
    const center = bounds.getCenter(new Vector3());
    const { baseScale } = scaleStateRef.current;
    model.position.sub(center);
    model.scale.setScalar(baseScale);
  }, [model]);

  useFrame((_state, delta) => {
    if (!poseRef.current || !spinGroupRef.current) return;
    elapsedRef.current += delta;
    if (complete) finaleClockRef.current = 1;
    else if (!finaleActive) finaleClockRef.current = 0;
    else if (running && !reducedMotion) finaleClockRef.current = Math.min(1, finaleClockRef.current + delta / 5);
    const finaleMix = reducedMotion ? 0 : finaleClockRef.current;
    const topple = reducedMotion ? 0 : smoothstep(.94, 1, progress) * (1 - finaleMix);
    const wobble = reducedMotion ? 0 : smoothstep(.62, .96, progress) * (1 - topple) * (1 - finaleMix);
    const speed = reducedMotion ? 1.15 : .08 + 29.92 * Math.pow(1 - progress, 2.35);
    const finaleSpin = 18 * (1 - smoothstep(.34, .82, finaleMix));
    const spinBrake = 1 - smoothstep(.58, .88, finaleMix);
    const effectiveSpeed = finaleMix > 0 ? Math.max(speed, finaleSpin) * spinBrake : speed;
    if (running || reducedMotion) spinAngleRef.current += delta * effectiveSpeed;
    if (running && finaleMix > 0 && finaleMix < .92) orbitAngleRef.current += delta * 16;
    const wobblePhase = elapsedRef.current * (2.4 + speed * .26);
    const orbitRamp = smoothstep(0, .16, finaleMix);
    const orbitCollapse = smoothstep(.62, .9, finaleMix);
    const orbitRadius = .78 * orbitRamp * (1 - orbitCollapse);
    const rise = smoothstep(.28, .84, finaleMix);
    const orbitX = Math.cos(orbitAngleRef.current) * orbitRadius;
    const orbitZ = Math.sin(orbitAngleRef.current) * orbitRadius;
    spinGroupRef.current.rotation.y = spinAngleRef.current;
    poseRef.current.rotation.x = reflection ? 0 : -9 * Math.PI / 180 + topple * 1.35 + Math.sin(wobblePhase) * wobble * .22;
    poseRef.current.rotation.z = reflection ? 0 : topple * .26 + Math.cos(wobblePhase * .87) * wobble * .17;
    poseRef.current.position.y = reflection ? -.445 : rise * 1.05 - topple * .34;
    poseRef.current.position.x = orbitX + topple * .24;
    poseRef.current.position.z = orbitZ;
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

function createGlowTexture(rgb: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return new CanvasTexture(canvas);
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, `rgba(${rgb},1)`);
  gradient.addColorStop(.18, `rgba(${rgb},.62)`);
  gradient.addColorStop(.52, `rgba(${rgb},.16)`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new CanvasTexture(canvas);
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
  const value = Math.max(0, Math.min(1, progress));
  const finaleStart = duration > 0 ? Math.max(0, 1 - 5 / duration) : .98;
  const finaleActive = value >= finaleStart;
  const complete = value >= 1;
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
        <Suspense fallback={<LoadingBlade />}>
          <BladeModel progress={value} finaleActive={finaleActive} complete={complete} running={running} reducedMotion={reducedMotion} reflection />
          <BladeModel progress={value} finaleActive={finaleActive} complete={complete} running={running} reducedMotion={reducedMotion} />
          <CompletionAura finaleActive={finaleActive} complete={complete} running={running} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-[-2%] bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(9,11,10,.16)_70%,rgba(9,11,10,.66)_100%)]" />
    </div>
  );
}

useLoader.preload(OBJLoader, BLADE_OBJ_URL);
useLoader.preload(TextureLoader, BLADE_TEXTURE_URL);
