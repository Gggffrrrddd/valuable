import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Box3, Group, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const BLADE_MODEL_URL = 'https://res.cloudinary.com/dcydj6gao/image/upload/v1785679396/white_mesh_1_mf4syn.glb';
const SLOW_SPEED = 1.25;
const FAST_SPEED = 7;

function BladeModel({ rotationSpeed }: { rotationSpeed: number }) {
  const modelRef = useRef<Group>(null);
  const gltf = useLoader(GLTFLoader, BLADE_MODEL_URL);
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useEffect(() => {
    const bounds = new Box3().setFromObject(model);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const largestDimension = Math.max(size.x, size.y, size.z) || 1;
    model.position.sub(center);
    model.scale.setScalar(2.7 / largestDimension);
  }, [model]);

  useFrame((_state, delta) => {
    if (modelRef.current) modelRef.current.rotation.y += delta * rotationSpeed;
  });

  return <primitive ref={modelRef} object={model} />;
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

export default function BladeVisual({ compact = false }: { compact?: boolean }) {
  const [rotationSpeed, setRotationSpeed] = useState(SLOW_SPEED);
  const [fps, setFps] = useState(0);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#283128_0%,#111510_52%,#090b09_100%)]">
      <Canvas camera={{ position: [0, 2.2, 4.2], fov: 38 }} dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <ambientLight intensity={1.6} />
        <directionalLight position={[3, 5, 4]} intensity={3.2} color="#efffd6" />
        <directionalLight position={[-4, 1, -2]} intensity={1.5} color="#8bbca6" />
        <Suspense fallback={<LoadingBlade />}>
          <BladeModel rotationSpeed={rotationSpeed} />
        </Suspense>
        <FpsSampler onFps={setFps} />
      </Canvas>

      <div className={`pointer-events-none absolute left-3 top-3 rounded-full border border-white/10 bg-black/45 font-mono font-bold text-lime-200 backdrop-blur-md ${compact ? 'px-2 py-1 text-[9px]' : 'px-3 py-1.5 text-xs'}`}>
        {fps || '--'} FPS
      </div>

      {!compact && (
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2 rounded-2xl border border-white/10 bg-black/50 p-1.5 backdrop-blur-xl">
          <button type="button" onClick={() => setRotationSpeed(FAST_SPEED)} className={`rounded-xl px-4 py-2 text-xs font-bold transition ${rotationSpeed === FAST_SPEED ? 'bg-lime-300 text-[#10130e]' : 'text-stone-300 hover:bg-white/10'}`}>Fast Spin</button>
          <button type="button" onClick={() => setRotationSpeed(SLOW_SPEED)} className={`rounded-xl px-4 py-2 text-xs font-bold transition ${rotationSpeed === SLOW_SPEED ? 'bg-lime-300 text-[#10130e]' : 'text-stone-300 hover:bg-white/10'}`}>Slow Spin</button>
        </div>
      )}
    </div>
  );
}

useLoader.preload(GLTFLoader, BLADE_MODEL_URL);
