import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, type ThreeEvent, useFrame, useLoader } from '@react-three/fiber';
import { Box3, Group, Mesh, MeshPhysicalMaterial, SRGBColorSpace, TextureLoader, Vector3 } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

const BLADE_OBJ_URL = 'https://res.cloudinary.com/dcydj6gao/raw/upload/v1785732533/beyblade_poes3s.obj';
const BLADE_TEXTURE_URL = '/visuals/blade/texture-vibrant.jpg';
const DEFAULT_SPEED = 9;
const MIN_SPEED = .5;
const MAX_SPEED = 30;
const TILT_STEP = 5;
const TILT_MIN = -90;
const TILT_MAX = 90;
const MARK_SPACING = .045;

type DefectMark = {
  id: number;
  mesh: string;
  faceIndex: number | null;
  uv: [number, number] | null;
  local: [number, number, number];
  world: [number, number, number];
  normalized: [number, number, number];
};

function BladeModel({ rotationSpeed, tiltX, tiltY, markMode, marks, onMark }: { rotationSpeed: number; tiltX: number; tiltY: number; markMode: boolean; marks: DefectMark[]; onMark: (mark: Omit<DefectMark, 'id'>) => void }) {
  const modelRef = useRef<Group>(null);
  const drawingRef = useRef(false);
  const lastMarkRef = useRef<Vector3 | null>(null);
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

  const markSurface = (event: ThreeEvent<PointerEvent>) => {
    if (!markMode || !modelRef.current) return;
    event.stopPropagation();
    const localPoint = modelRef.current.worldToLocal(event.point.clone());
    if (lastMarkRef.current && lastMarkRef.current.distanceTo(localPoint) < MARK_SPACING) return;
    lastMarkRef.current = localPoint.clone();
    const round = (value: number) => Number(value.toFixed(5));
    onMark({
      mesh: event.object.name || event.object.type,
      faceIndex: event.faceIndex ?? null,
      uv: event.uv ? [round(event.uv.x), round(event.uv.y)] : null,
      local: [round(localPoint.x), round(localPoint.y), round(localPoint.z)],
      world: [round(event.point.x), round(event.point.y), round(event.point.z)],
      normalized: [round(localPoint.x / 1.55), round(localPoint.y / 1.55), round(localPoint.z / 1.55)],
    });
  };

  return (
    <group
      ref={modelRef}
      onPointerDown={(event) => { if (markMode) { drawingRef.current = true; lastMarkRef.current = null; markSurface(event); } }}
      onPointerMove={(event) => { if (drawingRef.current) markSurface(event); }}
      onPointerUp={() => { drawingRef.current = false; lastMarkRef.current = null; }}
      onPointerOut={() => { drawingRef.current = false; lastMarkRef.current = null; }}
    >
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

      {marks.map((mark) => (
        <mesh key={mark.id} position={mark.local} raycast={() => null}>
          <sphereGeometry args={[.026, 12, 10]} />
          <meshBasicMaterial color="#ff2f45" depthTest={false} />
        </mesh>
      ))}
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

export default function BladeVisual({ compact = false }: { compact?: boolean }) {
  const [rotationSpeed, setRotationSpeed] = useState(DEFAULT_SPEED);
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const [fps, setFps] = useState(0);
  const [markMode, setMarkMode] = useState(false);
  const [marks, setMarks] = useState<DefectMark[]>([]);

  const adjustTilt = (axis: 'x' | 'y', direction: 1 | -1) => {
    const update = axis === 'x' ? setTiltX : setTiltY;
    update((value) => Math.max(TILT_MIN, Math.min(TILT_MAX, value + direction * TILT_STEP)));
  };

  const addMark = (mark: Omit<DefectMark, 'id'>) => {
    const nextMark = { ...mark, id: Date.now() + Math.random() };
    setMarks((current) => [...current, nextMark]);
    console.log('BLADE_DEFECT_MARK', JSON.stringify(nextMark));
  };

  return (
    <div className={`flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_38%,#273040_0%,#11151a_42%,#070809_100%)] ${compact ? '' : 'gap-3 p-3 sm:gap-4 sm:p-4'}`}>
      <div className={`relative flex-1 overflow-hidden rounded-2xl ${compact ? '' : 'border border-white/10'}`}>
        <Canvas shadows camera={{ position: [0, 2.2, 4.2], fov: 38 }} dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: 'high-performance', toneMappingExposure: 1.08 }}>
          <ambientLight intensity={.42} />
          <spotLight position={[3.5, 5, 3]} angle={.48} penumbra={.75} intensity={3.6} color="#fff0d2" castShadow />
          <spotLight position={[-4, 2, -3]} angle={.6} penumbra={.8} intensity={2.4} color="#6599d3" />
          <pointLight position={[2, .7, -2.5]} intensity={1.8} distance={7} color="#e9b85d" />
          <Suspense fallback={<LoadingBlade />}>
            <BladeModel rotationSpeed={markMode ? 0 : rotationSpeed} tiltX={tiltX} tiltY={tiltY} markMode={markMode} marks={marks} onMark={addMark} />
          </Suspense>
          <mesh position={[0, -.62, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[2.15, 96]} />
            <meshPhysicalMaterial color="#090b0e" metalness={.72} roughness={.3} clearcoat={.65} />
          </mesh>
          <mesh position={[0, -.605, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.7, 1.76, 96]} />
            <meshPhysicalMaterial color="#b88a42" emissive="#593312" emissiveIntensity={.28} metalness={.94} roughness={.2} />
          </mesh>
          <FpsSampler onFps={setFps} />
        </Canvas>

        <div className={`pointer-events-none absolute left-3 top-3 rounded-full border border-white/10 bg-black/45 font-mono font-bold text-lime-200 backdrop-blur-md ${compact ? 'px-2 py-1 text-[9px]' : 'px-3 py-1.5 text-xs'}`}>
          {fps || '--'} FPS
        </div>
        {markMode && <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-red-400/30 bg-red-500/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-200 backdrop-blur-md">Defect pen active</div>}
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

          <div className="rounded-2xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-stone-300">3D defect pen</div>
                <div className="mt-1 text-[10px] leading-4 text-stone-500">Enable, then click or drag directly over the unwanted part.</div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setMarkMode((active) => !active)} className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition ${markMode ? 'border-red-400/40 bg-red-500/20 text-red-200' : 'border-white/10 bg-white/[.06] text-stone-300 hover:bg-white/10'}`}>{markMode ? 'Stop pen' : 'Mark defect'}</button>
                <button type="button" onClick={() => setMarks([])} disabled={marks.length === 0} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-stone-400 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35">Clear</button>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-black/35 px-3 py-2 font-mono text-[10px] text-stone-400">
              {marks.length === 0 ? 'No points marked' : `${marks.length} points | Last local XYZ: ${marks[marks.length - 1].local.join(', ')}`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

useLoader.preload(OBJLoader, BLADE_OBJ_URL);
useLoader.preload(TextureLoader, BLADE_TEXTURE_URL);
