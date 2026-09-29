/**
 * Animated butterflies drawn entirely in code — no image assets, nothing to
 * download or decode. Each palette gets a pair of pre-rendered wing/body
 * textures (built once), then every butterfly is animated by flapping the
 * wings around their root hinge and orienting the body along its heading.
 *
 * Butterflies are the only butterfly implementation in the app — there is no
 * image-based rig.
 */
import { RIG } from './config';

/** Everything the renderer needs to place and animate one butterfly. */
export interface ButterflyRig {
  x: number;
  y: number;
  /** Nominal on-screen width of the whole butterfly, in CSS px. */
  px: number;
  alpha: number;
  heading: number; // radians
  flapPhase: number; // radians
  bank: number; // radians
  isFlipped: boolean;
  glowAlpha: number;
}

interface HexRgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): HexRgb {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return { r: 255, g: 255, b: 255 };
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgba({ r, g, b }: HexRgb, a: number) {
  return `rgba(${r},${g},${b},${a})`;
}

function shade({ r, g, b }: HexRgb, factor: number): HexRgb {
  return {
    r: Math.round(Math.min(255, r * factor)),
    g: Math.round(Math.min(255, g * factor)),
    b: Math.round(Math.min(255, b * factor)),
  };
}

function mix(a: HexRgb, b: HexRgb, t: number): HexRgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

/** Deterministic pseudo-random in [0, 1). */
function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Wing geometry, in texture pixels. The root (hinge) sits at ROOT_X/ROOT_Y and
// the wing extends to the right of it.
const SX = 140;
const SY = 170;
const ROOT_X = 12;
const ROOT_Y = 120;
const WING_W = ROOT_X + Math.ceil(SX * 1.04) + 6;
const WING_H = ROOT_Y * 2;
/** Extents of the drawn wing shape (used to size the whole butterfly). */
const WING_EXTENT_W = SX * 1.04;
const WING_EXTENT_H = SY * 1.2;

const BODY_W = 64;
const BODY_H = 210;

interface WingTexture {
  canvas: HTMLCanvasElement;
  rootX: number;
  rootY: number;
  extentW: number;
  extentH: number;
}

/**
 * Build one wing: a forewing and a hindwing sharing a root, filled with a
 * soft gradient, veined, and spotted.
 */
function buildWing(core: HexRgb, accent: HexRgb): WingTexture {
  const canvas = document.createElement('canvas');
  canvas.width = WING_W;
  canvas.height = WING_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { canvas, rootX: ROOT_X, rootY: ROOT_Y, extentW: WING_EXTENT_W, extentH: WING_EXTENT_H };

  const dark = shade(accent, 0.5);
  const deep = shade(accent, 0.3);

  ctx.save();
  ctx.translate(ROOT_X, ROOT_Y);

  const fore = new Path2D();
  fore.moveTo(0, 0);
  fore.bezierCurveTo(0.1 * SX, -0.52 * SY, 0.62 * SX, -0.6 * SY, 1.0 * SX, -0.28 * SY);
  fore.bezierCurveTo(1.04 * SX, -0.1 * SY, 0.72 * SX, 0.02 * SY, 0.4 * SX, 0.06 * SY);
  fore.bezierCurveTo(0.18 * SX, 0.06 * SY, 0.06 * SX, 0.03 * SY, 0, 0);
  fore.closePath();

  const hind = new Path2D();
  hind.moveTo(0, 0.02 * SY);
  hind.bezierCurveTo(0.28 * SX, 0.1 * SY, 0.74 * SX, 0.16 * SY, 0.82 * SX, 0.44 * SY);
  hind.bezierCurveTo(0.64 * SX, 0.62 * SY, 0.22 * SX, 0.56 * SY, 0.02 * SX, 0.34 * SY);
  hind.closePath();

  // Gradient runs from the root out to the wing tip.
  const grad = ctx.createRadialGradient(0, 0, 4, 0.35 * SX, -0.05 * SY, 1.5 * SX);
  grad.addColorStop(0, rgba(mix(core, accent, 0.25), 0.98));
  grad.addColorStop(0.42, rgba(accent, 0.95));
  grad.addColorStop(0.82, rgba(dark, 0.92));
  grad.addColorStop(1, rgba(deep, 0.88));

  for (const path of [fore, hind]) {
    ctx.save();
    ctx.fillStyle = grad;
    ctx.shadowColor = rgba(accent, 0.55);
    ctx.shadowBlur = 10;
    ctx.fill(path);
    ctx.restore();
  }

  // Veins fanning out from the root.
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = rgba(shade(core, 0.85), 0.28);
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const tx = (0.55 + 0.42 * rand(i + 1)) * SX;
    const ty = (-0.5 + t * 1.0) * SY;
    ctx.quadraticCurveTo(tx * 0.45, ty * 0.4, tx, ty);
    ctx.stroke();
  }
  ctx.restore();

