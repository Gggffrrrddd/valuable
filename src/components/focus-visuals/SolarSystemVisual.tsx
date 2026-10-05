import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Line,
  LineBasicMaterial,
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
  Points as ThreePoints,
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
 * Starlight Solar System — a cold deep-space void where a diffuse nebula
 * gradually forms into a full orbiting solar system as session progress
 * advances. Deliberately the opposite of the Butterfly visual: sparse
 * background, blue/violet/electric-white palette only, no text in-scene.
 *
 * Phase mapping (progress 0..1):
 *  0–20%   diffuse nebula, ambient drift, no structure
 *  20–50%  particles clump to the center; proto-star core glows faintly
 *  50–75%  planets coalesce at their orbital radii; orbit guides fade in
 *  75–95%  planets resolve into textured spheres; the star ignites (flash)
 *  95–100% system settles; camera eases out; Kepler-like orbit speeds
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
};

/** Sun pulse period (seconds) — the timer-digit CSS pulse uses this same period. */
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
  trailColor: string;
}

const PLANETS: PlanetCfg[] = [
  { key: 'mercury', orbitR: 1.8, size: 0.12, spin: 0.1, roughness: 0.95, trailColor: '#9aa8c8' },
  { key: 'venus', orbitR: 2.5, size: 0.2, spin: 0.06, roughness: 0.8, trailColor: '#c8c4e8' },
  { key: 'earth', orbitR: 3.2, size: 0.23, spin: 0.22, roughness: 0.9, trailColor: '#9fc8ff' },
  { key: 'mars', orbitR: 3.9, size: 0.17, spin: 0.2, roughness: 0.95, trailColor: '#d8b8a8' },
  { key: 'jupiter', orbitR: 5.2, size: 0.58, spin: 0.5, roughness: 0.7, trailColor: '#d8ccf0' },
  { key: 'saturn', orbitR: 6.8, size: 0.48, spin: 0.45, roughness: 0.7, trailColor: '#e0d4b8' },
  { key: 'uranus', orbitR: 8.2, size: 0.34, spin: 0.35, roughness: 0.75, trailColor: '#a8d8e8' },
  { key: 'neptune', orbitR: 9.4, size: 0.32, spin: 0.33, roughness: 0.75, trailColor: '#90a8f0' },
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
        const error = new Error(`Failed to load texture: ${url} — ${message}`);
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
    const count = 220;
    const ranks = Array.from({ length: count }, (_, i) => i);
    for (let i = ranks.length - 1; i > 0; i -= 1) {
      const swap = Math.floor(Math.random() * (i + 1));
      [ranks[i], ranks[swap]] = [ranks[swap], ranks[i]];
    }
    return ranks.map((rank) => {
      const theta = Math.random() * Math.PI * 2;
      const z = Math.random() * 2 - 1;
      const shell = 15 + Math.random() * 10;
      const xy = Math.sqrt(Math.max(0, 1 - z * z));
      return {
        position: new Vector3(Math.cos(theta) * xy * shell, z * shell * 0.6, Math.sin(theta) * xy * shell),
        normal: new Vector3(0, 1, 0),
        uv: undefined as never,
        revealRank: rank,
        heightRank: 0,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.0009 + Math.random() * 0.00085,
      };
    });
  }, []);
  return (
    <ConstellationPoints
      points={stars}
      progress={clamp01(progress * 2)}
      color="#8fb4ff"
      accentColor="#eaf2ff"
      size={0.11}
      staticMode={reducedMotion}
      opacity={0.85}
    />
  );
}

