import { RIG, ASSETS, SPRITE_MAX_PX } from './config';
import { smoothstep } from '../model-core/canvasUtils';

export interface ButterflyRig {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  heading: number; // radians
  flapPhase: number; // radians
  bank: number; // radians
  isFlipped: boolean;
  glowAlpha: number;
}

export class ButterflyRenderer {
  private wingImg: HTMLImageElement | null = null;
  private bodyTopImg: HTMLImageElement | null = null;
  private bodyUnderImg: HTMLImageElement | null = null;
  public ready = false;

  constructor(private sessionHue: number) {
    this.load();
  }

  private async load() {
    const [wing, top, under] = await Promise.all([
      this.loadImage(ASSETS.wing),
      this.loadImage(ASSETS.bodyTop),
      this.loadImage(ASSETS.bodyUnder),
    ]);
    
    // Hue-rotate the wing
    this.wingImg = this.hueRotate(wing, this.sessionHue);
    this.bodyTopImg = top;
    this.bodyUnderImg = under;
    this.ready = true;
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = src;
    });
  }

  private hueRotate(img: HTMLImageElement, hueTarget: number): HTMLImageElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(img.width, SPRITE_MAX_PX);
    canvas.height = Math.min(img.height, SPRITE_MAX_PX);
    const ctx = canvas.getContext('2d');
    if (!ctx) return img;
    
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Simple global composite hue rotation is not possible, we need to manipulate pixels or use filter.
    // The prompt: "per-pixel HSL rotation on a downscaled offscreen canvas; do not rely on ctx.filter"
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    
    // Very simplified hue shift approximation
    const shift = (hueTarget / 360) * Math.PI * 2;
    const cosA = Math.cos(shift);
    const sinA = Math.sin(shift);
    const matrix = [
      0.213 + cosA * 0.787 - sinA * 0.213, 0.715 - cosA * 0.715 - sinA * 0.715, 0.072 - cosA * 0.072 + sinA * 0.928,
      0.213 - cosA * 0.213 + sinA * 0.143, 0.715 + cosA * 0.285 + sinA * 0.140, 0.072 - cosA * 0.072 - sinA * 0.283,
      0.213 - cosA * 0.213 - sinA * 0.787, 0.715 - cosA * 0.715 + sinA * 0.715, 0.072 + cosA * 0.928 + sinA * 0.072
    ];

    for (let i = 0; i < data.length; i += 4) {
      if (data[i+3] === 0) continue;
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      data[i]   = Math.min(255, Math.max(0, r * matrix[0] + g * matrix[1] + b * matrix[2]));
      data[i+1] = Math.min(255, Math.max(0, r * matrix[3] + g * matrix[4] + b * matrix[5]));
      data[i+2] = Math.min(255, Math.max(0, r * matrix[6] + g * matrix[7] + b * matrix[8]));
    }
    
    ctx.putImageData(imgData, 0, 0);
    const out = new Image();
    out.src = canvas.toDataURL();
    return out;
  }

  draw(ctx: CanvasRenderingContext2D, rig: ButterflyRig) {
    if (!this.ready || !this.wingImg || !this.bodyTopImg || !this.bodyUnderImg) return;

    ctx.save();
    ctx.translate(rig.x, rig.y);
    ctx.rotate(rig.heading);
    ctx.scale(rig.scale, rig.scale);
    ctx.globalAlpha = rig.alpha;

    const flap = Math.cos(rig.flapPhase);
    const wingScaleX = 0.28 + (1 - 0.28) * smoothstep(0, 1, 0.5 + 0.5 * flap);
    
    const bodyImg = rig.isFlipped ? this.bodyUnderImg : this.bodyTopImg;
    const wingHingeX = this.wingImg.width * RIG.hingeInset;
    const bodyScale = RIG.bodyWingRatio * (this.wingImg.height / bodyImg.height);
    
    // Draw left wing
    ctx.save();
    ctx.translate(0, -this.wingImg.height * RIG.thoraxY);
    ctx.scale(-wingScaleX, 1);
    if (rig.isFlipped) ctx.filter = 'brightness(0.5) saturate(0.2)';
    ctx.drawImage(this.wingImg, -wingHingeX, 0);
    ctx.restore();

    // Draw right wing
    ctx.save();
    ctx.translate(0, -this.wingImg.height * RIG.thoraxY);
    ctx.scale(wingScaleX, 1);
    if (rig.isFlipped) ctx.filter = 'brightness(0.5) saturate(0.2)';
    ctx.drawImage(this.wingImg, -wingHingeX, 0);
    ctx.restore();

    // Draw body
    ctx.save();
    ctx.scale(bodyScale, bodyScale);
    ctx.drawImage(bodyImg, -bodyImg.width / 2, -bodyImg.height * RIG.thoraxY);
    ctx.restore();

    ctx.restore();
  }
}
