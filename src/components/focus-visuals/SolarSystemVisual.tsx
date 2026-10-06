import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';
import type {
  Group,
  Mesh as ThreeMesh,
  PointLight as ThreePointLight,
  Sprite as ThreeSprite,
  Texture,
  WebGLProgramParametersWithUniforms,
} from 'three';
import { TIFFLoader } from 'three/examples/jsm/loaders/TIFFLoader.js';
import type { FocusVisualProps } from './types';
import {
  clamp01,
  ConstellationPoints,
  createGlowTexture,
  ModelVisualFallback,
  preloadAssets,
  smoothstep,
  useReducedMotion,
  useTextureLoader,
} from './model-core';
import type { SurfacePoint } from './model-core';

/**
 * Starlight Solar System ΓÇö a cold deep-space void where a diffuse nebula
 * gradually forms into a full orbiting solar system as session progress
 * advances. Deliberately the opposite of the Butterfly visual: sparse
 * background, blue/violet/electric-white palette only, no text in-scene.
 *
 * Phase mapping (progress 0..1):
 *  0ΓÇô20%   diffuse nebula, ambient drift, no structure
 *  20ΓÇô50%  particles clump to the center; proto-star core glows faintly
 *  50ΓÇô75%  planets coalesce at their orbital radii; orbit guides fade in
 *  75ΓÇô95%  planets resolve into textured spheres; the star ignites (flash)
 *  95ΓÇô100% system settles; camera eases out; Kepler-like orbit speeds
 */

const TEX_BASE = '/visuals/solar-system';
const TEX = {
  sun: `${TEX_BASE}/2k_sun.jpg`,
  mercury: `${TEX_BASE}/2k_mercury.jpg`,
  venus: `${TEX_BASE}/2k_venus_surface.jpg`,
  earthDay: `${TEX_BASE}/2k_earth_daymap.jpg`,
  earthNight: `${TEX_BASE}/2k_earth_nightmap.jpg`,
  earthClouds: `${TEX_BASE}/2k_earth_clouds.jpg`,
  earthNormal: `${TEX_BASE}/2k_earth_normal_map.tif`,
  earthSpec: `${TEX_BASE}/2k_earth_specular_map.tif`,
  mars: `${TEX_BASE}/2k_mars.jpg`,
  jupiter: `${TEX_BASE}/2k_jupiter.jpg`,
  saturn: `${TEX_BASE}/2k_saturn.jpg`,
  saturnRing: `${TEX_BASE}/2k_saturn_ring_alpha.png`,
  uranus: `${TEX_BASE}/2k_uranus.jpg`,
  neptune: `${TEX_BASE}/2k_neptune.jpg`,
  galaxyWhirlpool: `${TEX_BASE}/galaxies/whirlpool-galaxy-tilted.png`,
  galaxyAndromeda: `${TEX_BASE}/galaxies/andromeda-galaxy-tilted.png`,
};

/** Sun pulse period (seconds) ΓÇö the timer-digit CSS pulse uses this same period. */
const SUN_PULSE_PERIOD = 4;
/** Ignition flash fires when progress crosses this value upward. */
const IGNITION_AT = 0.8;
/** Kepler-ish constant: angular speed = K / orbitR^1.5. */
const KEPLER_K = 0.85;

interface PlanetCfg {
  key: string;
  orbitR: number;
  size: number;
  spin: number;
  roughness: number;
}

const PLANETS: PlanetCfg[] = [
  { key: 'mercury', orbitR: 1.8, size: 0.12, spin: 0.1, roughness: 0.95 },
  { key: 'venus', orbitR: 2.5, size: 0.2, spin: 0.06, roughness: 0.8 },
  { key: 'earth', orbitR: 3.2, size: 0.23, spin: 0.22, roughness: 0.9 },
  { key: 'mars', orbitR: 3.9, size: 0.17, spin: 0.2, roughness: 0.95 },
  { key: 'jupiter', orbitR: 5.2, size: 0.58, spin: 0.5, roughness: 0.7 },
  { key: 'saturn', orbitR: 6.8, size: 0.48, spin: 0.45, roughness: 0.7 },
  { key: 'uranus', orbitR: 8.2, size: 0.34, spin: 0.35, roughness: 0.75 },
  { key: 'neptune', orbitR: 9.4, size: 0.32, spin: 0.33, roughness: 0.75 },
];

