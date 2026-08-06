import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { Box3, DoubleSide, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Quaternion, SRGBColorSpace, TextureLoader, Vector3 } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { sampleLionSurface } from './butterfly/sampling';
import type { FocusVisualProps } from './types';

const LION_MODEL_URL = '/visuals/butterfly-mosaic/models/lion.obj';
const BUTTERFLY_COUNT = 1200;
const MODEL_SCALE = 2.85;
const SAMPLE_SCALE = MODEL_SCALE / 1.82;

function LionDepthShell() {
  const source = useLoader(OBJLoader, LION_MODEL_URL);
  const lion = useMemo(() => {
    const clone = source.clone(true);
    const bounds = new Box3().setFromObject(clone);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const scale = MODEL_SCALE / Math.max(size.x, size.y);
    const material = new MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
    });
    clone.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.geometry = child.geometry.clone();
      child.geometry.computeVertexNormals();
      child.material = material;
      child.castShadow = false;
      child.receiveShadow = false;
    });
    clone.position.set(-center.x * scale, -center.y * scale - .05, -center.z * scale);
    clone.scale.setScalar(scale);
    return { object: clone, material };
  }, [source]);

  useEffect(() => () => {
    lion.material.dispose();
  }, [lion]);
  return <primitive object={lion.object} />;
}