/** The diffuse nebula: scattered particles that converge, then fade away. */
function Nebula({
  progressRef,
  activeRef,
}: {
  progressRef: React.MutableRefObject<number>;
  activeRef: React.MutableRefObject<boolean>;
}) {
  const COUNT = 520;
  const pointsRef = useRef<ThreePoints>(null);
  const timeRef = useRef(0);

  const data = useMemo(() => {
    const scattered = new Float32Array(COUNT * 3);
    const target = new Float32Array(COUNT * 3);
    const phase = new Float32Array(COUNT);
    const drift = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    const palette = [new Color('#7fb2ff'), new Color('#b48cff'), new Color('#eef4ff')];
    for (let i = 0; i < COUNT; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const shell = 3 + Math.random() * 7;
      scattered[i * 3] = Math.sin(phi) * Math.cos(theta) * shell;
      scattered[i * 3 + 1] = Math.cos(phi) * shell * 0.55;
      scattered[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * shell;
      // 70% collapse to the core, 30% seed the future orbit band.
      if (Math.random() < 0.7) {
        target[i * 3] = (Math.random() - 0.5) * 1.2;
        target[i * 3 + 1] = (Math.random() - 0.5) * 0.8;
        target[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
      } else {
        const cfg = PLANETS[Math.floor(Math.random() * PLANETS.length)];
        const a = Math.random() * Math.PI * 2;
        target[i * 3] = Math.cos(a) * cfg.orbitR;
        target[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
        target[i * 3 + 2] = Math.sin(a) * cfg.orbitR;
      }
      phase[i] = Math.random() * Math.PI * 2;
      drift[i] = 0.2 + Math.random() * 0.5;
      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { scattered, target, phase, drift, colors };
  }, []);

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(data.scattered.slice(), 3));
    geo.setAttribute('color', new BufferAttribute(data.colors, 3));
    return geo;
  }, [data]);

  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );

  useFrame((_state, delta) => {
    const points = pointsRef.current;
    if (!points) return;
    const material = points.material as unknown as { opacity: number };
    const p = progressRef.current;
    const fade = 1 - smoothstep(0.8, 0.97, p);
    material.opacity = fade * 0.9;
    points.visible = fade > 0.003;
    if (!points.visible) return;
    if (activeRef.current) timeRef.current += delta;
    const t = timeRef.current;
    const converge = smoothstep(0.18, 0.85, p);
    const attr = geometry.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;
    const { scattered, target, phase, drift } = data;
    for (let i = 0; i < COUNT; i += 1) {
      const w = Math.sin(t * drift[i] + phase[i]) * 0.18;
      arr[i * 3] = scattered[i * 3] + (target[i * 3] - scattered[i * 3]) * converge + w;
      arr[i * 3 + 1] =
        scattered[i * 3 + 1] + (target[i * 3 + 1] - scattered[i * 3 + 1]) * converge + w * 0.6;
      arr[i * 3 + 2] = scattered[i * 3 + 2] + (target[i * 3 + 2] - scattered[i * 3 + 2]) * converge - w;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.11}
        vertexColors
        transparent
        opacity={0.9}
        blending={AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
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
    const lit = smoothstep(0.12, 0.45, p);
    const core = smoothstep(0.2, 0.5, p);

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
    <group ref={groupRef} scale={0.0001}>
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

/** Faint fading trail behind an orbiting planet (short comet-tail look). */
const TRAIL_N = 48;

function Trail({
  orbitR,
  angleRef,
  color,
  progressRef,
  revealAt,
}: {
  orbitR: number;
  angleRef: React.MutableRefObject<number>;
  color: string;
  progressRef: React.MutableRefObject<number>;
  revealAt: [number, number];
}) {
  const histRef = useRef<Float32Array | null>(null);
  const frameRef = useRef(0);
  const scratch = useMemo(() => new Vector3(), []);

  const trail = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(TRAIL_N * 3), 3));
    const mat = new LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const line = new Line(geo, mat);
    line.frustumCulled = false;
    line.visible = false;
    return line;
  }, [color]);

  useEffect(
    () => () => {
      trail.geometry.dispose();
      (trail.material as LineBasicMaterial).dispose();
    },
    [trail],
  );

  useFrame(() => {
    const reveal = smoothstep(revealAt[0], revealAt[1], progressRef.current);
    const mat = trail.material as LineBasicMaterial;
    mat.opacity = 0.38 * reveal;
    trail.visible = reveal > 0.02;
    if (!trail.visible) return;
    orbitPos(orbitR, angleRef.current, scratch);
    if (!histRef.current) {
      histRef.current = new Float32Array(TRAIL_N * 3);
      for (let i = 0; i < TRAIL_N; i += 1) {
        histRef.current[i * 3] = scratch.x;
        histRef.current[i * 3 + 1] = scratch.y;
        histRef.current[i * 3 + 2] = scratch.z;
      }
    }
    frameRef.current += 1;
    if (frameRef.current % 2 === 0) {
      const h = histRef.current;
      h.copyWithin(0, 3);
      h[(TRAIL_N - 1) * 3] = scratch.x;
      h[(TRAIL_N - 1) * 3 + 1] = scratch.y;
      h[(TRAIL_N - 1) * 3 + 2] = scratch.z;
    }
    const attr = trail.geometry.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;
    const h = histRef.current;
    for (let i = 0; i < TRAIL_N; i += 1) {
      arr[i * 3] = h[i * 3] - scratch.x;
      arr[i * 3 + 1] = h[i * 3 + 1] - scratch.y;
      arr[i * 3 + 2] = h[i * 3 + 2] - scratch.z;
    }
    attr.needsUpdate = true;
  });

  return <primitive object={trail} />;
}