function orbitSpeed(orbitR: number): number {
  return KEPLER_K / Math.pow(orbitR, 1.5);
}

/** Planet world position for an orbit angle (slight inclination for depth). */
function orbitPos(orbitR: number, angle: number, out: Vector3): Vector3 {
  out.set(Math.cos(angle) * orbitR, Math.sin(angle) * orbitR * 0.05, Math.sin(angle) * orbitR);
  return out;
}

/** .tif maps (earth normal/specular) can't go through TextureLoader (<img> can't
 *  decode TIFF), so load them with three's TIFFLoader under the same contract. */
function useTiffTexture(url: string | null): {
  texture: Texture | null;
  isLoading: boolean;
  error: Error | null;
} {
  const [state, setState] = useState<{ texture: Texture | null; isLoading: boolean; error: Error | null }>({
    texture: null,
    isLoading: !!url,
    error: null,
  });
  useEffect(() => {
    if (!url) {
      setState({ texture: null, isLoading: false, error: null });
      return;
    }
    let cancelled = false;
    let live: Texture | null = null;
    setState({ texture: null, isLoading: true, error: null });
    new TIFFLoader()
      .loadAsync(url)
      .then((tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        live = tex as unknown as Texture;
        setState({ texture: live, isLoading: false, error: null });
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : String(cause);
        const error = new Error(`Failed to load texture: ${url} ΓÇö ${message}`);
        console.error(error.message);
        if (!cancelled) setState({ texture: null, isLoading: false, error });
      });
    return () => {
      cancelled = true;
      if (live) live.dispose();
    };
  }, [url]);
  return state;
}

/** Sparse cold background starfield, reusing the shared reveal engine. */
function BackgroundStars({ progress, reducedMotion }: { progress: number; reducedMotion: boolean }) {
  const stars = useMemo((): SurfacePoint[] => {
    const count = 60; // Less dense
    const ranks = Array.from({ length: count }, (_, i) => i);
    for (let i = ranks.length - 1; i > 0; i -= 1) {
      const swap = Math.floor(Math.random() * (i + 1));
      [ranks[i], ranks[swap]] = [ranks[swap], ranks[i]];
    }
    return ranks.map((rank) => {
      const theta = Math.random() * Math.PI * 2;
      const z = Math.random() * 2 - 1;
      const shell = 35 + Math.random() * 20; // Push them further back behind galaxies
      const xy = Math.sqrt(Math.max(0, 1 - z * z));
      return {
        position: new Vector3(Math.cos(theta) * xy * shell, z * shell * 0.6, Math.sin(theta) * xy * shell),
        normal: new Vector3(0, 1, 0),
        uv: undefined as never,
        revealRank: rank,
        heightRank: 0,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.0003 + Math.random() * 0.0002, // Slower twinkling
      };
    });
  }, []);
  return (
    <ConstellationPoints
      points={stars}
      progress={clamp01(progress * 2)}
      color="#fcfdff" // mostly white
      accentColor="#ffe8dc" // slight warm variants
      size={0.06} // Smaller stars
      staticMode={reducedMotion}
      opacity={0.35} // Low opacity
    />
  );
}

/** 
 * Two real spiral galaxies far in the background. Rendered on flat planes.
 * (Images already contain perspective tilt and transparent background).
 */
/** Tunable placement for a background galaxy (temporary tuner panel below). */
interface GalaxyPlacement {
  x: number;
  y: number;
  z: number;
  size: number;
  opacity: number;
}

function GalSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-1">
      <span className="w-7 shrink-0 text-white/70">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-sky-300"
      />
      <span className="w-11 shrink-0 text-right tabular-nums text-white">
        {step < 0.1 ? value.toFixed(2) : value.toFixed(1)}
      </span>
    </label>
  );
}

