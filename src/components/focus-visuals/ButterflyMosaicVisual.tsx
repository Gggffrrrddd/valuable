import { Suspense, useEffect, useMemo } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { Box3, Mesh, MeshPhysicalMaterial, Vector3 } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { FocusVisualProps } from './types';

const LION_MODEL_URL = '/visuals/butterfly-mosaic/models/lion.obj';

function LionSculpture() {
  const source = useLoader(OBJLoader, LION_MODEL_URL);
  const lion = useMemo(() => {
    const clone = source.clone(true);
    const bounds = new Box3().setFromObject(clone);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const scale = 2.85 / Math.max(size.x, size.y);
    const material = new MeshPhysicalMaterial({
      color: '#8d6840',
      emissive: '#160d07',
      emissiveIntensity: .12,
      metalness: .72,
      roughness: .3,
      clearcoat: .72,
      clearcoatRoughness: .24,
      sheen: .24,
      sheenColor: '#f0c98d',
      specularIntensity: .9,
      iridescence: .07,
      iridescenceIOR: 1.3,
    });
    clone.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.geometry = child.geometry.clone();
      child.geometry.computeVertexNormals();
      child.material = material;
      child.castShadow = true;
      child.receiveShadow = true;
    });
    clone.position.set(-center.x * scale, -center.y * scale - .05, -center.z * scale);
    clone.scale.setScalar(scale);
    return { object: clone, material };
  }, [source]);

  useEffect(() => () => lion.material.dispose(), [lion]);
  return <primitive object={lion.object} />;
}

function GalleryStage() {
  return (
    <>
      <mesh position={[0, -1.17, -.04]} receiveShadow>
        <cylinderGeometry args={[1.72, 1.88, .18, 96]} />
        <meshPhysicalMaterial color="#17120e" metalness={.58} roughness={.24} clearcoat={.82} clearcoatRoughness={.22} />
      </mesh>
      <mesh position={[0, -1.07, -.04]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.7, 96]} />
        <meshPhysicalMaterial color="#2a2119" metalness={.46} roughness={.2} clearcoat={1} clearcoatRoughness={.16} />
      </mesh>
      <mesh position={[0, -1.055, -.04]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.48, .008, 8, 128]} />
        <meshPhysicalMaterial color="#7d603e" metalness={.86} roughness={.22} />
      </mesh>
    </>
  );
}

function LoadingLion() {
  return <mesh><icosahedronGeometry args={[.72, 2]} /><meshStandardMaterial color="#59442e" wireframe /></mesh>;
}

export default function ButterflyMosaicVisual({ progress }: FocusVisualProps & { duration?: number }) {
  const complete = progress >= 1;
  return (
    <div className={`premium-lion focus-visual ${complete ? 'visual-complete' : ''}`} role="img" aria-label="Premium front-facing lion sculpture">
      <div className="premium-lion__architecture" aria-hidden="true" />
      <div className="premium-lion__beam" aria-hidden="true" />
      <div className="premium-lion__glow visual-finish-glow" aria-hidden="true" />
      <Canvas
        frameloop="demand"
        camera={{ position: [0, .08, 4.25], fov: 35 }}
        dpr={[1, 1.65]}
        shadows
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', toneMappingExposure: 1.28 }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ambientLight intensity={.42} color="#d5cec1" />
        <spotLight position={[-2.5, 4.6, 4.2]} intensity={8.4} color="#ffe0a8" angle={.43} penumbra={1} distance={12} decay={1.7} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        <directionalLight position={[3.6, 1.8, 2.6]} intensity={2.1} color="#d6b477" />
        <pointLight position={[-2.8, .5, -1.8]} intensity={1.7} distance={6} decay={2} color="#839b79" />
        <pointLight position={[0, -1.5, 2.2]} intensity={.7} distance={4} decay={2} color="#f0c588" />
        <GalleryStage />
        <Suspense fallback={<LoadingLion />}>
          <LionSculpture />
        </Suspense>
      </Canvas>
    </div>
  );
}
