/**
 * Premium Water region animation.
 * 
 * Draws a flowing-water effect clipped to the user-drawn boundary polygon over
 * the base garden image. Features perspective-corrected ripples, additive
 * surface glints, and smooth caustics/streaks.
 */
import { clamp01 } from '../model-core/canvasUtils';
import { ASSETS } from './config';
import { WATER_BOUNDARIES } from './water_boundaries';

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export class WaterLayer {
  private baseCanvas: HTMLCanvasElement | null = null;
  private isReady = false;
  private width = 0;
  private height = 0;
  
  private readonly STRIP_HEIGHT = 2; // Fine resolution for premium feel
  private mainBoundary: {x: number, y: number}[] = [];
  private boundsMinY = 0;
  
  // Drifting streaks (light rays / caustics)
  private streaks = Array.from({ length: 4 }, () => ({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    speed: 0,
    alpha: 0,
    offset: 0
  }));

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    
    // Pick the main continuous path (the longest one provided, 162 pts)
    // This avoids overlapping sub-paths causing blocky clipping artifacts.
    let longest = WATER_BOUNDARIES[0] || [];
    for (const b of WATER_BOUNDARIES) {
      if (b.length > longest.length) longest = b;
    }
    this.mainBoundary = longest;
    
    // Find highest point of the water for perspective calculations
    this.boundsMinY = longest.reduce((min, p) => Math.min(min, p.y), 1.0);
    
    for (const s of this.streaks) this.resetStreak(s, Math.random());
    
    this.initBaseLayer();
  }

  private resetStreak(s: { x: number, y: number, w: number, h: number, speed: number, alpha: number, offset: number }, initY: number = 0) {
    s.x = 0.5 + Math.random() * 0.5; 
    s.y = initY;
    s.w = 0.02 + Math.random() * 0.08; 
    s.h = 0.4 + Math.random() * 0.6; // Increased streak flow length (taller)
    s.speed = 0.015 + Math.random() * 0.025; // Slightly faster so right side feels alive
    s.alpha = 0.04 + Math.random() * 0.08; 
    s.offset = Math.random() * 100;
  }

  private initBaseLayer() {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = ASSETS.garden;
    
    img.onload = () => {
      const cvs = document.createElement('canvas');
      cvs.width = this.width;
      cvs.height = this.height;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;
      
      const scale = 1.05; 
      const tx = -0.005 * this.width; 
      const ty = 0.025 * this.height; 
      
      const imgRatio = img.width / img.height;
      const cvsRatio = this.width / this.height;
      
      let drawW = this.width;
      let drawH = this.height;
      let offX = 0;
      let offY = 0;
      
      if (imgRatio > cvsRatio) {
        drawW = this.height * imgRatio;
        offX = (this.width - drawW) / 2;
      } else {
        drawH = this.width / imgRatio;
        offY = (this.height - drawH) / 2;
      }
      
      ctx.save();
      ctx.translate(this.width / 2 + tx, this.height / 2 + ty);
      ctx.scale(scale, scale);
      ctx.translate(-this.width / 2, -this.height / 2);
      ctx.drawImage(img, offX, offY, drawW, drawH);
      ctx.restore();
      
      this.baseCanvas = cvs;
      this.isReady = true;
    };
  }

  private buildClipPath(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (this.mainBoundary.length === 0) return;
    
    ctx.beginPath();
    const pts = this.mainBoundary;
    ctx.moveTo(pts[0].x * w, pts[0].y * h);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x * w, pts[i].y * h);
    }
    // Close the polygon enclosing the bottom-right completely
    ctx.lineTo(w, pts[pts.length - 1].y * h); 
    ctx.lineTo(w, h); 
    ctx.lineTo(pts[0].x * w, h); 
    ctx.closePath();
  }

  public draw(ctx: CanvasRenderingContext2D, time: number, performanceDrop: boolean) {
    if (!this.isReady || !this.baseCanvas || this.mainBoundary.length === 0) return;
    
    const w = this.width;
    const h = this.height;
    
    ctx.save();
    
    // 1. Clip exactly to the main boundary
    this.buildClipPath(ctx, w, h);
    ctx.clip();
    
    // Draw the unshifted base image first. This completely eliminates "blackish" seams 
    // caused by sub-pixel rendering/anti-aliasing between the strips on a transparent canvas.
    ctx.drawImage(this.baseCanvas, 0, 0);
    
    // 2. Draw perspective ripples (horizontal strips)
    // Using 2px strips for high quality without destroying frame rate.
    const startY = Math.floor((this.boundsMinY * h) / this.STRIP_HEIGHT) * this.STRIP_HEIGHT;
    
    for (let sy = startY; sy < h; sy += this.STRIP_HEIGHT) {
      // Perspective factor: 0 at the far edge (top right), 1 at the near edge (bottom left)
      const pz = clamp01((sy - startY) / (h - startY));
      
      // Balanced perspective: keeping the far (right) water lively while maintaining depth.
      const amp = lerp(2.0, 3.8, pz); // Increased far amplitude (was 0.8) so it doesn't look dead
      const freq = lerp(0.025, 0.008, pz); 
      const speed = lerp(1.0, 1.4, pz); // Speed is more uniform (was 0.5 at the back)
      
      // Complex waveform for organic water feel
      const phase1 = sy * freq - time * speed;
      const phase2 = sy * freq * 0.6 + time * speed * 0.8;
      
      const xOffset = Math.sin(phase1) * Math.cos(phase2) * amp;
      
      ctx.drawImage(
        this.baseCanvas,
        0, sy, w, this.STRIP_HEIGHT,
        xOffset, sy, w, this.STRIP_HEIGHT
      );
    }
    
    // 3. Premium Surface Layers
    if (!performanceDrop) {
      ctx.globalCompositeOperation = 'screen';
      
      // Caustic Streaks (soft, slow-moving light rays)
      for (const s of this.streaks) {
        s.y += s.speed * 0.025; // Drift slower
        if (s.y > 1.2) this.resetStreak(s, -0.4);
        
        // Complex fade: edges + sine pulse
        let a = s.alpha * (0.6 + 0.4 * Math.sin(time * 3 + s.offset));
        if (s.y < this.boundsMinY) a *= clamp01(1 - (this.boundsMinY - s.y) * 5); 
        if (s.y > 1) a *= clamp01(1 - (s.y - 1) * 5); 
        
        const px = s.x * w;
        const py = s.y * h;
        const pw = s.w * w;
        const ph = s.h * h;
        
        const grad = ctx.createLinearGradient(0, py, 0, py + ph);
        grad.addColorStop(0, `rgba(180, 220, 255, 0)`);
        grad.addColorStop(0.5, `rgba(180, 220, 255, ${a})`);
        grad.addColorStop(1, `rgba(180, 220, 255, 0)`);
        
        ctx.fillStyle = grad;
        // Skew the streak slightly for perspective
        ctx.save();
        ctx.translate(px + pw/2, py);
        ctx.transform(1, 0, -0.3, 1, 0, 0);
        ctx.fillRect(-pw/2, 0, pw, ph);
        ctx.restore();
      }
    }
    
    ctx.restore();
  }
}