function GalaxyTuner({
  title,
  placement,
  onPatch,
}: {
  title: string;
  placement: GalaxyPlacement;
  onPatch: (patch: Partial<GalaxyPlacement>) => void;
}) {
  return (
    <div>
      <div className="mb-0.5 mt-1.5 font-semibold tracking-wide text-white first:mt-0">{title}</div>
      <GalSlider label="X" value={placement.x} min={-45} max={45} step={0.5} onChange={(v) => onPatch({ x: v })} />
      <GalSlider label="Y" value={placement.y} min={-45} max={25} step={0.5} onChange={(v) => onPatch({ y: v })} />
      <GalSlider label="Z" value={placement.z} min={-80} max={-5} step={1} onChange={(v) => onPatch({ z: v })} />
      <GalSlider label="Size" value={placement.size} min={5} max={60} step={1} onChange={(v) => onPatch({ size: v })} />
      <GalSlider label="Op" value={placement.opacity} min={0} max={0.5} step={0.01} onChange={(v) => onPatch({ opacity: v })} />
    </div>
  );
}

function FarBackgroundGalaxies({
  texWhirlpool,
  texAndromeda,
  reducedMotion,
  left,
  center,
}: {
  texWhirlpool: Texture;
  texAndromeda: Texture;
  reducedMotion: boolean;
  left: GalaxyPlacement;
  center: GalaxyPlacement;
}) {
  const refLeft = useRef<ThreeMesh>(null);
  const refCenter = useRef<ThreeMesh>(null);

  useFrame((_state, delta) => {
    if (!reducedMotion) {
      // Extremely subtle rotation
      if (refLeft.current) refLeft.current.rotation.z -= delta * 0.005;
      if (refCenter.current) refCenter.current.rotation.z += delta * 0.003;
    }
  });

  return (
    <group>
      {/* Larger left galaxy (Whirlpool) */}
      <mesh ref={refLeft} position={[left.x, left.y, left.z]} rotation={[0, 0, 0.2]}>
        <planeGeometry args={[left.size, left.size]} />
        <meshBasicMaterial
          map={texWhirlpool}
          transparent
          opacity={left.opacity}
          depthWrite={false}
        />
      </mesh>

      {/* Smaller center galaxy (Andromeda) */}
      <mesh ref={refCenter} position={[center.x, center.y, center.z]} rotation={[0, 0, -0.1]}>
        <planeGeometry args={[center.size, center.size]} />
        <meshBasicMaterial
          map={texAndromeda}
          transparent
          opacity={center.opacity}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** The Sun: textured emissive sphere + pulsing halo + ignition flash. */
function Sun({
  map,
  progressRef,
  activeRef,
  reducedMotion,
  glowCool,
  glowHot,
}: {
  map: Texture;
  progressRef: React.MutableRefObject<number>;
  activeRef: React.MutableRefObject<boolean>;
  reducedMotion: boolean;
  glowCool: Texture;
  glowHot: Texture;
}) {
  const groupRef = useRef<Group>(null);
  const matRef = useRef<ThreeMesh>(null);
  const haloCoolRef = useRef<ThreeSprite>(null);
  const haloHotRef = useRef<ThreeSprite>(null);
  const lightRef = useRef<ThreePointLight>(null);
  const pulseT = useRef(0);
  const flashT = useRef(99);
  const flashArmed = useRef(true);
  const prevP = useRef(0);

  useFrame((_state, delta) => {
    const p = progressRef.current;
    if (!reducedMotion) {
      if (p >= IGNITION_AT && prevP.current < IGNITION_AT && flashArmed.current) {
        flashT.current = 0;
        flashArmed.current = false;
      }
      if (p < IGNITION_AT - 0.1) flashArmed.current = true;
    }
    prevP.current = p;
    if (activeRef.current && !reducedMotion) {
      pulseT.current += delta;
      if (!flashArmed.current) flashT.current += delta;
    }
    const pulse = reducedMotion ? 0 : Math.sin((pulseT.current * Math.PI * 2) / SUN_PULSE_PERIOD);
    const flash = !reducedMotion && !flashArmed.current ? Math.exp(-flashT.current * 1.7) : 0;
    const lit = smoothstep(0.05, 0.15, p);
    const core = smoothstep(0.2, 0.5, p);

    // Balloon growth: the Sun swells into place early, then stays constant.
    if (groupRef.current) groupRef.current.scale.setScalar(Math.max(0.0001, lit));
    const basic = matRef.current?.material as unknown as { color: Color } | undefined;
    if (basic) {
      const heat = 1 + 0.09 * pulse * core + flash * 0.9;
      basic.color.setRGB(heat, heat * (1 - flash * 0.12), heat * (1 - flash * 0.22));
    }
    if (lightRef.current) {
      lightRef.current.intensity = (30 + 7 * pulse) * lit + flash * 260;
    }
    const hc = haloCoolRef.current?.material as unknown as { opacity: number } | undefined;
    if (hc) hc.opacity = Math.min(1, (0.34 + 0.08 * pulse) * lit + flash * 0.5);
    const hh = haloHotRef.current?.material as unknown as { opacity: number } | undefined;
    if (hh) hh.opacity = Math.min(1, (0.5 + 0.12 * pulse) * lit + flash * 0.6);
  });

  return (
    <group ref={groupRef} scale={1}>
      <mesh ref={matRef}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
      <sprite ref={haloHotRef} scale={[4.4, 4.4, 1]}>
        <spriteMaterial
          map={glowHot}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <sprite ref={haloCoolRef} scale={[8.2, 8.2, 1]}>
        <spriteMaterial
          map={glowCool}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <pointLight ref={lightRef} intensity={0} distance={0} decay={2} color="#d6e6ff" />
    </group>
  );
}

function SaturnRing({ inner, outer, map, opacityRef }: { inner: number; outer: number; map: Texture; opacityRef: React.MutableRefObject<number> }) {
  const meshRef = useRef<ThreeMesh>(null);

  const geometry = useMemo(() => {
    const geo = new RingGeometry(inner, outer, 160, 1);
    // Radial UVs: u runs innerΓåÆouter rim so the alpha strip maps correctly
    // (planar UVs would stretch the rings).
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i += 1) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (r - inner) / Math.max(0.0001, outer - inner), 0.5);
    }
    uv.needsUpdate = true;
    return geo;
  }, [inner, outer]);

  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );

  useFrame(() => {
    const mat = meshRef.current?.material as unknown as { opacity: number } | undefined;
    if (mat) mat.opacity = opacityRef.current;
  });

  return (
    <group rotation={[0.32, 0, 0.18]}>
      <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial map={map} transparent opacity={0} side={DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function EarthBody({
  size,
  dayTex,
  nightTex,
  cloudTex,
  normalTex,
  specTex,
  spinRef,
  rimOpacityRef,
  opacityRef,
}: {
  size: number;
  dayTex: Texture;
  nightTex: Texture;
  cloudTex: Texture;
  normalTex: Texture | null;
  specTex: Texture | null;
  spinRef: React.MutableRefObject<{ base: number; clouds: number }>;
  rimOpacityRef: React.MutableRefObject<number>;
  opacityRef: React.MutableRefObject<number>;
}) {
  const baseRef = useRef<ThreeMesh>(null);
  const cloudsRef = useRef<ThreeMesh>(null);
  const rimMatRef = useRef<ShaderMaterial>(null);

  const earthMat = useMemo(() => {
    const m = new MeshStandardMaterial({ map: dayTex, roughness: 0.9, metalness: 0, transparent: true });
    m.emissive = new Color('#ffffff');
    m.emissiveMap = nightTex;
    m.emissiveIntensity = 1.15;
    if (normalTex) {
      m.normalMap = normalTex;
      m.normalScale.set(0.55, 0.55);
    }
    if (specTex) {
      // Oceans (bright in the specular map) stay glossy, land stays matte.
      m.roughnessMap = specTex;
      m.roughness = 1;
    }
    m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uSunPos = { value: new Vector3(0, 0, 0) };
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vSolWorldPos;\nvarying vec3 vSolWorldNormal;\nvarying vec2 vSolUv;',
        )
        .replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvSolWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvSolWorldNormal = normalize(mat3(modelMatrix) * objectNormal);\nvSolUv = uv;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vSolWorldPos;\nvarying vec3 vSolWorldNormal;\nvarying vec2 vSolUv;\nuniform vec3 uSunPos;',
        )
        .replace(
          '#include <roughnessmap_fragment>',
          'float specSample = texture2D(roughnessMap, vSolUv).g;\nfloat roughnessFactor = mix(0.92, 0.24, smoothstep(0.35, 0.65, specSample));',
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float solFace = dot(normalize(vSolWorldNormal), normalize(uSunPos - vSolWorldPos));
          float solDay = smoothstep(-0.12, 0.3, solFace);
          diffuseColor.rgb *= mix(0.05, 1.0, solDay);
          totalEmissiveRadiance *= (1.0 - solDay);`,
        );
    };
    return m;
  }, [dayTex, nightTex, normalTex, specTex]);

  useEffect(
    () => () => {
      earthMat.dispose();
    },
    [earthMat],
  );

  const cloudMat = useMemo(
    () =>
      new MeshStandardMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.88,
        roughness: 1,
        metalness: 0,
        depthWrite: false,
      }),
    [cloudTex],
  );

  useEffect(
    () => () => {
      cloudMat.dispose();
    },
    [cloudMat],
  );

  const rimMat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uColor: { value: new Color('#6fb7ff') }, uOpacity: { value: 0 } },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 3.0);
            gl_FragColor = vec4(uColor, rim * uOpacity);
          }
        `,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: BackSide,
      }),
    [],
  );

  useEffect(
    () => () => {
      rimMat.dispose();
    },
    [rimMat],
  );

  useFrame(() => {
    if (rimMatRef.current) {
      rimMatRef.current.uniforms.uOpacity.value = rimOpacityRef.current;
    }
    earthMat.opacity = opacityRef.current;
    cloudMat.opacity = opacityRef.current * 0.88;
  });

  return (
    <>
      <mesh ref={baseRef} material={earthMat}>
        <sphereGeometry args={[size, 48, 48]} />
      </mesh>
      <mesh ref={cloudsRef} material={cloudMat} scale={1.025}>
        <sphereGeometry args={[size, 48, 48]} />
      </mesh>
      <mesh material={rimMat} scale={1.1}>
        <sphereGeometry args={[size, 48, 48]} />
      </mesh>
      <SpinDriver baseRef={baseRef} cloudsRef={cloudsRef} spinRef={spinRef} />
    </>
  );
}