function SaturnRing({ inner, outer, map, opacityRef }: { inner: number; outer: number; map: Texture; opacityRef: React.MutableRefObject<number> }) {
  const meshRef = useRef<ThreeMesh>(null);
  const geometry = useMemo(() => {
    const geo = new RingGeometry(inner, outer, 160, 1);
    // Radial UVs: u runs inner→outer rim so the alpha strip maps correctly
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
}: {
  size: number;
  dayTex: Texture;
  nightTex: Texture;
  cloudTex: Texture;
  normalTex: Texture | null;
  specTex: Texture | null;
  spinRef: React.MutableRefObject<{ base: number; clouds: number }>;
  rimOpacityRef: React.MutableRefObject<number>;
}) {
  const baseRef = useRef<ThreeMesh>(null);
  const cloudsRef = useRef<ThreeMesh>(null);
  const rimMatRef = useRef<ShaderMaterial>(null);

  const earthMat = useMemo(() => {
    const m = new MeshStandardMaterial({ map: dayTex, roughness: 0.9, metalness: 0 });
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
  const revealAt: [number, number] = useMemo(
    () => [0.5 + index * 0.02, 0.75],
    [index],
  );

  const mat = useMemo(
    () => new MeshStandardMaterial({ map, roughness: cfg.roughness, metalness: 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map],
  );

  useEffect(
    () => () => {
      mat.dispose();
    },
    [mat],
  );

  useFrame((_state, delta) => {
    const p = progressRef.current;
    const reveal = smoothstep(revealAt[0], revealAt[1], p);
    opacityRef.current = reveal;
    rimOpacityRef.current = 0.8 * reveal;
    if (activeRef.current && !reducedMotion) {
      angleRef.current += orbitSpeed(cfg.orbitR) * delta;
    }
    orbitPos(cfg.orbitR, angleRef.current, scratch);
    if (posRef.current) posRef.current.position.copy(scratch);
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
      <Trail orbitR={cfg.orbitR} angleRef={angleRef} color={cfg.trailColor} progressRef={progressRef} revealAt={revealAt} />
    </group>
  );
}

function LoadingSun() {
  return (
    <mesh>
      <sphereGeometry args={[1, 24, 24]} />
      <meshBasicMaterial color="#223355" wireframe />
    </mesh>
  );
}

export default function SolarSystemVisual({ progress, running = false }: FocusVisualProps) {
  const reducedMotion = useReducedMotion();
  const value = clamp01(progress);
  const complete = value >= 1;
  // Reduced-motion users skip the formation entirely: settled system only.
  const p = reducedMotion ? 1 : value;
  const progressRef = useRef(p);
  progressRef.current = p;
  const activeRef = useRef(running || complete);
  activeRef.current = running || complete;

  const [loop, setLoop] = useState(true);
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

  const ringGuideMat = useMemo(
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
      ringGuideMat.dispose();
    },
    [ringGuideMat],
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
        <BackgroundStars progress={p} reducedMotion={reducedMotion} />
        <Nebula progressRef={progressRef} activeRef={activeRef} />
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
            <OrbitGuides progressRef={progressRef} material={ringGuideMat} />
            <CameraRig progressRef={progressRef} />
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
    </div>
  );
}

/** Faint orbit-ring guides that fade in as planets coalesce. */
function OrbitGuides({
  progressRef,
  material,
}: {
  progressRef: React.MutableRefObject<number>;
  material: MeshBasicMaterial;
}) {
  useFrame(() => {
    material.opacity = 0.32 * smoothstep(0.5, 0.68, progressRef.current);
  });
  return (
    <>
      {PLANETS.map((cfg) => (
        <mesh key={cfg.key} rotation={[-Math.PI / 2, 0, 0]} material={material}>
          <ringGeometry args={[cfg.orbitR - 0.012, cfg.orbitR + 0.012, 160]} />
        </mesh>
      ))}
    </>
  );
}

/** Camera eases to its final framing (subtle zoom-out) at 95–100%. */
function CameraRig({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const base = useMemo(() => new Vector3(0, 8.5, 13), []);
  const final = useMemo(() => new Vector3(0, 10, 15.5), []);
  const target = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    const k = smoothstep(0.95, 1, progressRef.current);
    target.lerpVectors(base, final, k);
    camera.position.copy(target);
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
);