function SurfaceButterflies() {
  const [ready, setReady] = useState(false);
  const leftRef = useRef<InstancedMesh>(null);
  const rightRef = useRef<InstancedMesh>(null);
  const bodyRef = useRef<InstancedMesh>(null);
  const leftTexture = useLoader(TextureLoader, '/visuals/butterfly-mosaic/wing-left.png');
  const rightTexture = useLoader(TextureLoader, '/visuals/butterfly-mosaic/wing-right.png');
  const bodyTexture = useLoader(TextureLoader, '/visuals/butterfly-mosaic/body.png');

  useEffect(() => {
    leftTexture.colorSpace = SRGBColorSpace;
    rightTexture.colorSpace = SRGBColorSpace;
    bodyTexture.colorSpace = SRGBColorSpace;
    let cancelled = false;
    sampleLionSurface(BUTTERFLY_COUNT, 9137).then((points) => {
      if (cancelled || !leftRef.current || !rightRef.current || !bodyRef.current) return;
      const zAxis = new Vector3(0, 0, 1);
      const normalRotation = new Quaternion();
      const twistRotation = new Quaternion();
      const orientation = new Quaternion();
      const parentMatrix = new Matrix4();
      const localMatrix = new Matrix4();
      const finalMatrix = new Matrix4();
      const scale = new Vector3();
      const position = new Vector3();
      const localPosition = new Vector3();
      const localScale = new Vector3(1, 1, 1);
      const identity = new Quaternion();

      points.forEach((point, index) => {
        position.copy(point.position).multiplyScalar(SAMPLE_SCALE).addScaledVector(point.normal, .042);
        position.y -= .08;
        normalRotation.setFromUnitVectors(zAxis, point.normal);
        twistRotation.setFromAxisAngle(zAxis, ((index * 137.5) % 360) * Math.PI / 180);
        orientation.copy(normalRotation).multiply(twistRotation);
        const instanceScale = .58 + (index % 9) * .016;
        scale.setScalar(instanceScale);
        parentMatrix.compose(position, orientation, scale);

        localPosition.set(-.024, 0, 0);
        localMatrix.compose(localPosition, identity, localScale);
        finalMatrix.multiplyMatrices(parentMatrix, localMatrix);
        leftRef.current!.setMatrixAt(index, finalMatrix);

        localPosition.set(.024, 0, 0);
        localMatrix.compose(localPosition, identity, localScale);
        finalMatrix.multiplyMatrices(parentMatrix, localMatrix);
        rightRef.current!.setMatrixAt(index, finalMatrix);

        localPosition.set(0, 0, .004);
        localMatrix.compose(localPosition, identity, localScale);
        finalMatrix.multiplyMatrices(parentMatrix, localMatrix);
        bodyRef.current!.setMatrixAt(index, finalMatrix);
      });
      leftRef.current.instanceMatrix.needsUpdate = true;
      rightRef.current.instanceMatrix.needsUpdate = true;
      bodyRef.current.instanceMatrix.needsUpdate = true;
      leftRef.current.computeBoundingSphere();
      rightRef.current.computeBoundingSphere();
      bodyRef.current.computeBoundingSphere();
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [bodyTexture, leftTexture, rightTexture]);

  return (
    <group visible={ready}>
      <instancedMesh ref={leftRef} args={[undefined, undefined, BUTTERFLY_COUNT]} renderOrder={3}>
        <planeGeometry args={[.074, .052]} />
        <meshBasicMaterial map={leftTexture} transparent alphaTest={.035} depthWrite side={DoubleSide} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={rightRef} args={[undefined, undefined, BUTTERFLY_COUNT]} renderOrder={3}>
        <planeGeometry args={[.074, .052]} />
        <meshBasicMaterial map={rightTexture} transparent alphaTest={.035} depthWrite side={DoubleSide} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, BUTTERFLY_COUNT]} renderOrder={4}>
        <planeGeometry args={[.022, .062]} />
        <meshBasicMaterial map={bodyTexture} transparent alphaTest={.04} depthWrite side={DoubleSide} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function LionFormation({ rotation }: { rotation: number }) {
  return (
    <group rotation={[0, rotation, 0]}>
      <LionDepthShell />
      <SurfaceButterflies />
    </group>
  );
}

function GalleryStage() {
  return (
    <>
      <mesh position={[0, -1.17, -.04]} receiveShadow>
        <cylinderGeometry args={[1.72, 1.88, .18, 96]} />
        <meshPhysicalMaterial color="#111518" metalness={.58} roughness={.24} clearcoat={.82} clearcoatRoughness={.22} />
      </mesh>
      <mesh position={[0, -1.07, -.04]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.7, 96]} />
        <meshPhysicalMaterial color="#20272a" metalness={.42} roughness={.21} clearcoat={1} clearcoatRoughness={.16} />
      </mesh>
      <mesh position={[0, -1.055, -.04]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.48, .008, 8, 128]} />
        <meshPhysicalMaterial color="#899482" metalness={.74} roughness={.25} />
      </mesh>
    </>
  );
}

function LoadingLion() {
  return <mesh><icosahedronGeometry args={[.72, 2]} /><meshStandardMaterial color="#8c765c" wireframe /></mesh>;
}

export default function ButterflyMosaicVisual({ progress, duration = 0 }: FocusVisualProps & { duration?: number }) {
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const complete = progress >= 1;
  return (
    <div className={`premium-lion focus-visual ${complete ? 'visual-complete' : ''}`} role="img" aria-label="Premium butterfly lion sculpture">
      <div className="premium-lion__architecture" aria-hidden="true" />
      <div className="premium-lion__beam" aria-hidden="true" />
      <div className="premium-lion__glow visual-finish-glow" aria-hidden="true" />
      <Canvas
        frameloop="demand"
        camera={{ position: [0, .08, 4.25], fov: 35 }}
        dpr={[1, 1.65]}
        shadows
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', toneMappingExposure: 1.18 }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ambientLight intensity={.62} color="#e2ddd4" />
        <spotLight position={[-2.4, 4.8, 4.1]} intensity={6.8} color="#fff0d5" angle={.45} penumbra={1} distance={12} decay={1.7} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        <directionalLight position={[3.8, 1.9, 2.7]} intensity={2.2} color="#e7d7bd" />
        <pointLight position={[-2.9, .45, -1.9]} intensity={1.8} distance={6} decay={2} color="#9fb18e" />
        <pointLight position={[0, -1.4, 2.3]} intensity={.65} distance={4} decay={2} color="#d8c7ae" />
        <GalleryStage />
        <Suspense fallback={<LoadingLion />}>
          <LionFormation rotation={rotationDegrees * Math.PI / 180} />
        </Suspense>
      </Canvas>
      {duration > 0 && <div className="premium-lion__controls">
        <div className="premium-lion__controls-row"><span>3D view</span><output>{rotationDegrees}°</output></div>
        <input type="range" min={-180} max={180} step={1} value={rotationDegrees} onChange={(event) => setRotationDegrees(Number(event.target.value))} aria-label="Rotate lion in 3D" />
      </div>}
    </div>
  );
}
