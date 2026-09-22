import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { ClampToEdgeWrapping, Group, Mesh, Texture } from 'three';
import {
  ModelVisualFallback,
  createWrapTextureMaterial,
  normalizeModel,
  useModelLoader,
  useReducedMotion,
  useTextureLoader,
} from '@/components/focus-visuals/model-core';
import Books from './Books';
import Chairs from './Chairs';
import OpenBooks from './OpenBooks';
import PenHolders from './PenHolders';
import Plant from './Plant';
import SittingCharacter from './SittingCharacter';
import type { ObjectTransform } from './transformConfig';
import type { SeatOccupant } from './TableScene';

export type { SeatOccupant };
const TABLE_OBJ_URL = '/visuals/table/table-3d.obj';
const TABLE_TEXTURE_URL = '/visuals/table/table-3d-texture.png';
const WALL_TEXTURE_URL = '/visuals/table/wall-texture.png';

/** Back-wall image placement: left/right, up/down, zoom, and in-plane tilt. */
export interface WallTransform {
  positionX: number;
  positionY: number;
  zoom: number;
  /** In-plane spin of the image (radians): positive = anticlockwise. */
  rotation: number;
}

export const DEFAULT_WALL_TRANSFORM: WallTransform = {
  positionX: 0,
  positionY: 2.7,
  zoom: 1,
  rotation: 0,
};

export interface TableTransform {
  scale: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  cameraDistance: number;
  cameraHeight: number;
}

export const DEFAULT_TABLE_TRANSFORM: TableTransform = {
  scale: 0.74,
  positionX: -0.05,
  positionY: 0.64,
  positionZ: 0.66,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  cameraDistance: 5.4,
  cameraHeight: 3.4,
};

function TableModel({
  model,
  texture,
  transform,
  spin,
}: {
  model: Group;
  texture: Texture;
  transform: TableTransform;
  spin: boolean;
}) {
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
    // Model spans ~1.1 units; normalize to a 3.2-unit table.
    normalizeModel(clone, 3.2);
    return clone;
  }, [model, texture]);

  return (
    <group
      position={[transform.positionX, transform.positionY, transform.positionZ]}
      rotation={[transform.rotationX, transform.rotationY, transform.rotationZ]}
      scale={transform.scale}
    >
      <TableSpin enabled={spin}>
        <primitive object={staged} />
      </TableSpin>
    </group>
  );
}

export default function TableScene3D({
  transform = DEFAULT_TABLE_TRANSFORM,
  chairs = [],
  characterTransforms,
  bookTransforms,
  openBookTransforms,
  plantTransforms,
  penHolderTransforms,
  chairsVisible = false,
  booksVisible = false,
  wallTransform = DEFAULT_WALL_TRANSFORM,
  spin = false,
}: {
  self?: SeatOccupant;
  friends?: SeatOccupant[];
  showAnchors?: boolean;
  transform?: TableTransform;
  /** Per-chair transforms; one chair renders per entry. */
  chairs?: ObjectTransform[];
  /** Per-seat character chair transforms; one character renders per entry. */
  characterTransforms?: ObjectTransform[];
  /** Per-seat book transforms; one book renders per entry. */
  bookTransforms?: ObjectTransform[];
  /** Per-seat open-book transforms; one open book renders per entry. */
  openBookTransforms?: ObjectTransform[];
  /** Plant transforms; one plant renders per entry. */
  plantTransforms?: ObjectTransform[];
  /** Pen holder transforms; one holder renders per entry. */
  penHolderTransforms?: ObjectTransform[];
  /** Hide the empty OBJ chairs without unmounting them. */
  chairsVisible?: boolean;
  /** Hide the closed books without unmounting them. */
  booksVisible?: boolean;
  /** Back-wall image placement (left/right, up/down, zoom). */
  wallTransform?: WallTransform;
  /** Master rotation: spins table in place and orbits chairs/characters with it. */
  spin?: boolean;
}) {
  const reduced = useReducedMotion();
  const { model, error: modelError } = useModelLoader(TABLE_OBJ_URL);
  const { texture, error: textureError } = useTextureLoader(TABLE_TEXTURE_URL);

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
        camera={{ position: [0, transform.cameraHeight, transform.cameraDistance], fov: 38 }}
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

        <TableModel model={model} texture={texture} transform={transform} spin={spin && !reduced} />
        <ChairOrbit enabled={spin && !reduced} center={[transform.positionX, transform.positionZ]}>
          <group visible={chairsVisible}>
            <Chairs transforms={chairs} origin={[transform.positionX, transform.positionZ]} />
          </group>
          {characterTransforms ? (
            <SittingCharacter
              transforms={characterTransforms}
              origin={[transform.positionX, transform.positionZ]}
            />
          ) : null}
          <group visible={booksVisible}>
            {bookTransforms ? (
              <Books
                transforms={bookTransforms}
                origin={[transform.positionX, transform.positionZ]}
              />
            ) : null}
          </group>
          {openBookTransforms ? (
            <OpenBooks
              transforms={openBookTransforms}
              origin={[transform.positionX, transform.positionZ]}
            />
          ) : null}
          {plantTransforms ? (
            <Plant
              transforms={plantTransforms}
              origin={[transform.positionX, transform.positionZ]}
            />
          ) : null}
          {penHolderTransforms ? (
            <PenHolders
              transforms={penHolderTransforms}
              origin={[transform.positionX, transform.positionZ]}
            />
          ) : null}
        </ChairOrbit>
        <Floor />
        <Wall transform={wallTransform} />
      </Canvas>
    </div>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <circleGeometry args={[5.4, 64]} />
      <meshStandardMaterial color="#ffffff" roughness={0.92} metalness={0.04} />
    </mesh>
  );
}

function Wall({ transform }: { transform: WallTransform }) {
  const { texture } = useTextureLoader(WALL_TEXTURE_URL);
  const mapped = useMemo(() => {
    if (!texture) return null;
    const t = texture.clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = ClampToEdgeWrapping;
    t.repeat.set(transform.zoom, transform.zoom);
    t.offset.set((1 - transform.zoom) / 2, (1 - transform.zoom) / 2);
    return t;
  }, [texture, transform.zoom]);
  useEffect(() => () => mapped?.dispose(), [mapped]);

  // Nothing until the image is ready — an opaque placeholder plane would show
  // up as a second dark "wall" behind the artwork.
  if (!mapped) return null;

  return (
    <mesh
      position={[transform.positionX, transform.positionY, -3.6]}
      rotation={[0, 0, transform.rotation]}
      renderOrder={-1}
    >
      <planeGeometry args={[14, 16]} />
      {/* transparent + alphaTest: the PNG's clear areas fall through to the
          scene instead of rendering as an opaque black rectangle. */}
      <meshBasicMaterial
        map={mapped}
        transparent
        alphaTest={0.01}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

const TableSpin = ({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) => {
  const ref = useRef<Group>(null);
  useFrame((_state, delta) => {
    if (enabled && ref.current) ref.current.rotation.y += delta * 0.05;
  });
  return <group ref={ref}>{children}</group>;
};

const ChairOrbit = ({
  children,
  enabled,
  center,
}: {
  children: ReactNode;
  enabled: boolean;
  center: [number, number];
}) => {
  const ref = useRef<Group>(null);
  useFrame((_state, delta) => {
    if (enabled && ref.current) ref.current.rotation.y += delta * 0.05;
  });
  return <group ref={ref} position={[center[0], 0, center[1]]}>{children}</group>;
};
