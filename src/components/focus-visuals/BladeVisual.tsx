import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Box3, Group, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const BLADE_MODEL_URL = 'https://res.cloudinary.com/dcydj6gao/image/upload/v1785679396/white_mesh_1_mf4syn.glb';
const DEFAULT_SPEED = 9;
const MIN_SPEED = .5;
const MAX_SPEED = 30;

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
    model.scale.setScalar(3.25 / largestDimension);
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
  const [rotationSpeed, setRotationSpeed] = useState(DEFAULT_SPEED);
  const [fps, setFps] = useState(0);

  return (
    <div className={`flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#283128_0%,#111510_52%,#090b09_100%)] ${compact ? '' : 'gap-3 p-3 sm:gap-4 sm:p-4'}`}>
      <div className={`relative flex-1 overflow-hidden rounded-2xl ${compact ? '' : 'border border-white/10'}`}>
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
      </div>

      {!compact && (
        <div className="rounded-2xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between text-xs font-bold">
            <label htmlFor="blade-speed" className="text-stone-300">Spin speed</label>
            <span className="font-mono text-lime-300">{rotationSpeed.toFixed(2)} rad/s</span>
          </div>
          <input
            id="blade-speed"
            type="range"
            min={MIN_SPEED}
            max={MAX_SPEED}
            step="0.5"
            value={rotationSpeed}
            onChange={(event) => setRotationSpeed(Number(event.target.value))}
            className="h-2 w-full cursor-pointer accent-lime-300"
            aria-label="Blade spin speed"
          />
          <div className="mt-1 flex justify-between text-[9px] font-semibold uppercase tracking-wider text-stone-500">
            <span>Slow</span>
            <span>Fast</span>
          </div>
        </div>
      )}
    </div>
  );
}

useLoader.preload(GLTFLoader, BLADE_MODEL_URL);
