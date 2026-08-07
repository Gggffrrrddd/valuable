import { useEffect, useRef, useState } from 'react';
import { sampleLionConstellation, type LionConstellationPoint } from './constellation/sampling';
import type { FocusVisualProps } from './types';

interface ButterflyMosaicProps extends FocusVisualProps {
  duration: number;
}

const TARGET_POINTS_DESKTOP = 3000;
const TARGET_POINTS_MOBILE = 1800;
const TARGET_POINTS_PREVIEW = 360;
const ARRIVAL_MS = 520;
const ROTATION_SECONDS = 90;
const ADAPTIVE_TUNE_IN_FRAMES = 90;
const ADAPTIVE_FPS_THRESHOLD = 40;
const POINT_RADIUS = .55;

const PALETTE: Array<{ r: number; g: number; b: number }> = [
  { r: 0x08, g: 0x11, b: 0x1f },
  { r: 0x0a, g: 0x1f, b: 0x45 },
  { r: 0x0d, g: 0x3f, b: 0x8f },
  { r: 0x14, g: 0x6b, b: 0xff },
  { r: 0x2f, g: 0x8c, b: 0xff },
  { r: 0x59, g: 0xb5, b: 0xff },
  { r: 0x8a, g: 0xd7, b: 0xff },
  { r: 0xc8, g: 0xf1, b: 0xff },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function backOut(value: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
}

function samplePalette(t: number) {
  const clamped = clamp01(t) * (PALETTE.length - 1);
  const lower = Math.floor(clamped);
  const upper = Math.min(PALETTE.length - 1, lower + 1);
  const mix = clamped - lower;
  const a = PALETTE[lower];
  const b = PALETTE[upper];
  return {
    r: Math.round(a.r + (b.r - a.r) * mix),
    g: Math.round(a.g + (b.g - a.g) * mix),
    b: Math.round(a.b + (b.b - a.b) * mix),
  };
}

function rgbToRgba(color: { r: number; g: number; b: number }, alpha: number) {
  return `rgba(${color.r},${color.g},${color.b},${alpha.toFixed(3)})`;
}

function sampleColorRgba(t: number, alpha: number) {
  return rgbToRgba(samplePalette(t), alpha);
}

function sampleEdgeColorRgba(t: number, alpha: number) {
  const c = samplePalette(t);
  return rgbToRgba({ r: Math.round(c.r * .34), g: Math.round(c.g * .52), b: Math.round(c.b * .78) }, alpha);
}

function createGlowStamp(size: number, t: number) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const half = size / 2;
  const center = sampleColorRgba(t, 1);
  const edge = sampleEdgeColorRgba(t, .42);
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, center);
  gradient.addColorStop(.22, center);
  gradient.addColorStop(.55, edge);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return canvas;
}

function createStarStamp(size: number, t: number) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const half = size / 2;
  const inner = sampleColorRgba(Math.min(1, t + .08), 1);
  const flareColor = sampleColorRgba(t, .82);
  const gradient = context.createRadialGradient(half, half, 0, half, half, half * .42);
  gradient.addColorStop(0, 'rgba(255,255,255,.95)');
  gradient.addColorStop(.45, inner);
  gradient.addColorStop(1, 'rgba(126,200,255,0)');
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(half, half, half * .42, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = 'lighter';
  context.strokeStyle = flareColor;
  context.lineWidth = Math.max(.6, size * .012);
  context.lineCap = 'round';
  const flare = half * 1.4;
  context.beginPath();
  context.moveTo(half, half - flare * .18);
  context.lineTo(half, half - flare);
  context.moveTo(half, half + flare * .18);
  context.lineTo(half, half + flare);
  context.moveTo(half - flare * .18, half);
  context.lineTo(half - flare, half);
  context.moveTo(half + flare * .18, half);
  context.lineTo(half + flare, half);
  context.stroke();
  return canvas;
}

function pickStyle(): 'stars' | 'fireflies' {
  return Math.random() < .5 ? 'stars' : 'fireflies';
}

