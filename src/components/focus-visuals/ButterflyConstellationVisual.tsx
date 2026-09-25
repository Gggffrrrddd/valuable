import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import type { FocusVisualProps } from './types';
import { useReducedMotion } from './model-core';

/**
 * Butterfly Constellation — a scripted, one-time 2D canvas narrative that
 * plays when the session completes (progress reaches 1), following the
 * JarVisual alpha-mask pattern instead of mesh sampling:
 *
 * 1 scatter (idle twinkle) -> 2 boundary convergence -> 3 left wing ->
 * 4 right wing -> 5 upper/lower detail -> 6 core -> settle/twinkle ->
 * 7 name reveal (glow-stroke text) -> 8 final dolly-out hold.
 *
 * Star positions come from the alpha channel of the silhouette PNG; drop a
 * real silhouette at the same path to reshape the constellation. A
 * procedural fallback (same geometry as the placeholder generator) keeps the
 * visual alive if the mask is missing.
 */

const SILHOUETTE_URL = '/visuals/butterfly/butterfly-silhouette.png';
const STAR_COUNT = 320;
const KEY_STAR_SHARE = 0.18;
const SEQUENCE_MS = 9500;
const MASK_SIZE = 220;
const MASK_ALPHA_THRESHOLD = 40;
const MASK_STEP = 5;

const WIN_BOUNDARY: [number, number] = [0.0, 0.18];
const WIN_LEFT: [number, number] = [0.18, 0.38];
const WIN_RIGHT: [number, number] = [0.38, 0.56];
const WIN_DETAIL: [number, number] = [0.56, 0.74];
const WIN_CORE: [number, number] = [0.74, 0.88];

interface MaskSample {
  x: number;
  y: number;
  edge: boolean;
}

interface Star {
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  start: number;
  end: number;
  size: number;
  twinkleSpeed: number;
  twinklePhase: number;
  key: boolean;
  cool: boolean;
  trail: { x: number; y: number }[];
  moving: boolean;
}

interface NameLayout {
  lines: string[];
  fontPx: number;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function classifyWindow(x: number, y: number, edge: boolean): [number, number] {
  if (Math.abs(x - 0.5) <= 0.075) return WIN_CORE;
  if (edge) return WIN_BOUNDARY;
  if (y < 0.36 || y > 0.64) return WIN_DETAIL;
  return x < 0.5 ? WIN_LEFT : WIN_RIGHT;
}

/* Fallback geometry — mirrors scripts/generate-butterfly-placeholders.mjs. */
const FALLBACK_SIZE = 480;
const FALLBACK_WINGS = [
  { cx: 145, cy: 170, rx: 110, ry: 85, rot: -0.44 },
  { cx: 335, cy: 170, rx: 110, ry: 85, rot: 0.44 },
  { cx: 170, cy: 305, rx: 82, ry: 66, rot: 0.35 },
  { cx: 310, cy: 305, rx: 82, ry: 66, rot: -0.35 },
];
const FALLBACK_BODY = { cx: 240, top: 130, bottom: 350, half: 13 };
const FALLBACK_ANTENNAE = [
  { x1: 232, y1: 140, x2: 200, y2: 85 },
  { x1: 248, y1: 140, x2: 280, y2: 85 },
];

function distToSegment(px: number, py: number, s: { x1: number; y1: number; x2: number; y2: number }): number {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const t = Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (s.x1 + dx * t), py - (s.y1 + dy * t));
}

function insideFallback(px: number, py: number): boolean {
  if (Math.abs(px - FALLBACK_BODY.cx) <= FALLBACK_BODY.half && py >= FALLBACK_BODY.top && py <= FALLBACK_BODY.bottom) return true;
  for (const a of FALLBACK_ANTENNAE) if (distToSegment(px, py, a) <= 4) return true;
  for (const w of FALLBACK_WINGS) {
    const cos = Math.cos(-w.rot);
    const sin = Math.sin(-w.rot);
    const dx = px - w.cx;
    const dy = py - w.cy;
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    if ((lx / w.rx) ** 2 + (ly / w.ry) ** 2 <= 1) return true;
  }
  return false;
}

function proceduralSamples(): MaskSample[] {
  const samples: MaskSample[] = [];
  const step = 7;
  for (let y = 0; y < FALLBACK_SIZE; y += step) {
    for (let x = 0; x < FALLBACK_SIZE; x += step) {
      if (!insideFallback(x, y)) continue;
      const edge =
        !insideFallback(x + step, y) || !insideFallback(x - step, y) ||
        !insideFallback(x, y + step) || !insideFallback(x, y - step);
      samples.push({ x: x / FALLBACK_SIZE, y: y / FALLBACK_SIZE, edge });
    }
  }
  return samples;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`missing ${url}`));
    img.src = url;
  });
}

