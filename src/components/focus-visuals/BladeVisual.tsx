import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Box3, Group, Mesh, MeshStandardMaterial, SRGBColorSpace, TextureLoader, Vector3 } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

const BLADE_OBJ_URL = 'https://res.cloudinary.com/dcydj6gao/raw/upload/v1785732533/beyblade_poes3s.obj';
const BLADE_TEXTURE_URL = 'https://res.cloudinary.com/dcydj6gao/image/upload/v1785732544/texture_ptl9gy.jpg';
const DEFAULT_SPEED = 9;
const MIN_SPEED = .5;
const MAX_SPEED = 30;
const TILT_STEP = 5;
const TILT_MIN = -90;
const TILT_MAX = 90;

function BladeModel({ rotationSpeed, tiltX, tiltY }: { rotationSpeed: number; tiltX: number; tiltY: number }) {
  const modelRef = useRef<Group>(null);
  const sourceModel = useLoader(OBJLoader, BLADE_OBJ_URL);
  const sourceTexture = useLoader(TextureLoader, BLADE_TEXTURE_URL);
  const model = useMemo(() => {
    const clone = sourceModel.clone(true);
    const texture = sourceTexture.clone();
    texture.colorSpace = SRGBColorSpace;
    texture.flipY = true;
    texture.needsUpdate = true;
    const material = new MeshStandardMaterial({
      map: texture,
      color: '#ffffff',
      emissive: '#ffffff',
      emissiveMap: texture,
      emissiveIntensity: .16,
      roughness: .38,
      metalness: .18,
    });
    clone.traverse((child) => {
      if (!(child instanceof Mesh)) return;
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

  useEffect(() => {
    spinRef.current = 0;
  }, [tiltX, tiltY]);

  useFrame((_state, delta) => {
    if (!modelRef.current) return;
    spinRef.current += delta * rotationSpeed;
    modelRef.current.rotation.x = (tiltX * Math.PI) / 180;
    modelRef.current.rotation.y = spinRef.current + (tiltY * Math.PI) / 180;
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
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const [fps, setFps] = useState(0);

  const adjustTilt = (axis: 'x' | 'y', direction: 1 | -1) => {
    const update = axis === 'x' ? setTiltX : setTiltY;
    update((value) => Math.max(TILT_MIN, Math.min(TILT_MAX, value + direction * TILT_STEP)));
  };

  return (
    <div className={`flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#283128_0%,#111510_52%,#090b09_100%)] ${compact ? '' : 'gap-3 p-3 sm:gap-4 sm:p-4'}`}>
      <div className={`relative flex-1 overflow-hidden rounded-2xl ${compact ? '' : 'border border-white/10'}`}>
        <Canvas camera={{ position: [0, 2.2, 4.2], fov: 38 }} dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: 'high-performance', toneMappingExposure: 1.12 }}>
          <ambientLight intensity={.72} />
          <directionalLight position={[3, 5, 4]} intensity={2.1} color="#fff4dd" />
          <directionalLight position={[-4, 1, -2]} intensity={1.15} color="#6f9fd2" />
          <pointLight position={[0, 1.5, 2]} intensity={1.1} distance={7} color="#ffb36b" />
          <Suspense fallback={<LoadingBlade />}>
            <BladeModel rotationSpeed={rotationSpeed} tiltX={tiltX} tiltY={tiltY} />
          </Suspense>
          <FpsSampler onFps={setFps} />
        </Canvas>

        <div className={`pointer-events-none absolute left-3 top-3 rounded-full border border-white/10 bg-black/45 font-mono font-bold text-lime-200 backdrop-blur-md ${compact ? 'px-2 py-1 text-[9px]' : 'px-3 py-1.5 text-xs'}`}>
          {fps || '--'} FPS
        </div>
      </div>

      {!compact && (
        <div className="space-y-3">
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

          <div className="rounded-2xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between text-xs font-bold">
              <span className="text-stone-300">Tilt controls</span>
              <button
                type="button"
                onClick={() => { setTiltX(0); setTiltY(0); }}
                className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-300 transition hover:bg-white/10 hover:text-white"
              >
                Reset
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center gap-2 rounded-xl bg-black/30 px-3 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Top / Down</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => adjustTilt('x', -1)} className="h-9 w-9 rounded-lg border border-white/10 bg-white/[.06] font-bold text-stone-100 transition hover:border-lime-300/40 hover:bg-lime-300/10 hover:text-lime-300" aria-label="Tilt down">−</button>
                  <span className="min-w-[3.4rem] text-center font-mono text-sm font-bold text-lime-300">{tiltX}°</span>
                  <button type="button" onClick={() => adjustTilt('x', 1)} className="h-9 w-9 rounded-lg border border-white/10 bg-white/[.06] font-bold text-stone-100 transition hover:border-lime-300/40 hover:bg-lime-300/10 hover:text-lime-300" aria-label="Tilt up">+</button>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 rounded-xl bg-black/30 px-3 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Left / Right</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => adjustTilt('y', -1)} className="h-9 w-9 rounded-lg border border-white/10 bg-white/[.06] font-bold text-stone-100 transition hover:border-lime-300/40 hover:bg-lime-300/10 hover:text-lime-300" aria-label="Rotate left">−</button>
                  <span className="min-w-[3.4rem] text-center font-mono text-sm font-bold text-lime-300">{tiltY}°</span>
                  <button type="button" onClick={() => adjustTilt('y', 1)} className="h-9 w-9 rounded-lg border border-white/10 bg-white/[.06] font-bold text-stone-100 transition hover:border-lime-300/40 hover:bg-lime-300/10 hover:text-lime-300" aria-label="Rotate right">+</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

useLoader.preload(OBJLoader, BLADE_OBJ_URL);
useLoader.preload(TextureLoader, BLADE_TEXTURE_URL);
