import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Group, Mesh, Texture } from 'three';
import {
  ModelVisualFallback,
  createWrapTextureMaterial,
  normalizeModel,
  useModelLoader,
  useReducedMotion,
  useTextureLoader,
} from '@/components/focus-visuals/model-core';
import { SEAT_POSITIONS_3D } from './tableConfig3D';
import SeatBillboard from './SeatBillboard';
import type { SeatOccupant } from './TableScene';

export type { SeatOccupant };

const TABLE_OBJ_URL = '/visuals/table/table-3d.obj';
const TABLE_TEXTURE_URL = '/visuals/table/table-3d-texture.png';

function TableModel({ model, texture, reduced }: { model: Group; texture: Texture; reduced: boolean }) {
  const groupRef = useRef<Group>(null);

  const staged = useMemo(() => {
    const clone = model.clone(true);
    const material = createWrapTextureMaterial([texture], {
      roughness: 0.24,
      metalness: 0.36,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14,
      sheen: 0.18,
      sheenColor: '#e2d3b8',
    });
    clone.traverse((child) => {
      if (child instanceof Mesh) child.material = material;
    });
    // Model spans ~1.1 units; normalize to a 3.2-unit table, then lay it flat.
    normalizeModel(clone, 3.2);
    return clone;
  }, [model, texture]);

  useFrame((_state, delta) => {
    if (!groupRef.current || reduced) return;
    groupRef.current.rotation.y += delta * 0.05;
  });

  // The model's thin axis is already Y, so the tabletop lies flat natively —
  // no X rotation. Normalized Y span is ~1.515, so rest its base on the floor.
  return (
    <group ref={groupRef} position={[0, 0.757, 0]}>
      <primitive object={staged} />
    </group>
  );
}

export default function TableScene3D({
  self,
  friends,
}: {
  self: SeatOccupant;
  friends: SeatOccupant[];
  showAnchors?: boolean;
}) {
  const reduced = useReducedMotion();
  const { model, error: modelError } = useModelLoader(TABLE_OBJ_URL);
  const { texture, error: textureError } = useTextureLoader(TABLE_TEXTURE_URL);

  const seated = friends.slice(0, SEAT_POSITIONS_3D.length - 1);
  const error = modelError ?? textureError;

  if (error) {
    return <ModelVisualFallback visualLabel="Study table" reason={error} progress={0} />;
  }
  if (!model || !texture) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-xs text-stone-600 animate-pulse-soft">Preparing the table…</div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 3.4, 5.4], fov: 38 }}
        dpr={[1, 1.5]}
        shadows
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ambientLight intensity={0.34} color="#d8d1c7" />
        <spotLight
          position={[1.4, 5.6, 3.2]}
          intensity={9.4}
          color="#ffe0ac"
          angle={0.52}
          penumbra={1}
          distance={14}
          decay={1.6}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-2.2, 1.1, -1.6]} intensity={0.9} distance={7} decay={2} color="#b6e85a" />
        <pointLight position={[2.6, 1.4, 1.8]} intensity={0.6} distance={6} decay={2} color="#f4cea0" />

        <TableModel model={model} texture={texture} reduced={reduced} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <circleGeometry args={[5.4, 64]} />
          <meshStandardMaterial color="#0d100c" roughness={0.92} metalness={0.04} />
        </mesh>

        <SeatBillboard seat={SEAT_POSITIONS_3D[0]} occupant={self} seatIndex={0} />
        {seated.map((friend, index) => (
          <SeatBillboard
            key={friend.id}
            seat={SEAT_POSITIONS_3D[index + 1]}
            occupant={friend}
            seatIndex={index + 1}
          />
        ))}
      </Canvas>
    </div>
  );
}
