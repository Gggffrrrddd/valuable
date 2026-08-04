import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Box3, BufferAttribute, CanvasTexture, DoubleSide, Group, Mesh, MeshPhysicalMaterial, SRGBColorSpace, TextureLoader, Vector3 } from 'three';
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

function BladeModel({ progress, running, reducedMotion, scaleMultiplier = 1, calibrationX = 0, calibrationY = 0, calibrationZ = 0, calibrationTilt = 0, onCalibration }: { progress: number; running: boolean; reducedMotion: boolean; scaleMultiplier?: number; calibrationX?: number; calibrationY?: number; calibrationZ?: number; calibrationTilt?: number; onCalibration?: (snapshot: { scaleMultiplier: number; baseScale: number; effectiveScale: number; baseLargestDimension: number; effectiveLargestDimension: number }) => void }) {
  const modelRef = useRef<Group>(null);
  const spinRef = useRef(0);
  const elapsedRef = useRef(0);
  const scaleStateRef = useRef({ baseScale: 0, baseLargestDimension: 0 });
  const onCalibrationRef = useRef(onCalibration);
  onCalibrationRef.current = onCalibration;
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
      emissive: '#ffffff',
      emissiveMap: texture,
      emissiveIntensity: .05,
      roughness: .24,
      metalness: .26,
      clearcoat: .78,
      clearcoatRoughness: .17,
      sheen: .22,
      sheenColor: '#d8c0a0',
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
      scaleStateRef.current = { baseScale: 3.25 / baseLargestDimension, baseLargestDimension };
      return clone;
    }, [sourceModel, sourceTexture]);

  useEffect(() => {
    const bounds = new Box3().setFromObject(model);
    const center = bounds.getCenter(new Vector3());
    const { baseScale, baseLargestDimension } = scaleStateRef.current;
    model.position.sub(center);
    model.scale.setScalar(baseScale);
    onCalibrationRef.current?.({ scaleMultiplier, baseScale, effectiveScale: baseScale * scaleMultiplier, baseLargestDimension, effectiveLargestDimension: baseLargestDimension * scaleMultiplier });
  }, [model, scaleMultiplier]);

  useFrame((_state, delta) => {
    if (!modelRef.current) return;
    elapsedRef.current += delta;
    const topple = reducedMotion ? 0 : smoothstep(.94, 1, progress);
    const wobble = reducedMotion ? 0 : smoothstep(.62, .96, progress) * (1 - topple);
    const speed = reducedMotion ? 1.15 : .08 + 12 * Math.pow(1 - progress, 2.35);
    if (running || reducedMotion) spinRef.current += delta * speed;
    const wobblePhase = elapsedRef.current * (2.4 + speed * .26);
    modelRef.current.rotation.y = spinRef.current;
    modelRef.current.rotation.x = calibrationTilt * Math.PI / 180 + topple * 1.35 + Math.sin(wobblePhase) * wobble * .22;
    modelRef.current.rotation.z = topple * .26 + Math.cos(wobblePhase * .87) * wobble * .17;
    modelRef.current.position.y = calibrationY - topple * .34;
    modelRef.current.position.x = calibrationX + topple * .24;
    modelRef.current.position.z = calibrationZ;
  });

  return (
    <group ref={modelRef}>
      <group scale={scaleMultiplier}>
        <primitive object={model} />
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.48, .055, 12, 96]} /><meshPhysicalMaterial color="#d8dde2" metalness={.96} roughness={.16} clearcoat={1} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.31, .024, 10, 96]} /><meshPhysicalMaterial color="#c79b50" emissive="#6b3b12" emissiveIntensity={.28} metalness={.92} roughness={.2} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.54, .038, 12, 64]} /><meshPhysicalMaterial color="#12171d" metalness={.94} roughness={.14} clearcoat={1} /></mesh>
        <mesh position={[0, .13, 0]}><cylinderGeometry args={[.38, .45, .14, 64]} /><meshPhysicalMaterial color="#d6b36a" metalness={.92} roughness={.18} clearcoat={1} /></mesh>
        <mesh position={[0, .22, 0]}><cylinderGeometry args={[.23, .31, .09, 64]} /><meshPhysicalMaterial color="#10141a" metalness={.9} roughness={.12} clearcoat={1} /></mesh>
        <mesh position={[0, .275, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.14, 48]} /><meshPhysicalMaterial color="#e1bd72" emissive="#8a511b" emissiveIntensity={.42} metalness={.9} roughness={.14} /></mesh>
        {Array.from({ length: 8 }, (_, index) => {
          const angle = index * Math.PI / 4;
          return <mesh key={index} position={[Math.cos(angle) * 1.18, .1, Math.sin(angle) * 1.18]} rotation={[0, -angle, 0]}><boxGeometry args={[.23, .11, .085]} /><meshPhysicalMaterial color={index % 2 ? '#cbd1d6' : '#bd914a'} metalness={.95} roughness={.16} clearcoat={.9} /></mesh>;
        })}
      </group>
    </group>
  );
}

