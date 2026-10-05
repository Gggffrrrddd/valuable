import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { SRGBColorSpace, RepeatWrapping } from 'three';
import type { Mesh, Texture } from 'three';
import { useTextureLoader } from '@/components/focus-visuals/model-core';
import { DEFAULT_DREAM_STRETCH, type DreamStretch } from './placementConfig';

/** One full Y rotation every 15 s — slow, constant, no easing. */
const SPIN_RAD_PER_SEC = (Math.PI * 2) / 15;
/** Clamp so waking the tab never causes a giant rotation jump. */
const MAX_STEP = 0.1;

/** Y-axis spinner: the photo is genuinely wrapped around 3D geometry. */
function SpinSphere({ texture, stretch }: { texture: Texture; stretch: DreamStretch }) {
  const ref = useRef<Mesh>(null);
  texture.colorSpace = SRGBColorSpace;
  // Stretch (hardcoded off the tuner): repeat sets how much of the photo
  // covers one hemisphere horizontally / pole-to-pole vertically; the
  // offsets keep the photo's centre in the middle of the visible
  // hemisphere, so stretching never drifts the subject off to the side.
  //   x = 2 → one upright copy per hemisphere; hardcoded default is x 4
  //           (two copies side-by-side across the visible face);
  //   x < 2 → magnified horizontally, x > 2 → compressed/tiled;
  //   y < 1 → magnified vertically,   y > 1 → compressed/tiled (y 1.9).
  // Repeat wrap on both axes so tuner values beyond 1 tile instead of
  // smearing the edge texel. Back copy = SAME upright image (no mirror).
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(stretch.x, stretch.y);
  texture.offset.set(0.5 - stretch.x / 4, (1 - stretch.y) / 2);
  useFrame((_state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += Math.min(delta, MAX_STEP) * SPIN_RAD_PER_SEC;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 32, 32]} />
      {/* emissiveMap keeps the photo itself visible everywhere, so the
          shadow side can never fall to black — lighting only shades it. */}
      <meshStandardMaterial
        map={texture}
        emissiveMap={texture}
        emissive="#ffffff"
        emissiveIntensity={0.5}
        roughness={0.6}
        metalness={0}
      />
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
 * the edges like a real ball. Brightness is guaranteed two ways: strong
 * ambient + an opposite-side fill light (soft shading, no dark crescent),
 * and the photo also feeds the emissive channel so no surface area can ever
 * render black. No CSS rotate/perspective transforms anywhere, so it never
 * flattens.
 *
 * Rendering pauses entirely (frameloop: never) while the tab is hidden.
 * Framing: camera z = 2.59 makes the silhouette meet the circular glow's
 * inner edge with zero gap (see camera comment). Texture: upright copies
 * front + back, horizontal/vertical stretch adjustable via the temporary
 * DreamStretch tuner (centred by texture offset).
 * Sizing: resize.offsetSize keeps the canvas CSS box equal to the layout
 * box even under the wrapper's scale() transform (see the comment on
 * <Canvas>) — without it the render is cropped by the overflow:hidden
 * wrapper into a straight edge. Perf note: 3 tiny canvases is cheap; if
 * circles ever scale past ~3, switch to one shared Canvas with multiple
 * meshes.
 */
export default function DreamSphere({
  src,
  stretch,
}: {
  src: string;
  /** Texture stretch — defaults to the hardcoded DEFAULT_DREAM_STRETCH. */
  stretch?: DreamStretch;
}) {
  const { texture } = useTextureLoader(src);
  const visible = useTabVisible();

  if (!texture) {
    // Loading (or failed): keep the circle footprint — the halo still shows.
    return <div className="absolute inset-0" aria-hidden />;
  }

  return (
    <div className="absolute inset-0" aria-hidden>
      <Canvas
        // ZERO-MARGIN FRAMING: canvas is square (aspect 1), so the
        // silhouette angular radius α (sin α = r/z) must equal the 22.5°
        // half-FOV → z = 1/sin(22.5°) = 2.6131 = exact tangency (hairline
        // AA gap risk at the 4 tangent points). z = 2.59 overfills by
        // ~1% (≈0.3px on a 56px circle): sphere edge always covers the
        // full disc out to the glow's inner edge — no gap line at any
        // rotation — while the clipped flats stay sub-pixel invisible.
        camera={{ position: [0, 0, 2.59], fov: 45 }}
        dpr={[1, 1.5]}
        frameloop={visible ? 'always' : 'never'}
        // BUG FIX: the circle wrapper carries a CSS scale() transform, and
        // useMeasure's default getBoundingClientRect() reports the SCALED
        // box (e.g. 56px × 1.5 = 84px). R3F then wrote that 84px onto the
        // canvas style while its layout box is still 56px inside an
        // overflow:hidden container → the render was cropped
        // asymmetrically (straight edge + empty patch, same on all three
        // circles). offsetSize measures layout px (offsetWidth/Height),
        // which ignores transforms, so canvas CSS == wrapper exactly.
        resize={{ offsetSize: true }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Key from the front-right + low ambient + a fill from the opposite
            side: the shadow side stays dimly visible, never pitch black. */}
        <ambientLight intensity={1.6} />
        <directionalLight position={[2, 2, 3]} intensity={1.3} />
        <directionalLight position={[-2.5, -1.5, -2]} intensity={0.7} />
        <SpinSphere texture={texture} stretch={stretch ?? DEFAULT_DREAM_STRETCH} />
      </Canvas>
    </div>
  );
}
