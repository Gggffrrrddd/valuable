import { useEffect, useRef, useState } from 'react';
import type { FocusVisualProps } from './types';

const CROP = { left: 500, top: 36, width: 570, height: 870 };

interface Grain {
  x: number;
  y: number;
  size: number;
  shade: number;
  alpha: number;
}

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function createGrains(count: number) {
  const random = seededRandom(74291);
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    size: .8 + random() * 1.35,
    shade: random(),
    alpha: .55 + random() * .42,
  }));
}

export default function HourglassVisual({ progress }: FocusVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const redrawRef = useRef<(() => void) | null>(null);
  const progressRef = useRef(progress);
  const [shellLoaded, setShellLoaded] = useState(false);
  const complete = progress >= 1;

  progressRef.current = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const lowEnd = (navigator.hardwareConcurrency || 4) <= 4;
    const staticPreview = canvas.closest('button') !== null;
    const grains = createGrains(lowEnd ? 80 : 210);
    const stream = createGrains(lowEnd ? 3 : 5);
    let visible = document.visibilityState === 'visible';
    let resizeObserver: ResizeObserver | null = null;

    function draw(timestamp = 0) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const context = canvas.getContext('2d');
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);

      const sx = rect.width / CROP.width;
      const sy = rect.height / CROP.height;
      const mapX = (sourceX: number) => (sourceX - CROP.left) * sx;
      const mapY = (sourceY: number) => (sourceY - CROP.top) * sy;
      const value = reducedMotion.matches ? Math.floor(progressRef.current * 20) / 20 : progressRef.current;

      drawTopSand(context, grains, value, mapX, mapY, sx, sy, timestamp);
      drawBottomSand(context, grains, value, mapX, mapY, sx, sy, timestamp);
      if (!reducedMotion.matches && value > 0 && value < 1) {
        drawStream(context, stream, mapX, mapY, sx, sy, timestamp);
      }
    }

    function animate(timestamp: number) {
      draw(timestamp);
      if (visible && !staticPreview && !reducedMotion.matches && progressRef.current < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        frameRef.current = null;
      }
    }

    function start() {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (visible && !staticPreview && !reducedMotion.matches && progressRef.current < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        draw();
      }
    }

    redrawRef.current = start;

    function handleVisibility() {
      visible = document.visibilityState === 'visible';
      if (!visible && frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      } else if (visible) {
        start();
      }
    }

    resizeObserver = new ResizeObserver(start);
    resizeObserver.observe(canvas);
    document.addEventListener('visibilitychange', handleVisibility);
    reducedMotion.addEventListener('change', start);
    start();

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      redrawRef.current = null;
      resizeObserver?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      reducedMotion.removeEventListener('change', start);
    };
  }, []);

  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    redrawRef.current?.();
  }, [progress]);

  return (
    <div className={`hybrid-hourglass ${complete ? 'hybrid-hourglass-complete' : ''}`} role="img" aria-label={`Hourglass ${Math.round(progress * 100)} percent complete`}>
      <div className="hourglass-ambient" />
      <canvas ref={canvasRef} className="hourglass-sand-canvas" aria-hidden="true" />
      <img
        src="/visuals/hourglass/hourglass-shell.png"
        alt=""
        aria-hidden="true"
        className={`hourglass-shell ${shellLoaded ? 'hourglass-shell-loaded' : ''}`}
        onLoad={() => setShellLoaded(true)}
      />
      <img src="/visuals/hourglass/hourglass-glow.png" alt="" aria-hidden="true" className="hourglass-glow-overlay" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
    </div>
  );
}

type CoordinateMap = (value: number) => number;

function grainColor(grain: Grain, highlight = 0) {
  const mix = grain.shade + highlight;
  if (mix > 1.05) return `rgba(245,255,220,${grain.alpha})`;
  if (mix > .58) return `rgba(207,255,113,${grain.alpha})`;
  return `rgba(168,226,59,${grain.alpha})`;
}