function LoadingBlade() {
  return <mesh><cylinderGeometry args={[.72, .96, .2, 48]} /><meshStandardMaterial color="#52604b" wireframe /></mesh>;
}

function createReflectionTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) return new CanvasTexture(canvas);
  const gradient = context.createRadialGradient(256, 256, 18, 256, 256, 220);
  gradient.addColorStop(0, 'rgba(220,190,145,.34)');
  gradient.addColorStop(.22, 'rgba(178,188,185,.18)');
  gradient.addColorStop(.5, 'rgba(76,82,78,.08)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.save();
  context.translate(256, 256);
  context.scale(1, .32);
  context.translate(-256, -256);
  context.fillRect(0, 0, 512, 512);
  context.restore();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function GalleryPedestal() {
  const reflectionTexture = useMemo(() => createReflectionTexture(), []);
  useEffect(() => () => reflectionTexture.dispose(), [reflectionTexture]);
  return (
    <group>
      <mesh position={[0, -.65, 0]}><cylinderGeometry args={[1.94, 1.98, .12, 128]} /><meshPhysicalMaterial color="#15120f" roughness={.19} metalness={.48} clearcoat={.86} clearcoatRoughness={.2} /></mesh>
      <mesh position={[0, -.584, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.91, 128]} /><meshPhysicalMaterial color="#201b17" roughness={.12} metalness={.62} clearcoat={1} clearcoatRoughness={.13} /></mesh>
      <mesh position={[0, -.575, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.69, .008, 8, 160]} /><meshPhysicalMaterial color="#4a4035" roughness={.28} metalness={.72} /></mesh>
      <mesh position={[0, -.568, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.25, 96]} /><meshBasicMaterial map={reflectionTexture} transparent opacity={.34} depthWrite={false} /></mesh>
    </group>
  );
}

function GalleryBeam() {
  return (
    <mesh position={[.35, 1.48, .15]} rotation={[0, 0, -.08]}>
      <cylinderGeometry args={[.18, 1.42, 4.1, 64, 1, true]} />
      <meshBasicMaterial color="#f2d9ae" transparent opacity={.026} depthWrite={false} side={DoubleSide} />
    </mesh>
  );
}

export default function BladeVisual({ progress, running = false, bladeCalibration = { scale: 1, x: 0, y: 0, z: 0, tilt: 0 } }: FocusVisualProps) {
  const reducedMotion = useReducedMotion();
  const value = Math.max(0, Math.min(1, progress));
  return (
    <div className="relative aspect-[5/4] w-full overflow-visible">
      <div className="pointer-events-none absolute inset-[-18%] bg-[radial-gradient(ellipse_at_50%_57%,rgba(182,232,90,.11),rgba(9,11,10,0)_58%)] blur-2xl" />
      <Canvas camera={{ position: [0, 2.6, 6.2], fov: 36 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', toneMappingExposure: 1.08 }} style={{ position: 'absolute', inset: 0 }}>
        <ambientLight intensity={.34} color="#d7d1c7" />
        <spotLight position={[2.4, 4.8, 3.1]} intensity={5.2} color="#ffe4b7" angle={.42} penumbra={.9} distance={10} decay={1.7} />
        <pointLight position={[-2.4, -.15, -2.5]} intensity={.42} distance={5.5} decay={2} color="#b6e85a" />
        <GalleryBeam />
        <GalleryPedestal />
        <Suspense fallback={<LoadingBlade />}>
          <BladeModel progress={value} running={running} reducedMotion={reducedMotion} scaleMultiplier={bladeCalibration.scale} calibrationX={bladeCalibration.x} calibrationY={bladeCalibration.y} calibrationZ={bladeCalibration.z} calibrationTilt={bladeCalibration.tilt} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-[-2%] bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(9,11,10,.16)_70%,rgba(9,11,10,.66)_100%)]" />
    </div>
  );
}

useLoader.preload(OBJLoader, BLADE_OBJ_URL);
useLoader.preload(TextureLoader, BLADE_TEXTURE_URL);
