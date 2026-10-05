import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { SRGBColorSpace } from 'three';
import type { Mesh, Texture } from 'three';
import { useTextureLoader } from '@/components/focus-visuals/model-core';

/** One full Y rotation every 15 s — slow, constant, no easing. */
const SPIN_RAD_PER_SEC = (Math.PI * 2) / 15;
/** Clamp so waking the tab never causes a giant rotation jump. */
const MAX_STEP = 0.1;

/** Y-axis spinner: the photo is genuinely wrapped around 3D geometry. */
function SpinSphere({ texture }: { texture: Texture }) {
  const ref = useRef<Mesh>(null);
  texture.colorSpace = SRGBColorSpace;
  useFrame((_state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += Math.min(delta, MAX_STEP) * SPIN_RAD_PER_SEC;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial map={texture} roughness={0.55} metalness={0} />
    </mesh>
  );
}

/** Tracks tab visibility so the render loop can be stopped while hidden. */
function useTabVisible() {
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  return visible;
}

/**
 * A tiny 3D sphere for one dream circle: the uploaded image is texture-mapped
 * onto real geometry and slowly spins on Y — it foreshortens and curves at
 * the edges like a real ball. Shading comes from the lights below; no CSS
 * rotate/perspective transforms anywhere, so it never flattens.
 *
 * Rendering pauses entirely (frameloop: never) while the tab is hidden.
 * Perf note: 3 tiny canvases is cheap; if circles ever scale past ~3,
 * switch to one shared Canvas with multiple meshes.
 */
export default function DreamSphere({ src }: { src: string }) {
  const { texture } = useTextureLoader(src);
  const visible = useTabVisible();

  if (!texture) {
    // Loading (or failed): keep the circle footprint — the halo still shows.
    return <div className="absolute inset-0" aria-hidden />;
  }

  return (
    <div className="absolute inset-0" aria-hidden>
      <Canvas
        camera={{ position: [0, 0, 2.7], fov: 45 }}
        dpr={[1, 1.5]}
        frameloop={visible ? 'always' : 'never'}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[2, 2, 3]} intensity={1.1} />
        <SpinSphere texture={texture} />
      </Canvas>
    </div>
  );
}
