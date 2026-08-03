import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { AdditiveBlending, Box3, BufferAttribute, CanvasTexture, DoubleSide, Group, Mesh, MeshPhysicalMaterial, SRGBColorSpace, TextureLoader, Vector3 } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

const BLADE_OBJ_URL = 'https://res.cloudinary.com/dcydj6gao/raw/upload/v1785732533/beyblade_poes3s.obj';
const BLADE_TEXTURE_URL = '/visuals/blade/texture-vibrant.jpg';
const ROTATION_SPEED = 10;
const DEFECT_CENTER = { x: -.008, z: .178 };
const DEFECT_RADIUS = { x: .092, z: .075 };
const DEFECT_BASE_Y = -.176;

function BladeModel() {
  const modelRef = useRef<Group>(null);
  const sourceModel = useLoader(OBJLoader, BLADE_OBJ_URL);
  const sourceTexture = useLoader(TextureLoader, BLADE_TEXTURE_URL);
  const model = useMemo(() => {
    const clone = sourceModel.clone(true);
    const texture = sourceTexture.clone();
    texture.colorSpace = SRGBColorSpace;
    texture.flipY = true;
    texture.needsUpdate = true;
    texture.anisotropy = 8;
    const material = new MeshPhysicalMaterial({
      map: texture,
      color: '#ffffff',
      emissive: '#ffffff',
      emissiveMap: texture,
      emissiveIntensity: .1,
      roughness: .3,
      metalness: .24,
      clearcoat: .72,
      clearcoatRoughness: .2,
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
        const blend = Math.pow(1 - distance, .65);
        positions.setY(index, y + (DEFECT_BASE_Y - y) * blend);
      }
      geometry.setAttribute('position', positions);
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      child.geometry = geometry;
      child.material = material;
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return clone;
  }, [sourceModel, sourceTexture]);
  const spinRef = useRef(0);

  useEffect(() => {
    const bounds = new Box3().setFromObject(model);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const largestDimension = Math.max(size.x, size.y, size.z) || 1;
    model.position.sub(center);
    model.scale.setScalar(3.25 / largestDimension);
  }, [model]);

  useFrame((_state, delta) => {
    if (!modelRef.current) return;
    spinRef.current += delta * ROTATION_SPEED;
    modelRef.current.rotation.y = spinRef.current;
  });

  return (
    <group ref={modelRef}>
      <primitive object={model} />

      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[1.48, .055, 12, 96]} />
        <meshPhysicalMaterial color="#d8dde2" metalness={.96} roughness={.18} clearcoat={1} clearcoatRoughness={.12} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[1.31, .024, 10, 96]} />
        <meshPhysicalMaterial color="#b98b42" emissive="#5c3210" emissiveIntensity={.3} metalness={.9} roughness={.22} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[.54, .038, 12, 64]} />
        <meshPhysicalMaterial color="#171b20" metalness={.92} roughness={.16} clearcoat={1} />
      </mesh>

      <mesh position={[0, .13, 0]} castShadow>
        <cylinderGeometry args={[.38, .45, .14, 64]} />
        <meshPhysicalMaterial color="#d6b36a" metalness={.92} roughness={.2} clearcoat={1} clearcoatRoughness={.1} />
      </mesh>
      <mesh position={[0, .22, 0]} castShadow>
        <cylinderGeometry args={[.23, .31, .09, 64]} />
        <meshPhysicalMaterial color="#10141a" metalness={.88} roughness={.14} clearcoat={1} />
      </mesh>
      <mesh position={[0, .275, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[.14, 48]} />
        <meshPhysicalMaterial color="#d8b56d" emissive="#8a511b" emissiveIntensity={.45} metalness={.9} roughness={.16} />
      </mesh>

      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * Math.PI * 2;
        return (
          <group key={index} position={[Math.cos(angle) * 1.18, .1, Math.sin(angle) * 1.18]} rotation={[0, -angle, 0]}>
            <mesh castShadow>
              <boxGeometry args={[.23, .11, .085]} />
              <meshPhysicalMaterial color={index % 2 ? '#c5cbd1' : '#b78a43'} metalness={.94} roughness={.17} clearcoat={.85} />
            </mesh>
            <mesh position={[0, .065, 0]}>
              <sphereGeometry args={[.035, 16, 12]} />
              <meshPhysicalMaterial color="#ecf3f7" emissive="#8eb9d7" emissiveIntensity={.25} metalness={.86} roughness={.12} />
            </mesh>
          </group>
        );
      })}

    </group>
  );
}

function FpsSampler({ onFps }: { onFps: (fps: number) => void }) {
  const elapsedRef = useRef(0);
  const framesRef = useRef(0);

  useFrame((_state, delta) => {
    elapsedRef.current += delta;
    framesRef.current += 1;
    if (elapsedRef.current < .5) return;
    onFps(Math.round(framesRef.current / elapsedRef.current));
    elapsedRef.current = 0;
    framesRef.current = 0;
  });

  return null;
}

