import { useEffect, useRef, useState } from 'react';
import { sampleLionConstellation, type LionConstellationPoint } from './constellation/sampling';
import type { FocusVisualProps } from './types';

interface ButterflyMosaicProps extends FocusVisualProps {
  duration: number;
}

const DESKTOP_POINTS = 360;
const MOBILE_POINTS = 300;
const PREVIEW_POINTS = 96;
const ARRIVAL_MS = 520;
const ROTATION_SECONDS = 90;

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

function createGlowStamp(size: number, center: string, edge: string) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, center);
  gradient.addColorStop(.18, center);
  gradient.addColorStop(.48, edge);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return canvas;
}

function project(point: LionConstellationPoint, angle: number, width: number, height: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = point.position.x * cos + point.position.z * sin;
  const z = -point.position.x * sin + point.position.z * cos;
  const perspective = 1 / (2.65 - z * .45);
  const sceneScale = Math.min(width * .94, height * 1.12);
  return {
    x: width * .47 + x * perspective * sceneScale,
    y: height * .5 - point.position.y * perspective * sceneScale,
    z,
    scale: .76 + perspective * 1.05,
  };
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
    let lastFrame = 0;
    const activeSession = duration > 0;
    const pointCount = activeSession ? (window.innerWidth < 700 ? MOBILE_POINTS : DESKTOP_POINTS) : PREVIEW_POINTS;
    const warmStamp = createGlowStamp(64, 'rgba(255,245,220,1)', 'rgba(230,178,102,.28)');
    const limeStamp = createGlowStamp(64, 'rgba(239,255,205,1)', 'rgba(176,226,91,.24)');

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    sampleLionConstellation(pointCount, activeSession ? 9137 : 4289).then((sampled) => {
      if (cancelled) return;
      points = sampled;
      revealedAt = new Float64Array(pointCount);
      revealedAt.fill(-1);
      startTime = performance.now();
    });

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (points.length === 0) return;
      if (now - lastFrame < 1000 / 45) return;
      lastFrame = now;

      const value = progressRef.current;
      const expected = value >= 1 ? points.length : Math.floor(value * points.length);
      for (const point of points) {
        if (point.revealRank < expected && revealedAt[point.id] < 0) {
          revealedAt[point.id] = value >= 1 ? now - ARRIVAL_MS : now;
        }
      }

      context.clearRect(0, 0, width, height);
      const angle = reducedMotion ? -.08 : -.08 + (now - startTime) / 1000 * Math.PI * 2 / ROTATION_SECONDS;
      const projected = points
        .filter((point) => revealedAt[point.id] >= 0)
        .map((point) => ({ point, ...project(point, angle, width, height) }))
        .sort((a, b) => a.z - b.z);

      for (const item of projected) {
        const age = now - revealedAt[item.point.id];
        const arrival = reducedMotion ? clamp01(age / 260) : clamp01(age / ARRIVAL_MS);
        const settled = age >= ARRIVAL_MS;
        const pop = reducedMotion ? arrival : backOut(arrival);
        const twinkle = reducedMotion ? 0 : Math.sin(now * item.point.twinkleSpeed + item.point.twinklePhase) * .045;
        const depth = clamp01((item.z + 1) / 2);
        const radius = (1.25 + depth * 1.35) * item.scale * pop;
        const alpha = (reducedMotion ? arrival : .66 + depth * .22 + twinkle) * Math.min(1, pop);
        const ignition = settled || reducedMotion ? 0 : 1 - arrival;
        const stamp = item.point.accent > .72 ? limeStamp : warmStamp;
        const glowSize = radius * (settled ? 6.8 : 8.5 + ignition * 4.5);

        context.globalAlpha = Math.max(0, Math.min(1, alpha + ignition * .25));
        context.drawImage(stamp, item.x - glowSize / 2, item.y - glowSize / 2, glowSize, glowSize);
        context.globalAlpha = Math.max(0, Math.min(1, alpha));
        context.beginPath();
        context.arc(item.x, item.y, Math.max(.35, radius), 0, Math.PI * 2);
        context.fillStyle = item.point.accent > .72 ? '#efffcf' : '#ffe9c4';
        context.fill();

        if (!reducedMotion && !settled) {
          const rippleRadius = radius * (1 + arrival * 3.2);
          context.globalAlpha = (1 - arrival) * .34;
          context.beginPath();
          context.arc(item.x, item.y, rippleRadius, 0, Math.PI * 2);
          context.strokeStyle = item.point.accent > .72 ? '#caff69' : '#f4ca89';
          context.lineWidth = Math.max(.45, 1.1 - arrival * .55);
          context.stroke();
        }
      }
      context.globalAlpha = 1;
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