function drawTopSand(context: CanvasRenderingContext2D, grains: Grain[], progress: number, mapX: CoordinateMap, mapY: CoordinateMap, sx: number, sy: number, timestamp: number) {
  const top = 192;
  const neck = 420;
  const surface = top + (neck - top) * progress;
  const remaining = 1 - progress;
  context.save();
  context.beginPath();
  context.moveTo(mapX(656), mapY(178));
  context.bezierCurveTo(mapX(655), mapY(280), mapX(742), mapY(372), mapX(782), mapY(420));
  context.bezierCurveTo(mapX(824), mapY(372), mapX(913), mapY(280), mapX(912), mapY(178));
  context.closePath();
  context.clip();

  const shimmer = Math.sin(timestamp / 1500) * .08;
  const count = Math.floor(grains.length * remaining * .52);
  for (let index = 0; index < count; index++) {
    const grain = grains[index];
    const y = surface + grain.y * Math.max(1, neck - surface);
    const normalizedY = (y - top) / (neck - top);
    const halfWidth = 128 * (1 - normalizedY) + 7;
    const x = 784 + (grain.x * 2 - 1) * halfWidth * .86;
    const highlight = Math.max(0, 1 - Math.hypot((x - 745) / 90, (y - surface) / 80)) * .45 + shimmer;
    context.beginPath();
    context.fillStyle = grainColor(grain, highlight);
    context.arc(mapX(x), mapY(y), grain.size * Math.min(sx, sy), 0, Math.PI * 2);
    context.fill();
  }
  drawSandHighlight(context, mapX(784), mapY(surface), Math.max(8, 105 * remaining) * sx, 12 * sy);
  context.restore();
}

function drawBottomSand(context: CanvasRenderingContext2D, grains: Grain[], progress: number, mapX: CoordinateMap, mapY: CoordinateMap, sx: number, sy: number, timestamp: number) {
  if (progress <= 0) return;
  const base = 714;
  const moundTop = base - 230 * progress;
  const count = Math.floor(grains.length * progress * .48);
  const shimmer = Math.sin(timestamp / 1700 + 1.2) * .08;
  context.save();
  context.beginPath();
  context.moveTo(mapX(782), mapY(437));
  context.bezierCurveTo(mapX(733), mapY(500), mapX(651), mapY(595), mapX(650), mapY(710));
  context.lineTo(mapX(918), mapY(710));
  context.bezierCurveTo(mapX(915), mapY(595), mapX(833), mapY(500), mapX(786), mapY(437));
  context.closePath();
  context.clip();

  for (let index = 0; index < count; index++) {
    const grain = grains[grains.length - 1 - index];
    const layer = Math.sqrt(grain.y);
    const y = moundTop + layer * (base - moundTop) + Math.sin(grain.x * 19) * 3;
    const normalizedY = (y - moundTop) / Math.max(1, base - moundTop);
    const radius = 8 + normalizedY * Math.min(126, 35 + progress * 100);
    const naturalOffset = (grain.x * 2 - 1) * radius * (.8 + grain.shade * .18);
    const x = 784 + naturalOffset;
    const highlight = Math.max(0, 1 - Math.hypot((x - 748) / 100, (y - moundTop) / 90)) * .4 + shimmer;
    context.beginPath();
    context.fillStyle = grainColor(grain, highlight);
    context.arc(mapX(x), mapY(y), grain.size * Math.min(sx, sy), 0, Math.PI * 2);
    context.fill();
  }
  drawSandHighlight(context, mapX(784), mapY(moundTop + 5), (15 + progress * 92) * sx, 11 * sy);
  context.restore();
}

function drawStream(context: CanvasRenderingContext2D, grains: Grain[], mapX: CoordinateMap, mapY: CoordinateMap, sx: number, sy: number, timestamp: number) {
  const streamTop = 414;
  const streamBottom = 492;
  grains.forEach((grain, index) => {
    const cycle = ((timestamp / 620) + index / grains.length + grain.y * .2) % 1;
    const y = streamTop + cycle * (streamBottom - streamTop);
    const x = 784 + Math.sin(timestamp / 130 + index * 2.7) * 2.2;
    context.beginPath();
    context.fillStyle = grainColor(grain, .35);
    context.arc(mapX(x), mapY(y), Math.max(1.1, grain.size) * Math.min(sx, sy), 0, Math.PI * 2);
    context.fill();
  });
}

function drawSandHighlight(context: CanvasRenderingContext2D, x: number, y: number, radiusX: number, radiusY: number) {
  if (radiusX <= 0 || radiusY <= 0) return;
  context.save();
  context.translate(x, y);
  context.scale(1, radiusY / radiusX);
  const gradient = context.createRadialGradient(-radiusX * .25, -radiusX * .08, 0, 0, 0, radiusX);
  gradient.addColorStop(0, 'rgba(250,255,233,.3)');
  gradient.addColorStop(.45, 'rgba(197,255,84,.12)');
  gradient.addColorStop(1, 'rgba(197,255,84,0)');
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radiusX, 0, Math.PI * 2);
  context.fill();
  context.restore();
}