function pointShade(point: LionConstellationPoint, projectedDepth: number, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const frontAxis = Math.max(0, -point.position.x * cos + point.position.z * sin);
  const topAxis = clamp01((point.position.y + 1.5) / 3);
  const sideRim = clamp01(1 - Math.abs(point.position.x) / 1.05);
  const depthAxis = clamp01((projectedDepth + 1) / 2);
  const baseShade = clamp01(
    frontAxis * .42 +
    topAxis * .3 +
    sideRim * .18 +
    (1 - depthAxis) * .1 +
    .18,
  );
  const jitter = (point.id * 9301 + 49297) % 233280 / 233280 - .5;
  return clamp01(baseShade + jitter * .1);
}

export default function ButterflyMosaicVisual({ progress, duration }: ButterflyMosaicProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(clamp01(progress));
  const reducedMotion = useReducedMotion();
  const complete = progress >= 1;

  progressRef.current = clamp01(progress);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    let cancelled = false;
    let frame = 0;
    let points: LionConstellationPoint[] = [];
    let revealedAt = new Float64Array(0);
    let width = 1;
    let height = 1;
    let dpr = 1;
    let startTime = performance.now();
    let lastDrawTime = 0;
    const activeSession = duration > 0;
    const isMobile = window.innerWidth < 700;
    const baseTarget = activeSession ? (isMobile ? TARGET_POINTS_MOBILE : TARGET_POINTS_DESKTOP) : TARGET_POINTS_PREVIEW;
    const style = pickStyle();
    const paletteStamp = (shade: number) =>
      style === 'stars' ? createStarStamp(40, shade) : createGlowStamp(48, shade);
    let drawStride = 1;
    let strideLocked = false;
    const frameTimings: number[] = [];
    let adaptiveFrame = 0;
    let twinkleSlice = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    sampleLionConstellation(baseTarget, activeSession ? 9137 : 4289).then((sampled) => {
      if (cancelled) return;
      points = sampled;
      revealedAt = new Float64Array(points.length);
      revealedAt.fill(-1);
      startTime = performance.now();
    });

    const projectPoint = (point: LionConstellationPoint, angle: number) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x = point.position.x * cos + point.position.z * sin;
      const zz = -point.position.x * sin + point.position.z * cos;
      const perspective = 1 / (2.65 - zz * .45);
      const sceneScale = Math.min(width * .94, height * 1.12);
      return {
        x: width * .47 + x * perspective * sceneScale,
        y: height * .5 - point.position.y * perspective * sceneScale,
        z: zz,
        scale: .76 + perspective * 1.05,
      };
    };

    const draw = (now: number) => {
      const begin = performance.now();
      frame = requestAnimationFrame(draw);
      if (points.length === 0) return;

      const value = progressRef.current;
      const expected = value >= 1 ? points.length : Math.floor(value * points.length);
      for (const point of points) {
        if (point.revealRank < expected && revealedAt[point.id] < 0) {
          revealedAt[point.id] = value >= 1 ? now - ARRIVAL_MS : now;
        }
      }

      if (now - lastDrawTime < 1000 / 45) return;
      lastDrawTime = now;

      context.clearRect(0, 0, width, height);
      const angle = reducedMotion ? -.08 : -.08 + (now - startTime) / 1000 * Math.PI * 2 / ROTATION_SECONDS;
      twinkleSlice = (twinkleSlice + 1) % 4;

      const stride = drawStride;
      let index = 0;
      for (const point of points) {
        if (revealedAt[point.id] < 0) continue;
        if (stride > 1 && (index++ % stride !== 0)) continue;

        const projected = projectPoint(point, angle);
        const shade = pointShade(point, projected.z, angle);
        const age = now - revealedAt[point.id];
        const arrival = reducedMotion ? clamp01(age / 260) : clamp01(age / ARRIVAL_MS);
        const settled = age >= ARRIVAL_MS || reducedMotion;
        const pop = reducedMotion ? arrival : backOut(arrival);
        const sliceBucket = (Math.floor(point.id / 7) % 4);
        const twinkleFactor = sliceBucket === twinkleSlice ? 1 : .15;
        const twinkle = reducedMotion
          ? 0
          : Math.sin(now * point.twinkleSpeed + point.twinklePhase) * .04 * twinkleFactor;
        const depth = clamp01((projected.z + 1) / 2);
        const radius = POINT_RADIUS * (1 + depth * .55) * projected.scale * pop;
        const baseAlpha = reducedMotion ? arrival : .74 + depth * .18 + twinkle;
        const alpha = baseAlpha * Math.min(1, pop);
        const ignition = settled ? 0 : 1 - arrival;
        const core = sampleColorRgba(shade, 1);
        const edge = sampleEdgeColorRgba(shade, .36);
        const halo = sampleColorRgba(shade, .5);
        const radiusBoost = 1 + depth * .55 + (shade - .5) * .35;
        const stampScale = radius * radiusBoost * (settled ? 5.4 : 6.8 + ignition * 4);
        const stampAlpha = Math.max(0, Math.min(1, alpha * (.55 + ignition * .28)));

        context.globalAlpha = stampAlpha;
        context.drawImage(paletteStamp(shade), projected.x - stampScale / 2, projected.y - stampScale / 2, stampScale, stampScale);

        if (!reducedMotion) {
          context.globalAlpha = Math.max(0, Math.min(1, alpha * (.85 + shade * .15)));
          context.beginPath();
          context.arc(projected.x, projected.y, Math.max(.3, radius * (.9 + shade * .15)), 0, Math.PI * 2);
          context.fillStyle = core;
          context.fill();
          if (shade > .62) {
            context.globalAlpha = Math.max(0, Math.min(1, alpha * .18 * (shade - .6)));
            const glow = radius * (3.6 + shade * 2.6);
            const haloGradient = context.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, glow);
            haloGradient.addColorStop(0, halo);
            haloGradient.addColorStop(1, edge);
            context.fillStyle = haloGradient;
            context.beginPath();
            context.arc(projected.x, projected.y, glow, 0, Math.PI * 2);
            context.fill();
          }
          if (!settled) {
            const ripple = radius * (1 + arrival * 3.4);
            context.globalAlpha = (1 - arrival) * .3 * (.6 + shade);
            context.beginPath();
            context.arc(projected.x, projected.y, ripple, 0, Math.PI * 2);
            context.strokeStyle = sampleColorRgba(Math.min(1, shade + .15), .85);
            context.lineWidth = Math.max(.35, .9 - arrival * .5);
            context.stroke();
          }
        }
      }
      context.globalAlpha = 1;

      if (!cancelled) {
        adaptiveFrame += 1;
        const elapsed = performance.now() - begin;
        frameTimings.push(elapsed);
        if (frameTimings.length > 30) frameTimings.shift();
        if (!strideLocked && activeSession && !reducedMotion && adaptiveFrame >= ADAPTIVE_TUNE_IN_FRAMES) {
          const avg = frameTimings.reduce((sum, value) => sum + value, 0) / frameTimings.length;
          const fps = avg > 0 ? 1000 / avg : 60;
          if (fps < ADAPTIVE_FPS_THRESHOLD) {
            drawStride = Math.min(8, drawStride === 1 ? 2 : drawStride * 2);
            strideLocked = true;
          } else if (fps >= 56 && drawStride === 1) {
            strideLocked = true;
          } else if (adaptiveFrame > ADAPTIVE_TUNE_IN_FRAMES + 40) {
            strideLocked = true;
          }
        }
      }
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [duration, reducedMotion]);

  return (
    <div className={`lion-constellation focus-visual ${complete ? 'visual-complete' : ''}`} role="img" aria-label={`Lion constellation ${Math.round(progress * 100)} percent complete`}>
      <div className="lion-constellation__architecture" aria-hidden="true" />
      <div className="lion-constellation__beam" aria-hidden="true" />
      <canvas ref={canvasRef} className="lion-constellation__canvas" aria-hidden="true" />
      <div className="lion-constellation__completion visual-finish-glow" aria-hidden="true" />
    </div>
  );
}
