import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial } from 'three';
import type { SurfacePoint } from './useSurfacePoints';
import { createGlowTexture } from './canvasUtils';

/**
 * Shared constellation renderer: turns surface points sampled from ANY model
 * into twinkling stars that ignite one-by-one as session progress advances.
 * Model-agnostic — it only consumes `SurfacePoint[]`.
 */

export interface ConstellationPointsProps {
  points: SurfacePoint[];
  /** 0..1 session progress — controls how many points are revealed. */
  progress: number;
  /** Base color of the stars. */
  color?: string;
  /** Accent color for the most recently revealed stars. */
  accentColor?: string;
  /** Point size in world units. */
  size?: number;
  /** Pause twinkle animation (reduced motion). */
  staticMode?: boolean;
  /** Global opacity multiplier. */
  opacity?: number;
}

const VERTEX_SHADER = `
  attribute float aRank;
  attribute float aPhase;
  attribute float aSpeed;
  uniform float uProgress;
  uniform float uTime;
  uniform float uTwinkle;
  uniform float uSize;
  varying float vReveal;
  varying float vTwinkle;

  void main() {
    float reveal = smoothstep(aRank - 0.012, aRank + 0.012, uProgress);
    float twinkle = 0.72 + 0.28 * sin(uTime * aSpeed * 6283.0 + aPhase);
    vReveal = reveal;
    vTwinkle = mix(1.0, twinkle, uTwinkle);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float pop = 0.55 + 0.45 * smoothstep(aRank - 0.012, aRank + 0.03, uProgress);
    gl_PointSize = uSize * pop * vTwinkle * (280.0 / max(0.1, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = `
  uniform sampler2D uSprite;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uProgress;
  uniform float uOpacity;
  varying float vReveal;
  varying float vTwinkle;

  void main() {
    if (vReveal <= 0.001) discard;
    vec4 sprite = texture2D(uSprite, gl_PointCoord);
    float fresh = smoothstep(0.0, 0.09, uProgress - (1.0 - vReveal) * 0.0 + uProgress * 0.0);
    vec3 color = mix(uColor, uAccent, clamp(vReveal * vTwinkle - 0.72, 0.0, 1.0) * 3.6);
    gl_FragColor = vec4(color, sprite.a * vReveal * vTwinkle * uOpacity);
  }
`;

export default function ConstellationPoints({
  points,
  progress,
  color = '#9cc8ff',
  accentColor = '#e8f4ff',
  size = 0.045,
  staticMode = false,
  opacity = 1,
}: ConstellationPointsProps) {
  const pointsRef = useRef<Points>(null);
  const progressRef = useRef(progress);
  progressRef.current = Math.max(0, Math.min(1, progress));

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    const ranks = new Float32Array(points.length);
    const phases = new Float32Array(points.length);
    const speeds = new Float32Array(points.length);
    points.forEach((point, index) => {
      positions[index * 3] = point.position.x;
      positions[index * 3 + 1] = point.position.y;
      positions[index * 3 + 2] = point.position.z;
      ranks[index] = point.revealRank / Math.max(1, points.length - 1);
      phases[index] = point.twinklePhase;
      speeds[index] = point.twinkleSpeed;
    });
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    geo.setAttribute('aRank', new BufferAttribute(ranks, 1));
    geo.setAttribute('aPhase', new BufferAttribute(phases, 1));
    geo.setAttribute('aSpeed', new BufferAttribute(speeds, 1));
    return geo;
  }, [points]);

  const spriteTexture = useMemo(() => createGlowTexture('255,255,255', 64), []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uProgress: { value: Math.max(0, Math.min(1, progress)) },
          uTime: { value: 0 },
          uTwinkle: { value: staticMode ? 0 : 1 },
          uSize: { value: size },
          uColor: { value: new Color(color) },
          uAccent: { value: new Color(accentColor) },
          uSprite: { value: spriteTexture },
          uOpacity: { value: opacity },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    // Uniform-only updates happen in useFrame; recreate only for identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spriteTexture],
  );

  useEffect(() => {
    material.uniforms.uSize.value = size;
    (material.uniforms.uColor.value as Color).set(color);
    (material.uniforms.uAccent.value as Color).set(accentColor);
    material.uniforms.uOpacity.value = opacity;
  }, [material, size, color, accentColor, opacity]);

  useEffect(
    () => () => {
      geometry.dispose();
      spriteTexture.dispose();
      material.dispose();
    },
    [geometry, spriteTexture, material],
  );

  useFrame((_state, delta) => {
    material.uniforms.uProgress.value = progressRef.current;
    material.uniforms.uTwinkle.value = staticMode ? 0 : 1;
    if (!staticMode) material.uniforms.uTime.value += delta;
  });

  if (points.length === 0) return null;
  return <points ref={pointsRef} geometry={geometry} material={material} />;
}