async function sampleSilhouette(): Promise<MaskSample[] | null> {
  try {
    const img = await loadImage(SILHOUETTE_URL);
    const canvas = document.createElement('canvas');
    canvas.width = MASK_SIZE;
    canvas.height = MASK_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, MASK_SIZE, MASK_SIZE);
    const { data } = ctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
    const inside = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < MASK_SIZE && y < MASK_SIZE &&
      data[(y * MASK_SIZE + x) * 4 + 3] > MASK_ALPHA_THRESHOLD;
    const samples: MaskSample[] = [];
    for (let y = 0; y < MASK_SIZE; y += MASK_STEP) {
      for (let x = 0; x < MASK_SIZE; x += MASK_STEP) {
        if (!inside(x, y)) continue;
        const edge =
          !inside(x + MASK_STEP, y) || !inside(x - MASK_STEP, y) ||
          !inside(x, y + MASK_STEP) || !inside(x, y - MASK_STEP);
        samples.push({ x: x / MASK_SIZE, y: y / MASK_SIZE, edge });
      }
    }
    return samples.length > 40 ? samples : null;
  } catch {
    return null;
  }
}

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildStars(samples: MaskSample[]): Star[] {
  const edges = shuffle(samples.filter((s) => s.edge));
  const inner = shuffle(samples.filter((s) => !s.edge));
  const edgeTake = Math.min(edges.length, Math.round(STAR_COUNT * 0.42));
  const chosen = [...edges.slice(0, edgeTake), ...inner.slice(0, STAR_COUNT - edgeTake)];

  return chosen.map((s) => {
    const [p0, p1] = classifyWindow(s.x, s.y, s.edge);
    const span = p1 - p0;
    const start = p0 + span * Math.random() * 0.55;
    const end = Math.min(p1, start + span * (0.3 + Math.random() * 0.18));
    return {
      tx: s.x,
      ty: s.y,
      sx: Math.random(),
      sy: Math.random(),
      start,
      end,
      size: 1.3 + Math.random() * 1.4,
      twinkleSpeed: 1.5 + Math.random() * 2.5,
      twinklePhase: Math.random() * Math.PI * 2,
      key: Math.random() < KEY_STAR_SHARE,
      cool: Math.random() < 0.72,
      trail: [],
      moving: false,
    };
  });
}

function makeSprite(radius: number, core: string, glow: string): HTMLCanvasElement {
  const size = radius * 4;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, core);
    grad.addColorStop(0.32, glow);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  return canvas;
}

function splitName(name: string): string[] {
  if (name.includes(' ')) {
    const words = name.split(' ');
    let best: string[] = [name];
    let bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      const diff = Math.abs(a.length - b.length);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = [a, b];
      }
    }
    return best;
  }
  const mid = Math.ceil(name.length / 2);
  return [name.slice(0, mid), name.slice(mid)];
}

function layoutName(name: string, maxW: number, ctx: CanvasRenderingContext2D): NameLayout {
  const clean = name.replace(/[^A-Za-z -]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28) || 'You';
  const base = 58;
  const fits = (lines: string[], size: number) => {
    ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
    return lines.every((line) => ctx.measureText(line).width <= maxW);
  };
  // Single line first: shrink toward the floor for names up to ~14 chars.
  for (let size = base; size >= base * 0.5; size -= 2) {
    if (fits([clean], size)) return { lines: [clean], fontPx: size };
  }
  // Still too wide: wrap to two centered lines, never truncate.
  const lines = splitName(clean);
  for (let size = base * 0.72; size >= base * 0.34; size -= 2) {
    if (fits(lines, size)) return { lines, fontPx: size };
  }
  return { lines, fontPx: base * 0.34 };
}