  // Bright edge spots and a soft inner shadow near the root.
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 5; i++) {
    const cx = (0.72 + 0.2 * rand(i * 2.3)) * SX;
    const cy = (-0.34 + 0.62 * (i / 4)) * SY;
    const r = 2.2 + 2.6 * rand(i * 5.1);
    ctx.fillStyle = rgba(core, 0.5);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba(deep, 0.4);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  const shadow = ctx.createLinearGradient(0, 0, 0.35 * SX, 0);
  shadow.addColorStop(0, 'rgba(0,0,0,0.34)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow;
  ctx.fill(fore);
  ctx.fill(hind);
  ctx.restore();

  // Crisp outline.
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = rgba(deep, 0.5);
  ctx.stroke(fore);
  ctx.stroke(hind);

  ctx.restore();
  return { canvas, rootX: ROOT_X, rootY: ROOT_Y, extentW: WING_EXTENT_W, extentH: WING_EXTENT_H };
}

/** Build the body: a tapered abdomen, thorax, head and antennae. */
function buildBody(core: HexRgb, accent: HexRgb, deep: HexRgb): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = BODY_W;
  canvas.height = BODY_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = BODY_W / 2;
  const thoraxY = BODY_H * RIG.thoraxY;

  // Abdomen.
  ctx.save();
  const bodyGrad = ctx.createLinearGradient(0, 0, BODY_W, 0);
  bodyGrad.addColorStop(0, rgba(deep, 0.95));
  bodyGrad.addColorStop(0.45, rgba(shade(core, 0.6), 0.98));
  bodyGrad.addColorStop(1, rgba(deep, 0.95));
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.bezierCurveTo(cx + 16, thoraxY * 0.4, cx + 14, thoraxY, cx + 9, thoraxY * 1.05);
  ctx.bezierCurveTo(cx + 8, BODY_H * 0.82, cx + 4, BODY_H * 0.97, cx, BODY_H);
  ctx.bezierCurveTo(cx - 4, BODY_H * 0.97, cx - 8, BODY_H * 0.82, cx - 9, thoraxY * 1.05);
  ctx.bezierCurveTo(cx - 14, thoraxY, cx - 16, thoraxY * 0.4, cx, 0);
  ctx.closePath();
  ctx.fill();

  // Abdomen segments.
  ctx.strokeStyle = rgba(deep, 0.5);
  ctx.lineWidth = 1;
  for (let i = 1; i <= 6; i++) {
    const y = thoraxY * 1.05 + ((BODY_H - thoraxY * 1.05) * i) / 7;
    const halfW = 9 * (1 - i / 8);
    ctx.beginPath();
    ctx.moveTo(cx - halfW, y);
    ctx.quadraticCurveTo(cx, y + 3, cx + halfW, y);
    ctx.stroke();
  }
  ctx.restore();

  // Head + antennae.
  ctx.save();
  ctx.fillStyle = rgba(shade(core, 0.75), 0.98);
  ctx.beginPath();
  ctx.arc(cx, thoraxY * 0.2, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = rgba(shade(core, 0.8), 0.9);
  ctx.lineWidth = 1.4;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + dir * 3, thoraxY * 0.06);
    ctx.quadraticCurveTo(cx + dir * 14, -14, cx + dir * 20, -26);
    ctx.stroke();
    ctx.fillStyle = rgba(accent, 0.95);
    ctx.beginPath();
    ctx.arc(cx + dir * 20, -26, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Soft highlight down the thorax.
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const sheen = ctx.createLinearGradient(cx - 10, 0, cx + 10, 0);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, rgba(core, 0.5));
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, BODY_W, BODY_H);
  ctx.restore();

  return canvas;
}

export class AnimatedButterflyRenderer {
  public ready = true;
  private wing: WingTexture;
  private wingDim: HTMLCanvasElement;
  private body: HTMLCanvasElement;
  private bodyScale: number;
  private bodyWidth: number;
  private totalWidth: number;

  constructor(_hue: number, coreHex: string, glowHex: string) {
    const core = hexToRgb(coreHex);
    const accent = hexToRgb(glowHex);
    const deep = shade(accent, 0.34);

    this.wing = buildWing(core, accent);
    this.body = buildBody(core, accent, deep);

    // Pre-rendered dimmed wing for the flipped state — building it once beats
    // a per-frame ctx.filter pass (which forces an offscreen composite).
    this.wingDim = document.createElement('canvas');
    this.wingDim.width = this.wing.canvas.width;
    this.wingDim.height = this.wing.canvas.height;
    const dctx = this.wingDim.getContext('2d');
    if (dctx) {
      dctx.filter = 'brightness(0.66) saturate(0.6)';
      dctx.drawImage(this.wing.canvas, 0, 0);
      dctx.filter = 'none';
    }

    const bodyLen = RIG.bodyWingRatio * this.wing.extentH;
    this.bodyScale = bodyLen / this.body.height;
    this.bodyWidth = this.body.width * this.bodyScale;
    this.totalWidth = this.wing.extentW * 2 + this.bodyWidth;
  }

  draw(ctx: CanvasRenderingContext2D, rig: ButterflyRig) {
    const scale = rig.px / Math.max(1, this.totalWidth);
    const flap = Math.cos(rig.flapPhase);
    const wingScaleX = RIG.flapClose + (1 - RIG.flapClose) * (0.5 + 0.5 * flap);
    const hingeY = -this.wing.extentH * RIG.wingRootY;
    const wingDrawY = hingeY - this.wing.rootY;
    const wingDrawX = -this.wing.rootX;
    const wingCanvas = rig.isFlipped ? this.wingDim : this.wing.canvas;

    ctx.save();
    ctx.translate(rig.x, rig.y);
    ctx.rotate(rig.heading);
    ctx.scale(scale, scale);
    ctx.globalAlpha = rig.alpha;

    for (const dir of [-1, 1] as const) {
      ctx.save();
      ctx.translate(-dir * this.bodyWidth * 0.16, hingeY);
      ctx.scale(dir * wingScaleX, 1);
      ctx.drawImage(wingCanvas, wingDrawX, wingDrawY);
      ctx.restore();
    }

    // Body sits over the wing roots.
    ctx.save();
    ctx.scale(this.bodyScale, this.bodyScale);
    ctx.drawImage(this.body, -this.body.width / 2, -this.body.height * RIG.thoraxY);
    ctx.restore();

    ctx.restore();
  }
}