function LoadingBlade() {
  const meshRef = useRef<Mesh>(null);
  useFrame((_state, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta;
  });
  return (
    <mesh ref={meshRef}>
      <cylinderGeometry args={[.75, 1, .28, 48]} />
      <meshStandardMaterial color="#52604b" wireframe />
    </mesh>
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
    gradient.addColorStop(0, 'rgba(0,0,0,.9)');
    gradient.addColorStop(.42, 'rgba(0,0,0,.55)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
  } else {
    gradient.addColorStop(0, '#05070a');
    gradient.addColorStop(.5, '#0b1016');
    gradient.addColorStop(.82, '#141c1d');
    gradient.addColorStop(.96, '#62852d');
    gradient.addColorStop(1, '#c5ff54');
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function BattleArena() {
  const energyRef = useRef<Group>(null);
  const floorTexture = useMemo(() => createArenaTexture(512), []);
  const shadowTexture = useMemo(() => createArenaTexture(256, true), []);

  useEffect(() => () => {
    floorTexture.dispose();
    shadowTexture.dispose();
  }, [floorTexture, shadowTexture]);

  useFrame((_state, delta) => {
    if (energyRef.current) energyRef.current.rotation.z -= delta * .3;
  });

  return (
    <group position={[0, -.61, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <cylinderGeometry args={[2.25, 2.45, .22, 96, 1, false]} />
        <meshPhysicalMaterial color="#090d13" metalness={.88} roughness={.24} clearcoat={.85} clearcoatRoughness={.14} />
      </mesh>
      <mesh position={[0, .115, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.22, 128]} />
        <meshBasicMaterial map={floorTexture} />
      </mesh>
      <mesh position={[0, .13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[.88, 64]} />
        <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} opacity={.82} />
      </mesh>

      <mesh position={[0, .15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.2, .045, 12, 64]} />
        <meshBasicMaterial color="#c5ff54" transparent opacity={.9} />
      </mesh>
      <mesh position={[0, .145, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.83, .018, 8, 64]} />
        <meshBasicMaterial color="#d3aa58" transparent opacity={.9} />
      </mesh>
      <mesh position={[0, .14, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.48, 1.5, 96]} />
        <meshBasicMaterial color="#71873f" transparent opacity={.65} side={DoubleSide} />
      </mesh>

      <group ref={energyRef} position={[0, .16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {Array.from({ length: 12 }, (_, index) => {
          const angle = index * Math.PI / 6;
          return (
            <mesh key={index} position={[Math.cos(angle) * 1.72, Math.sin(angle) * 1.72, 0]} rotation={[0, 0, angle]}>
              <planeGeometry args={[.32, .025]} />
              <meshBasicMaterial color={index % 2 ? '#c5ff54' : '#ddb563'} transparent opacity={.82} blending={AdditiveBlending} depthWrite={false} />
            </mesh>
          );
        })}
      </group>

      {Array.from({ length: 8 }, (_, index) => {
        const angle = index * Math.PI / 4;
        return (
          <group key={index} position={[Math.cos(angle) * 2.38, .02, Math.sin(angle) * 2.38]} rotation={[0, -angle, 0]}>
            <mesh>
              <boxGeometry args={[.18, .28, .48]} />
              <meshPhysicalMaterial color="#121922" metalness={.88} roughness={.2} clearcoat={.75} />
            </mesh>
            <mesh position={[0, .11, -.25]}>
              <boxGeometry args={[.07, .08, .015]} />
              <meshBasicMaterial color="#c5ff54" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export default function BladeVisual({ compact = false }: { compact?: boolean }) {
  const [fps, setFps] = useState(0);

  return (
    <div className={`relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_50%_34%,#2c3748_0%,#10151c_40%,#050607_100%)] ${compact ? '' : 'rounded-2xl border border-white/10'}`}>
      <Canvas shadows="basic" camera={{ position: [0, 2.2, 4.2], fov: 38 }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance', toneMappingExposure: 1.08 }}>
        <ambientLight intensity={.42} />
        <spotLight position={[3.5, 5, 3]} angle={.48} penumbra={.75} intensity={3.6} color="#fff0d2" castShadow shadow-mapSize-width={512} shadow-mapSize-height={512} />
        <spotLight position={[-4, 2, -3]} angle={.6} penumbra={.8} intensity={2.4} color="#6599d3" />
        <pointLight position={[2, .7, -2.5]} intensity={1.8} distance={7} color="#e9b85d" />
        <Suspense fallback={<LoadingBlade />}>
          <BladeModel />
        </Suspense>
        <BattleArena />
        <FpsSampler onFps={setFps} />
      </Canvas>

      <div className={`pointer-events-none absolute left-3 top-3 rounded-full border border-white/10 bg-black/45 font-mono font-bold text-lime-200 backdrop-blur-md ${compact ? 'px-2 py-1 text-[9px]' : 'px-3 py-1.5 text-xs'}`}>
        {fps || '--'} FPS
      </div>
    </div>
  );
}

useLoader.preload(OBJLoader, BLADE_OBJ_URL);
useLoader.preload(TextureLoader, BLADE_TEXTURE_URL);
