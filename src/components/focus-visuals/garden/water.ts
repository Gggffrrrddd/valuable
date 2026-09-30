/**
 * Water region animation.
 * 
 * Draws a flowing-water effect clipped to a user-drawn boundary polygon over
 * the base garden image. Designed to be lightweight: pre-renders the base
 * image region, then per-frame draws horizontally-wobbling strips, additive
 * vertical streaks, and glints.
 */
import { clamp01 } from '../model-core/canvasUtils';
import { ASSETS } from './config';
import { WATER_BOUNDARIES } from './water_boundaries';

export class WaterLayer {
  private baseCanvas: HTMLCanvasElement | null = null;
  private isReady = false;
  private width = 0;
  private height = 0;
  
  // Ripple parameters
  private readonly STRIP_HEIGHT = 4;
  private readonly RIPPLE_FREQ = 0.05; // Spatial frequency (multiplier for y)
  private readonly RIPPLE_SPEED = 1.2; // Time multiplier
  private readonly RIPPLE_AMP = 2.5;   // Pixels of horizontal shift
  
  // Drifting streaks (vertical, top -> bottom)
  private streaks = Array.from({ length: 3 }, () => ({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    speed: 0,
    alpha: 0
  }));
  
  // Drifting glints (vertical, top -> bottom)
  private glints = Array.from({ length: 8 }, () => ({
    x: 0,
    y: 0,
    size: 0,
    speed: 0,
    alphaMult: 0,
    offset: 0
  }));

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    
    // Initialize particles with randomized values
    for (const s of this.streaks) this.resetStreak(s, Math.random());
    for (const g of this.glints) this.resetGlint(g, Math.random());
    
    // Pre-render the base water region once
    this.initBaseLayer();
  }

  private resetStreak(s: { x: number, y: number, w: number, h: number, speed: number, alpha: number }, initY: number = 0) {
    s.x = 0.5 + Math.random() * 0.5; // Mostly on the right side
    s.y = initY; // 0..1
    s.w = 0.01 + Math.random() * 0.05; // Thin width
    s.h = 0.1 + Math.random() * 0.2; // Tall height
    s.speed = 0.02 + Math.random() * 0.03; // Slow drift downwards
    s.alpha = 0.08 + Math.random() * 0.07; // 0.08 - 0.15
  }

  private resetGlint(g: { x: number, y: number, size: number, speed: number, alphaMult: number, offset: number }, initY: number = 0) {
    g.x = 0.5 + Math.random() * 0.5;
    g.y = initY;
    g.size = 1 + Math.random(); // 1-2px
    g.speed = 0.03 + Math.random() * 0.04;
    g.alphaMult = 0.4 + Math.random() * 0.6;
    g.offset = Math.random() * 100;
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
      
      // Draw the garden image exactly as GardenVisual does
      // scale 1.05, translate(-0.5%, 2.5%) (CSS absolute inset-0)
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
      // Apply the CSS-equivalent transform (center origin)
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
    ctx.beginPath();
    
    // The water is to the right and bottom of the drawn paths.
    // We close each path against the bottom-right corner.
    for (const pts of WATER_BOUNDARIES) {
      if (pts.length === 0) continue;
      ctx.moveTo(pts[0].x * w, pts[0].y * h);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * w, pts[i].y * h);
      }
      // Close the polygon enclosing the bottom-right
      ctx.lineTo(w, pts[pts.length - 1].y * h); // Straight to the right edge
      ctx.lineTo(w, h); // Down to bottom right corner
      ctx.lineTo(pts[0].x * w, h); // Left along the bottom edge to start X
      ctx.closePath();
    }
  }

  public draw(ctx: CanvasRenderingContext2D, time: number, performanceDrop: boolean) {
    if (!this.isReady || !this.baseCanvas) return;
    
    const w = this.width;
    const h = this.height;
    
    ctx.save();
    
    // 1. Clip to water boundary
    this.buildClipPath(ctx, w, h);
    ctx.clip();
    
    // 2. Draw ripples (horizontal strips)
    const strips = Math.ceil(h / this.STRIP_HEIGHT);
    // Optimization: only process strips in the lower half where water actually is (y > 0.4)
    const startStrip = Math.floor((h * 0.4) / this.STRIP_HEIGHT);
    
    for (let i = startStrip; i < strips; i++) {
      const sy = i * this.STRIP_HEIGHT;
      
      // CORRECTION: Ripple phase moves crests downward (far to near). 
      // phase = strip.y * frequency - time * speed
      const phase = sy * this.RIPPLE_FREQ - time * this.RIPPLE_SPEED;
      const xOffset = Math.sin(phase) * this.RIPPLE_AMP;
      
      // ±4% reflection flicker shimmer derived from ripple phase
      const shimmer = 1 + Math.sin(phase * 1.5) * 0.04;
      
      if (Math.abs(shimmer - 1) > 0.01) {
          ctx.filter = `brightness(${shimmer})`;
      } else {
          ctx.filter = 'none';
      }
      
      ctx.drawImage(
        this.baseCanvas,
        0, sy, w, this.STRIP_HEIGHT,
        xOffset, sy, w, this.STRIP_HEIGHT
      );
    }
    ctx.filter = 'none'; // reset
    
    // If frame time is bad, drop streaks and glints
    if (!performanceDrop) {
      // 3. Vertical streaks
      ctx.globalCompositeOperation = 'lighter';
      for (const s of this.streaks) {
        // Drift downwards
        s.y += s.speed * 0.03; // roughly per frame delta
        if (s.y > 1.2) this.resetStreak(s, -0.2);
        
        // Edge fade in/out
        let a = s.alpha;
        if (s.y < 0) a *= clamp01(1 - (0 - s.y) * 5); // fade in at top
        if (s.y > 1) a *= clamp01(1 - (s.y - 1) * 5); // fade out at bottom
        
        const px = s.x * w;
        const py = s.y * h;
        const pw = s.w * w;
        const ph = s.h * h;
        
        const grad = ctx.createLinearGradient(0, py, 0, py + ph);
        grad.addColorStop(0, `rgba(255,255,255,0)`);
        grad.addColorStop(0.5, `rgba(255,255,255,${a})`);
        grad.addColorStop(1, `rgba(255,255,255,0)`);
        
        ctx.fillStyle = grad;
        ctx.fillRect(px, py, pw, ph);
      }
      
      // 4. Glints
      for (const g of this.glints) {
        g.y += g.speed * 0.03;
        if (g.y > 1.1) this.resetGlint(g, -0.1);
        
        let a = g.alphaMult * (0.5 + 0.5 * Math.sin(time * 3 + g.offset));
        if (g.y < 0) a *= clamp01(1 - (0 - g.y) * 10);
        if (g.y > 1) a *= clamp01(1 - (g.y - 1) * 10);
        
        const px = g.x * w;
        const py = g.y * h;
        
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, g.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    ctx.restore();
  }
}
