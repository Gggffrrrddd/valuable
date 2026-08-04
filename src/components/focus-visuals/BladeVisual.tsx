import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { AdditiveBlending, Box3, BufferAttribute, CanvasTexture, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, SRGBColorSpace, TextureLoader, Vector3 } from 'three';
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

function BladeModel({ progress, running, reducedMotion, scaleMultiplier = 1, onCalibration }: { progress: number; running: boolean; reducedMotion: boolean; scaleMultiplier?: number; onCalibration?: (snapshot: { scaleMultiplier: number; baseScale: number; effectiveScale: number; baseLargestDimension: number; effectiveLargestDimension: number }) => void }) {
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
      emissiveIntensity: .09,
      roughness: .28,
      metalness: .26,
      clearcoat: .78,
      clearcoatRoughness: .17,
      sheen: .22,
      sheenColor: '#8eb9d7',
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
    model.scale.setScalar(baseScale * scaleMultiplier);
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
    modelRef.current.rotation.x = topple * 1.35 + Math.sin(wobblePhase) * wobble * .22;
    modelRef.current.rotation.z = topple * .26 + Math.cos(wobblePhase * .87) * wobble * .17;
    modelRef.current.position.y = -topple * .34;
    modelRef.current.position.x = topple * .24;
  });

  return (
    <group ref={modelRef}>
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
  );
}

function createArenaTexture(size: number, shadow = false) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return new CanvasTexture(canvas);
  const center = size / 2;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);
  if (shadow) {
    gradient.addColorStop(0, 'rgba(0,0,0,.82)');
    gradient.addColorStop(.42, 'rgba(0,0,0,.46)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
  } else {
    gradient.addColorStop(0, '#151b20');
    gradient.addColorStop(.34, '#0c1115');
    gradient.addColorStop(.72, '#070a0d');
    gradient.addColorStop(.91, '#151d18');
    gradient.addColorStop(1, '#4f6828');
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function PremiumArena({ progress, reducedMotion }: { progress: number; reducedMotion: boolean }) {
  const energyRef = useRef<Group>(null);
  const glowMaterialRef = useRef<MeshBasicMaterial>(null);
  const floorTexture = useMemo(() => createArenaTexture(512), []);
  const shadowTexture = useMemo(() => createArenaTexture(256, true), []);
  useEffect(() => () => { floorTexture.dispose(); shadowTexture.dispose(); }, [floorTexture, shadowTexture]);

  useFrame((_state, delta) => {
    if (energyRef.current && !reducedMotion) energyRef.current.rotation.z -= delta * (.12 + (1 - progress) * .28);
    if (glowMaterialRef.current) {
      glowMaterialRef.current.opacity = .28 + smoothstep(.93, 1, progress) * .58;
      glowMaterialRef.current.color.lerpColors(new Color('#b6e85a'), new Color('#fff1b8'), smoothstep(.94, 1, progress));
    }
  });

  return (
    <group position={[0, -.59, 0]}>
      <mesh position={[0, -.09, 0]}><cylinderGeometry args={[2.02, 2.12, .16, 96]} /><meshPhysicalMaterial color="#080b0e" metalness={.88} roughness={.2} clearcoat={.75} /></mesh>
      <mesh position={[0, -.005, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[2.01, 96]} /><meshBasicMaterial color="#0a0f13" /></mesh>
      <mesh position={[0, .01, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.95, 96]} /><meshBasicMaterial map={floorTexture} /></mesh>
      <mesh position={[0, .025, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.72, 64]} /><meshBasicMaterial map={shadowTexture} transparent depthWrite={false} /></mesh>
      <mesh position={[0, .03, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[2.03, .055, 12, 128]} /><meshPhysicalMaterial color="#263039" metalness={.98} roughness={.16} clearcoat={1} /></mesh>
      <mesh position={[0, .045, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.88, .028, 10, 96]} /><meshBasicMaterial ref={glowMaterialRef} color="#b6e85a" transparent opacity={.32} blending={AdditiveBlending} depthWrite={false} /></mesh>
      <mesh position={[0, .04, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.72, .012, 8, 128]} /><meshBasicMaterial color="#d7ad61" transparent opacity={.42} /></mesh>
      <mesh position={[0, .03, 0]} rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[1.43, 1.45, 96]} /><meshBasicMaterial color="#c69b52" transparent opacity={.48} side={DoubleSide} /></mesh>
      <mesh position={[0, .028, 0]} rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[1.05, 1.06, 96]} /><meshBasicMaterial color="#8ba857" transparent opacity={.28} side={DoubleSide} /></mesh>
      <mesh position={[0, .036, 0]} rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[.76, .77, 96]} /><meshBasicMaterial color="#e2b96e" transparent opacity={.25} side={DoubleSide} /></mesh>
      <group ref={energyRef} position={[0, .04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {Array.from({ length: 16 }, (_, index) => {
          const angle = index * Math.PI / 8;
          return <mesh key={index} position={[Math.cos(angle) * 1.65, Math.sin(angle) * 1.65, 0]} rotation={[0, 0, angle]}><planeGeometry args={[.16, .01]} /><meshBasicMaterial color={index % 2 ? '#b6e85a' : '#d6ad61'} transparent opacity={.58} blending={AdditiveBlending} depthWrite={false} /></mesh>;
        })}
      </group>
    </group>
  );
}

function LoadingBlade() {
  return <mesh><cylinderGeometry args={[.72, .96, .2, 48]} /><meshStandardMaterial color="#52604b" wireframe /></mesh>;
}

export default function BladeVisual({ progress, running = false, scaleMultiplier = 1, onCalibration }: FocusVisualProps & { scaleMultiplier?: number; onCalibration?: (snapshot: { scaleMultiplier: number; baseScale: number; effectiveScale: number; baseLargestDimension: number; effectiveLargestDimension: number }) => void }) {
  const reducedMotion = useReducedMotion();
  const value = Math.max(0, Math.min(1, progress));
  return (
    <div className="relative aspect-[5/4] w-full overflow-visible">
      <div className="pointer-events-none absolute inset-[-18%] bg-[radial-gradient(ellipse_at_50%_57%,rgba(182,232,90,.11),rgba(9,11,10,0)_58%)] blur-2xl" />
      <Canvas camera={{ position: [0, 2.6, 6.2], fov: 36 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', toneMappingExposure: 1.08 }} style={{ position: 'absolute', inset: 0 }}>
        <ambientLight intensity={.55} />
        <directionalLight position={[3.8, 5, 3.5]} intensity={3.1} color="#fff1d6" />
        <directionalLight position={[-4, 1.4, -2.8]} intensity={1.65} color="#79a8da" />
        <pointLight position={[2, .9, -2]} intensity={1.5} distance={7} color="#d7ad61" />
        <PremiumArena progress={value} reducedMotion={reducedMotion} />
        <Suspense fallback={<LoadingBlade />}>
          <BladeModel progress={value} running={running} reducedMotion={reducedMotion} scaleMultiplier={scaleMultiplier} onCalibration={onCalibration} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-[-2%] bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(9,11,10,.16)_70%,rgba(9,11,10,.66)_100%)]" />
    </div>
  );
}

useLoader.preload(OBJLoader, BLADE_OBJ_URL);
useLoader.preload(TextureLoader, BLADE_TEXTURE_URL);
