import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, FrontSide, SRGBColorSpace } from 'three';
import type { Group, Mesh, Texture } from 'three';
import { useTextureLoader } from '@/components/focus-visuals/model-core';

/** One full revolution every 15 s — slow, constant, no easing. */
const SPIN_RAD_PER_SEC = (Math.PI * 2) / 15;
/** Clamp so waking the tab never causes a giant jump. */
const MAX_STEP = 0.1;
/** Keep the photo's corners this far inside the shell radius (1). */
const PLANE_RADIUS = 0.95;

/**
 * Layer 2 — static billboard photo. Contain-fit: the rectangle of the
 * image's own aspect inscribed inside a circle of PLANE_RADIUS, so the
 * FULL uploaded image is visible (no crop, no stretch) and its corners
 * never poke through the glass shell. The mesh carries no rotation at
 * all — camera is static, so the picture is pixel-stable forever.
 */
function PhotoPlane({ texture }: { texture: Texture }) {
  texture.colorSpace = SRGBColorSpace;
  const [w, h] = useMemo(() => {
    const img = texture.image as
      | { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number }
      | undefined;
    const iw = img?.naturalWidth || img?.width || 1;
    const ih = img?.naturalHeight || img?.height || 1;
    const aspect = iw / ih;
    // Corner distance from centre = sqrt((a·t)² + t²) = t·sqrt(a²+1) ≤ R.
    const halfH = PLANE_RADIUS / Math.sqrt(aspect * aspect + 1);
    return [aspect * halfH * 2, halfH * 2] as const;
  }, [texture]);
  return (
    <mesh>
      <planeGeometry args={[w, h]} />
      {/* toneMapped:false → colours exactly as uploaded (renderer ACES
          would otherwise mute them). Opaque → renders before the glass. */}
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/** Fresnel rim shell: brightens toward the silhouette (glass edge glow). */
const RIM_VERT = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;
const RIM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uIntensity;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  void main() {
    vec3 viewDir = normalize(-vViewPos);
    float fres = 1.0 - abs(dot(normalize(vNormalV), viewDir));
    fres = pow(clamp(fres, 0.0, 1.0), uPower);
    gl_FragColor = vec4(uColor * uIntensity, fres);
  }
`;

function GlassRim() {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new Color('#f6e3ba') },
      uPower: { value: 2.4 },
      uIntensity: { value: 1.2 },
    }),
    [],
  );
  return (
    // 1.005: sits just outside the shell so the two never z-fight.
    <mesh scale={1.005} renderOrder={2}>
      <sphereGeometry args={[1, 32, 32]} />
      <shaderMaterial
        vertexShader={RIM_VERT}
        fragmentShader={RIM_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        side={FrontSide}
      />
    </mesh>
  );
}

/**
 * Full scene: static photo (layer 2) inside the rotating glass shell
 * (layer 1). The shell itself is untextured — its rotation reads through
 * an orbiting point-light glint sweeping across the clearcoat, plus the
 * fresnel rim. Opacity-only translucency (no `transmission`) so the photo
 * behind it is never refracted or distorted.
 */
function OrbScene({ texture }: { texture: Texture }) {
  const shellRef = useRef<Mesh>(null);
  const glintRef = useRef<Group>(null);
  useFrame((_state, delta) => {
    const step = Math.min(delta, MAX_STEP) * SPIN_RAD_PER_SEC;
    if (shellRef.current) shellRef.current.rotation.y += step;
    if (glintRef.current) glintRef.current.rotation.y += step;
  });
  return (
    <>
      <ambientLight intensity={1.6} />
      <directionalLight position={[2, 2, 3]} intensity={1.3} />
      <directionalLight position={[-2.5, -1.5, -2]} intensity={0.7} />
      {/* Orbiting highlight: this is what makes the spin visible. */}
      <group ref={glintRef}>
        <pointLight position={[2.4, 2.8, 3.2]} intensity={40} color="#ffffff" />
      </group>

      <PhotoPlane texture={texture} />

      {/* Layer 1 — rotating glass shell, no texture, near-side only so a
          single thin veil passes in front of the photo (crisp centre,
          glassy edges). depthWrite off → blends over the photo cleanly. */}
      <mesh ref={shellRef} renderOrder={1}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshPhysicalMaterial
          color="#e8f0ff"
          transparent
          opacity={0.16}
          roughness={0.05}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.05}
          depthWrite={false}
          side={FrontSide}
        />
      </mesh>

      <GlassRim />
    </>
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
 * A dream circle rendered as a two-layer orb: a STATIC, contain-fit flat
 * photo (pixel-exact, never rotates → always sharp and undistorted)
 * inside a SLOWLY ROTATING glass shell (clearcoat sheen + orbiting
 * glint + additive fresnel rim) so the badge still reads as a living,
 * premium 3D bubble. The old wrapped-texture sphere (front + mirrored
 * back) is gone — no seam, no pole pinch, no cropping, by construction.
 *
 * Rendering pauses entirely (frameloop: never) while the tab is hidden.
 * Framing: camera z = 2.59 → the shell silhouette meets the circular
 * glow's inner edge with zero gap.
 * Sizing: resize.offsetSize keeps the canvas CSS box equal to the layout
 * box even under the wrapper's scale() transform (see the comment on
 * <Canvas>) — without it the render is cropped by the overflow:hidden
 * wrapper into a straight edge. Perf note: 3 tiny canvases is cheap; if
 * circles ever scale past ~3, switch to one shared Canvas with multiple
 * meshes.
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
        <OrbScene texture={texture} />
      </Canvas>
    </div>
  );
}