/** Applies differential rotation to the earth base + cloud spheres. */
function SpinDriver({
  baseRef,
  cloudsRef,
  spinRef,
}: {
  baseRef: React.RefObject<ThreeMesh>;
  cloudsRef: React.RefObject<ThreeMesh>;
  spinRef: React.MutableRefObject<{ base: number; clouds: number }>;
}) {
  useFrame(() => {
    if (baseRef.current) baseRef.current.rotation.y = spinRef.current.base;
    if (cloudsRef.current) cloudsRef.current.rotation.y = spinRef.current.clouds;
  });
  return null;
}

function Planet({
  cfg,
  index,
  map,
  textures,
  progressRef,
  activeRef,
  reducedMotion,
}: {
  cfg: PlanetCfg;
  index: number;
  map: Texture;
  textures: {
    earthDay: Texture | null;
    earthNight: Texture | null;
    earthClouds: Texture | null;
    earthNormal: Texture | null;
    earthSpec: Texture | null;
    saturnRing: Texture | null;
  };
  progressRef: React.MutableRefObject<number>;
  activeRef: React.MutableRefObject<boolean>;
  reducedMotion: boolean;
}) {
  const posRef = useRef<Group>(null);
  const scaleRef = useRef<Group>(null);
  const spinRef = useRef<Group>(null);
  const angleRef = useRef(Math.random() * Math.PI * 2);
  const earthSpin = useRef({ base: 0, clouds: 0 });
  const opacityRef = useRef(0);
  const rimOpacityRef = useRef(0);
  const scratch = useMemo(() => new Vector3(), []);
  // One-by-one swift balloon growth: each planet gets its own short window,
  // in order (Mercury → Neptune). Never reveals in batches/rounds.
  const revealAt: [number, number] = useMemo(
    () => {
      const start = 0.18 + index * 0.075;
      return [start, start + 0.05] as [number, number];
    },
    [index],
  );

  const mat = useMemo(
    () => new MeshStandardMaterial({ map, roughness: cfg.roughness, metalness: 0, transparent: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map],
  );

  // Orbit ring appears instantly the moment this planet arrives (no delayed global fade).
  const orbitMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#5f7fc9',
        transparent: true,
        opacity: 0,
        side: DoubleSide,
        depthWrite: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      mat.dispose();
      orbitMat.dispose();
    },
    [mat, orbitMat],
  );

  useFrame((_state, delta) => {
    const p = progressRef.current;
    const reveal = smoothstep(revealAt[0], revealAt[1], p);
    opacityRef.current = reveal;
    rimOpacityRef.current = 0.8 * reveal;
    mat.opacity = reveal;
    orbitMat.opacity = reveal > 0.02 ? 0.32 : 0;
    if (activeRef.current && !reducedMotion) {
      angleRef.current += orbitSpeed(cfg.orbitR) * delta;
    }
    orbitPos(cfg.orbitR, angleRef.current, scratch);
    if (posRef.current) posRef.current.position.copy(scratch);
    // Balloon growth: swell from nothing to full size inside its own window.
    if (scaleRef.current) scaleRef.current.scale.setScalar(Math.max(0.0001, reveal));
    if (spinRef.current && activeRef.current && !reducedMotion) {
      spinRef.current.rotation.y += cfg.spin * delta;
      earthSpin.current.base += cfg.spin * delta;
      earthSpin.current.clouds += cfg.spin * 1.35 * delta;
    }
  });

  const isEarth = cfg.key === 'earth';
  const isSaturn = cfg.key === 'saturn';

  return (
    <>
      <group ref={posRef}>
        <group ref={scaleRef} scale={0.0001}>
          <group ref={spinRef}>
            {isEarth && textures.earthDay && textures.earthNight && textures.earthClouds ? (
              <EarthBody
                size={cfg.size}
                dayTex={textures.earthDay}
                nightTex={textures.earthNight}
                cloudTex={textures.earthClouds}
                normalTex={textures.earthNormal}
                specTex={textures.earthSpec}
                spinRef={earthSpin}
                rimOpacityRef={rimOpacityRef}
                opacityRef={opacityRef}
              />
            ) : (
              <mesh material={mat}>
                <sphereGeometry args={[cfg.size, 48, 48]} />
              </mesh>
            )}
          </group>
          {isSaturn && textures.saturnRing && (
            <SaturnRing inner={cfg.size * 1.28} outer={cfg.size * 2.15} map={textures.saturnRing} opacityRef={opacityRef} />
          )}
        </group>
      </group>
      {/* Orbit ring stays centered on the Sun (outside the planet's moving group). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={orbitMat}>
        <ringGeometry args={[cfg.orbitR - 0.012, cfg.orbitR + 0.012, 160]} />
      </mesh>
    </>
  );
}

function LoadingSun() {
  return null;
}

export default function SolarSystemVisual({ progress, running = false, depth = 0.5 }: FocusVisualProps & { depth?: number }) {
  const reducedMotion = useReducedMotion();
  const value = clamp01(progress);
  const complete = value >= 1;
  // Reduced-motion users skip the formation entirely: settled system only.
  const p = reducedMotion ? 1 : value;
  const progressRef = useRef(p);
  progressRef.current = p;
  const depthRef = useRef(0.5);
  depthRef.current = depth;
  const activeRef = useRef(running || complete);
  activeRef.current = running || complete;

  const [loop, setLoop] = useState(true);
  // Temporary galaxy placement tuner (hardcode + remove panel once placed).
  const [galLeft, setGalLeft] = useState<GalaxyPlacement>({ x: -15, y: -8, z: -30, size: 26, opacity: 0.15 });
  const [galCenter, setGalCenter] = useState<GalaxyPlacement>({ x: 10, y: -14, z: -35, size: 20, opacity: 0.12 });
  const [showTuner, setShowTuner] = useState(true);
  const patchLeft = (patch: Partial<GalaxyPlacement>) => setGalLeft((g) => ({ ...g, ...patch }));
  const patchCenter = (patch: Partial<GalaxyPlacement>) => setGalCenter((g) => ({ ...g, ...patch }));
  useEffect(() => {
    const onVis = () => setLoop(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const { texture: sunTex, error: sunError, isLoading: sunLoading } = useTextureLoader(TEX.sun);
  const { texture: mercuryTex, error: mercuryError, isLoading: mercuryLoading } = useTextureLoader(TEX.mercury);
  const { texture: venusTex, error: venusError, isLoading: venusLoading } = useTextureLoader(TEX.venus);
  const { texture: earthDayTex, error: earthDayError, isLoading: earthDayLoading } = useTextureLoader(TEX.earthDay);
  const { texture: earthNightTex, error: earthNightError, isLoading: earthNightLoading } = useTextureLoader(TEX.earthNight);
  const { texture: earthCloudsTex, error: earthCloudsError, isLoading: earthCloudsLoading } = useTextureLoader(TEX.earthClouds);
  const { texture: earthNormalTex, error: earthNormalError, isLoading: earthNormalLoading } = useTiffTexture(TEX.earthNormal);
  const { texture: earthSpecTex, error: earthSpecError, isLoading: earthSpecLoading } = useTiffTexture(TEX.earthSpec);
  const { texture: marsTex, error: marsError, isLoading: marsLoading } = useTextureLoader(TEX.mars);
  const { texture: jupiterTex, error: jupiterError, isLoading: jupiterLoading } = useTextureLoader(TEX.jupiter);
  const { texture: saturnTex, error: saturnError, isLoading: saturnLoading } = useTextureLoader(TEX.saturn);
  const { texture: ringTex, error: ringError, isLoading: ringLoading } = useTextureLoader(TEX.saturnRing);
  const { texture: uranusTex, error: uranusError, isLoading: uranusLoading } = useTextureLoader(TEX.uranus);
  const { texture: neptuneTex, error: neptuneError, isLoading: neptuneLoading } = useTextureLoader(TEX.neptune);
  const { texture: galaxyWhirlpoolTex } = useTextureLoader(TEX.galaxyWhirlpool);
  const { texture: galaxyAndromedaTex } = useTextureLoader(TEX.galaxyAndromeda);

  const firstError =
    sunError ??
    mercuryError ??
    venusError ??
    earthDayError ??
    earthNightError ??
    earthCloudsError ??
    earthNormalError ??
    earthSpecError ??
    marsError ??
    jupiterError ??
    saturnError ??
    ringError ??
    uranusError ??
    neptuneError ??
    null;

  // Color maps render in sRGB (shared cache: every consumer wants this).
  const colorMaps = useMemo(
    () =>
      [
        sunTex,
        mercuryTex,
        venusTex,
        earthDayTex,
        earthNightTex,
        earthCloudsTex,
        marsTex,
        jupiterTex,
        saturnTex,
        ringTex,
        uranusTex,
        neptuneTex,
        galaxyWhirlpoolTex,
        galaxyAndromedaTex,
      ].filter((t): t is Texture => !!t),
    [
      sunTex,
      mercuryTex,
      venusTex,
      earthDayTex,
      earthNightTex,
      earthCloudsTex,
      marsTex,
      jupiterTex,
      saturnTex,
      ringTex,
      uranusTex,
      neptuneTex,
      galaxyWhirlpoolTex,
      galaxyAndromedaTex,
    ],
  );
  useEffect(() => {
    for (const t of colorMaps) t.colorSpace = SRGBColorSpace;
  }, [colorMaps]);

  const glowCool = useMemo(() => createGlowTexture('150,190,255'), []);
  const glowHot = useMemo(() => createGlowTexture('238,244,255'), []);
  useEffect(
    () => () => {
      glowCool.dispose();
      glowHot.dispose();
    },
    [glowCool, glowHot],
  );

  const mapsByKey: Record<string, Texture | null> = {
    mercury: mercuryTex,
    venus: venusTex,
    earth: earthDayTex,
    mars: marsTex,
    jupiter: jupiterTex,
    saturn: saturnTex,
    uranus: uranusTex,
    neptune: neptuneTex,
  };

  if (firstError) {
    return (
      <ModelVisualFallback
        visualLabel="Solar System"
        reason={firstError}
        progress={value}
        running={running}
        duration={0}
      />
    );
  }

  const ready =
    !sunLoading &&
    !mercuryLoading &&
    !venusLoading &&
    !earthDayLoading &&
    !earthNightLoading &&
    !earthCloudsLoading &&
    !earthNormalLoading &&
    !earthSpecLoading &&
    !marsLoading &&
    !jupiterLoading &&
    !saturnLoading &&
    !ringLoading &&
    !uranusLoading &&
    !neptuneLoading &&
    !!sunTex &&
    !!mercuryTex &&
    !!venusTex &&
    !!earthDayTex &&
    !!earthNightTex &&
    !!earthCloudsTex &&
    !!marsTex &&
    !!jupiterTex &&
    !!saturnTex &&
    !!ringTex &&
    !!uranusTex &&
    !!neptuneTex;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <Canvas
        camera={{ position: [0, 8.5, 13], fov: 40, near: 0.1, far: 120 }}
        dpr={[1, 1.75]}
        frameloop={loop ? 'always' : 'never'}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.12;
        }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ambientLight intensity={0.38} color="#8fa8d8" />
        {galaxyWhirlpoolTex && galaxyAndromedaTex ? (
          <FarBackgroundGalaxies
            texWhirlpool={galaxyWhirlpoolTex}
            texAndromeda={galaxyAndromedaTex}
            reducedMotion={reducedMotion}
            left={galLeft}
            center={galCenter}
          />
        ) : null}
        <BackgroundStars progress={p} reducedMotion={reducedMotion} />
        {ready && sunTex ? (
          <>
            <Sun
              map={sunTex}
              progressRef={progressRef}
              activeRef={activeRef}
              reducedMotion={reducedMotion}
              glowCool={glowCool}
              glowHot={glowHot}
            />
            {PLANETS.map((cfg, index) => {
              const map = mapsByKey[cfg.key];
              if (!map) return null;
              return (
                <Planet
                  key={cfg.key}
                  cfg={cfg}
                  index={index}
                  map={map}
                  textures={{
                    earthDay: earthDayTex,
                    earthNight: earthNightTex,
                    earthClouds: earthCloudsTex,
                    earthNormal: earthNormalTex,
                    earthSpec: earthSpecTex,
                    saturnRing: ringTex,
                  }}
                  progressRef={progressRef}
                  activeRef={activeRef}
                  reducedMotion={reducedMotion}
                />
              );
            })}
            <CameraRig depthRef={depthRef} />
          </>
        ) : (
          <LoadingSun />
        )}
      </Canvas>
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,.5) 82%, rgba(0,0,0,1) 100%)',
        }}
      />
      {showTuner ? (
        <div className="absolute left-3 top-3 z-50 max-h-[70%] w-60 overflow-y-auto rounded-md border border-white/15 bg-black/70 p-2 text-[10px] leading-tight text-white/90 backdrop-blur-sm">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold tracking-wide text-white">GALAXIES (temp)</span>
            <button
              type="button"
              onClick={() => setShowTuner(false)}
              className="rounded border border-white/20 px-1.5 py-0.5 text-white/70 hover:text-white"
            >
              hide
            </button>
          </div>
          <GalaxyTuner title="L · whirlpool (left)" placement={galLeft} onPatch={patchLeft} />
          <GalaxyTuner title="C · andromeda (middle)" placement={galCenter} onPatch={patchCenter} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowTuner(true)}
          className="absolute left-3 top-3 z-50 rounded border border-white/20 bg-black/70 px-2 py-1 text-[10px] text-white/70 hover:text-white"
        >
          galaxies
        </button>
      )}
    </div>
  );
}

/** Keeps the system framed at a constant distance; `depth` (0..1) lets the
 *  user push the whole system back or pull it front. No progress-driven zoom. */
function CameraRig({ depthRef }: { depthRef: React.MutableRefObject<number> }) {
  const base = useMemo(() => new Vector3(0, 8.5, 13), []);
  useFrame(({ camera }) => {
    // depth 0 = close/front (x0.65), 0.5 = default (x1), 1 = far/back (x1.6)
    const k = 0.65 + depthRef.current * 1.9;
    camera.position.copy(base).multiplyScalar(k);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

preloadAssets(
  TEX.sun,
  TEX.mercury,
  TEX.venus,
  TEX.earthDay,
  TEX.earthNight,
  TEX.earthClouds,
  TEX.mars,
  TEX.jupiter,
  TEX.saturn,
  TEX.saturnRing,
  TEX.uranus,
  TEX.neptune,
  TEX.galaxyWhirlpool,
  TEX.galaxyAndromeda,
);
