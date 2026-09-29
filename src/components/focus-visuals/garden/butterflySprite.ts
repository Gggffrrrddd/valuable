/**
 * Butterfly rig: a body sprite with two mirrored wing sprites, flapping around
 * a hinge at the wing's root edge.
 *
 * The source art has large transparent margins, which previously (a) made the
 * butterfly look far bigger than its nominal size and (b) left a visible gap
 * between the wing root and the body. Both are fixed here by cropping every
 * sprite to its opaque bounds on load, then hinging at the cropped edge.
 */
import { RIG, ASSETS, SPRITE_MAX_PX } from './config';

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

type Sprite = HTMLCanvasElement | HTMLImageElement;

/** Alpha above this counts as "content" when cropping sprites. */
const ALPHA_THRESHOLD = 12;

export class ButterflyRenderer {
  private wingImg: Sprite | null = null;
  private bodyTopImg: Sprite | null = null;
  private bodyUnderImg: Sprite | null = null;
  public ready = false;

  constructor(private sessionHue: number) {
    void this.load();
  }

  private async load() {
    const [wing, top, under] = await Promise.all([
      this.loadImage(ASSETS.wing),
      this.loadImage(ASSETS.bodyTop),
      this.loadImage(ASSETS.bodyUnder),
    ]);
    this.wingImg = this.hueRotate(cropToOpaque(wing), this.sessionHue);
    this.bodyTopImg = cropToOpaque(top);
    this.bodyUnderImg = cropToOpaque(under);
    this.ready = true;
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(img);
      img.src = src;
    });
  }

  /**
   * Rotate the (already cropped) wing towards the session hue. A per-pixel
   * colour-matrix rotation is used rather than `ctx.filter` for consistency.
   */
  private hueRotate(img: Sprite, hueTarget: number): Sprite {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, SPRITE_MAX_PX / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return img;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let imgData: ImageData;
    try {
      imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch {
      return canvas;
    }
    const data = imgData.data;

    const shift = (hueTarget / 360) * Math.PI * 2;
    const cosA = Math.cos(shift);
    const sinA = Math.sin(shift);
    const m = [
      0.213 + cosA * 0.787 - sinA * 0.213, 0.715 - cosA * 0.715 - sinA * 0.715,
      0.072 - cosA * 0.072 + sinA * 0.928,
      0.213 - cosA * 0.213 + sinA * 0.143, 0.715 + cosA * 0.285 + sinA * 0.14,
      0.072 - cosA * 0.072 - sinA * 0.283,
      0.213 - cosA * 0.213 - sinA * 0.787, 0.715 - cosA * 0.715 + sinA * 0.715,
      0.072 + cosA * 0.928 + sinA * 0.072,
    ];

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      data[i] = Math.min(255, Math.max(0, r * m[0] + g * m[1] + b * m[2]));
      data[i + 1] = Math.min(255, Math.max(0, r * m[3] + g * m[4] + b * m[5]));
      data[i + 2] = Math.min(255, Math.max(0, r * m[6] + g * m[7] + b * m[8]));
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  draw(ctx: CanvasRenderingContext2D, rig: ButterflyRig) {
    const wing = this.wingImg;
    const body = rig.isFlipped ? this.bodyUnderImg : this.bodyTopImg;
    if (!this.ready || !wing || !body) return;

    // The butterfly is sized by its total on-screen width: both wings plus the
    // small body. This keeps `rig.px` a true, predictable screen size.
    const bodyLen = RIG.bodyWingRatio * wing.height;
    const bodyScale = bodyLen / body.height;
    const bodyWidth = body.width * bodyScale;
    const totalWidth = wing.width * 2 + bodyWidth;
    const scale = rig.px / Math.max(1, totalWidth);

    ctx.save();
    ctx.translate(rig.x, rig.y);
    ctx.rotate(rig.heading);
    ctx.scale(scale, scale);
    ctx.globalAlpha = rig.alpha;

    const flap = Math.cos(rig.flapPhase);
    const wingScaleX = 0.26 + (1 - 0.26) * (0.5 + 0.5 * flap);

    // Wings hinge exactly at their cropped root edge (x = 0) and are centred
    // vertically on the thorax, so they always meet the body.
    const hingeInset = wing.width * RIG.hingeInset;
    const hingeY = -wing.height * RIG.wingRootY;
    const bodyTop = -body.height * RIG.thoraxY;

    if (rig.isFlipped) ctx.filter = 'brightness(0.62) saturate(0.55)';

    for (const dir of [-1, 1] as const) {
      ctx.save();
      ctx.translate(-dir * bodyWidth * 0.18, hingeY);
      ctx.scale(dir * wingScaleX, 1);
      ctx.drawImage(wing, -hingeInset, 0);
      ctx.restore();
    }

    ctx.filter = 'none';

    // Body last, so it sits cleanly over the wing roots.
    ctx.save();
    ctx.scale(bodyScale, bodyScale);
    ctx.drawImage(body, -body.width / 2, bodyTop / bodyScale);
    ctx.restore();

    ctx.restore();
  }
}

/**
 * Crop a sprite to the bounding box of its opaque pixels (inflated by 1px).
 * Falls back to the original image if the pixels cannot be read.
 */
function cropToOpaque(img: Sprite): Sprite {
  const w = img.width;
  const h = img.height;
  if (!w || !h) return img;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img;

  ctx.drawImage(img, 0, 0);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return img;
  }

  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return img; // fully transparent; keep as-is

  // Inflate by 1px so anti-aliased edges are not clipped.
  minX = Math.max(0, minX - 1);
  minY = Math.max(0, minY - 1);
  maxX = Math.min(w - 1, maxX + 1);
  maxY = Math.min(h - 1, maxY + 1);

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const octx = out.getContext('2d');
  if (!octx) return img;
  octx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
  return out;
}