export default function ButterflyConstellationVisual({ progress }: FocusVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(progress);
  const reducedMotion = useReducedMotion();
  const reducedRef = useRef(reducedMotion);
  const nameRef = useRef('You');
  const { profile } = useAuth();

  progressRef.current = progress;
  reducedRef.current = reducedMotion;

  useEffect(() => {
    nameRef.current = profile?.display_name || 'You';
  }, [profile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let disposed = false;
    let raf = 0;
    const starsRef: { current: Star[] } = { current: [] };
    const readyRef: { current: boolean } = { current: false };
    const startedAtRef: { current: number | null } = { current: null };
    const layoutRef: { current: NameLayout | null } = { current: null };
    const layoutKeyRef: { current: string } = { current: '' };

    void sampleSilhouette().then((samples) => {
      if (disposed) return;
      starsRef.current = buildStars(samples ?? proceduralSamples());
      readyRef.current = true;
    });

    const normalSprite = makeSprite(7, 'rgba(255,255,255,.95)', 'rgba(168,196,255,.5)');
    const keySprite = makeSprite(10, 'rgba(255,255,255,1)', 'rgba(214,226,255,.6)');
    const dotSprite = makeSprite(4, 'rgba(255,255,255,.9)', 'rgba(190,210,255,.45)');

    const drawStar = (sprite: HTMLCanvasElement, x: number, y: number, px: number, alpha: number) => {
      if (alpha <= 0.01) return;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.drawImage(sprite, x - px / 2, y - px / 2, px, px);
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!readyRef.current || starsRef.current.length === 0) return;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        layoutRef.current = null;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const reduced = reducedRef.current;
      if (!startedAtRef.current && progressRef.current >= 0.999) {
        startedAtRef.current = now;
      }
      const startedAt = startedAtRef.current;
      const started = startedAt !== null;
      const seqT = started ? Math.min(1, (now - startedAt) / SEQUENCE_MS) : 0;
      const timeSec = now / 1000;

      // Slow dolly-out across the formation phases (2-5); reduced motion
      // jumps straight to the settled frame.
      const zoom = started && !reduced ? 1.55 - 0.55 * easeInOutCubic(Math.min(1, seqT / 0.88)) : 1;

      const reveal = reduced ? 1 : started ? Math.max(0, Math.min(1, (seqT - 0.9) / 0.1)) : 0;
      const textAlpha = reduced ? 1 : started ? Math.max(0, Math.min(1, (seqT - 0.94) / 0.055)) : 0;

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-w / 2, -h / 2);

      const dim = 1 - 0.22 * reveal;
      for (const star of starsRef.current) {
        let px: number;
        let py: number;
        let alpha: number;
        let moving = false;

        if (reduced) {
          px = star.tx * w;
          py = star.ty * h;
          alpha = (star.key ? 0.95 : 0.6) + 0.25 * Math.sin(timeSec * star.twinkleSpeed + star.twinklePhase);
        } else if (!started || seqT < star.start) {
          px = (star.sx + Math.sin(timeSec * 0.7 + star.twinklePhase) * 0.006) * w;
          py = (star.sy + Math.cos(timeSec * 0.6 + star.twinklePhase * 1.7) * 0.006) * h;
          alpha = (started ? 0.35 : 0.45) + 0.3 * (0.5 + 0.5 * Math.sin(timeSec * star.twinkleSpeed + star.twinklePhase));
        } else if (seqT >= star.end) {
          px = star.tx * w;
          py = star.ty * h;
          alpha = (star.key ? 0.9 : 0.55) + 0.28 * Math.sin(timeSec * star.twinkleSpeed + star.twinklePhase);
          star.moving = false;
        } else {
          const u = easeInOutCubic((seqT - star.start) / (star.end - star.start));
          px = (star.sx + (star.tx - star.sx) * u) * w;
          py = (star.sy + (star.ty - star.sy) * u) * h;
          alpha = 0.6 + 0.3 * u;
          moving = true;
          star.moving = true;
        }

        if (moving) {
          star.trail.push({ x: px, y: py });
          if (star.trail.length > 6) star.trail.shift();
          for (let i = 0; i < star.trail.length; i++) {
            const t = star.trail[i];
            drawStar(dotSprite, t.x, t.y, star.size * 3.2, alpha * 0.16 * (i / star.trail.length));
          }
        } else if (star.trail.length > 0) {
          star.trail.length = 0;
        }

        const sprite = star.key ? keySprite : normalSprite;
        const drawSize = star.size * (star.key ? 7 : 4.6) * (moving ? 1.18 : 1);
        drawStar(sprite, px, py, drawSize, alpha * dim);
      }

      // Name reveal: gather particles at center, then resolve into glow text.
      if (started || reduced) {
        if (!layoutRef.current || layoutKeyRef.current !== `${w}x${h}:${nameRef.current}`) {
          layoutRef.current = layoutName(nameRef.current, w * 0.66, ctx);
          layoutKeyRef.current = `${w}x${h}:${nameRef.current}`;
        }
        const layout = layoutRef.current;
        ctx.font = `700 ${layout.fontPx}px Georgia, "Times New Roman", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (reveal > 0 && reveal < 1 && !reduced) {
          // Particles converge from a loose ring onto the text block.
          const gather = Math.min(1, reveal / 0.6);
          const count = 44;
          for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const ringR = Math.min(w, h) * 0.34 * (1 - gather * 0.82);
            const gx = w / 2 + Math.cos(angle) * ringR + Math.sin(i * 12.9898) * w * 0.04 * (1 - gather);
            const gy = h / 2 + Math.sin(angle) * ringR * 0.7 + Math.cos(i * 78.233) * h * 0.03 * (1 - gather);
            drawStar(dotSprite, gx, gy, 7, 0.5 * (1 - reveal * 0.7));
          }
        }

        if (textAlpha > 0) {
          const lineH = layout.fontPx * 1.18;
          const startY = h / 2 - ((layout.lines.length - 1) * lineH) / 2;
          ctx.globalAlpha = textAlpha * 0.9;
          ctx.shadowColor = 'rgba(168, 196, 255, .8)';
          ctx.shadowBlur = layout.fontPx * 0.42;
          ctx.fillStyle = 'rgba(214, 229, 255, .92)';
          layout.lines.forEach((line, i) => ctx.fillText(line, w / 2, startY + i * lineH));
          ctx.globalAlpha = textAlpha;
          ctx.shadowBlur = layout.fontPx * 0.12;
          ctx.fillStyle = '#ffffff';
          layout.lines.forEach((line, i) => ctx.fillText(line, w / 2, startY + i * lineH));
          ctx.shadowBlur = 0;
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    };

    raf = requestAnimationFrame(loop);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="butterfly-constellation focus-visual" role="img" aria-label="Butterfly constellation">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
