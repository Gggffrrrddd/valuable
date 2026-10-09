import { useEffect, useRef, useState } from 'react';

/** Scene + mask images share size and content box (object-contain, same box). */
export const TANK_IMG_W = 1670;
export const TANK_IMG_H = 942;

/** Hardcoded CSS placements (translate px, scale) shared by the layers. */
export const SCENE_T = { x: 41, y: 38, k: 1.27 };
export const MASK_T = { x: -378, y: 152, k: 0.54 };

/** Tank interior inside aquarium-overlay.png pixels (conservative). */
export const MASK_TANK = { x: 150, y: 345, width: 1368, height: 300 };

/** Overlay asset used for exact alpha calibration (same as the jar). */
const OVERLAY_URL = '/visuals/jar/aquarium-overlay.png';
const ALPHA_THRESHOLD = 24;
/** Glass thickness insets: keep water/fish inside the glass walls. */
const GLASS_X = 16;
const RIM_TOP = 20;
const BASE_BOTTOM = 12;

export interface TankGeom {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  base: number;
}

/** Fallback before first measure (matches the previous static rect). */
export const TANK_GEOM_FALLBACK: TankGeom = {
  x: 170,
  y: 352,
  width: 1330,
  height: 288,
  top: 360,
  base: 638,
};

function mapMaskToScene(q: number, o: number, c: number, s: number, tM: number, kM: number, tS: number, kS: number): number {
  // Container point of mask pixel q, then inverse scene mapping to scene px.
  const m = c + kM * (s * q + o - c) + tM;
  return ((m - c - tS) / kS - o + c) / s;
}

/**
 * Maps the mask tank rect into scene-image coordinates for the current
 * content box (W×H). object-contain fit + center-origin CSS transforms are
 * reproduced exactly, so water/fish/rain land precisely where the hidden
 * mask sits — on any screen size.
 */
export function computeTankGeom(W: number, H: number, rect: { x: number; y: number; width: number; height: number } = MASK_TANK): TankGeom {
  if (W <= 0 || H <= 0) return TANK_GEOM_FALLBACK;
  const s = Math.min(W / TANK_IMG_W, H / TANK_IMG_H);
  if (s <= 0) return TANK_GEOM_FALLBACK;
  const ox = (W - TANK_IMG_W * s) / 2;
  const oy = (H - TANK_IMG_H * s) / 2;
  const cx = W / 2;
  const cy = H / 2;
  const x0 = mapMaskToScene(rect.x, ox, cx, s, MASK_T.x, MASK_T.k, SCENE_T.x, SCENE_T.k);
  const x1 = mapMaskToScene(rect.x + rect.width, ox, cx, s, MASK_T.x, MASK_T.k, SCENE_T.x, SCENE_T.k);
  const y0 = mapMaskToScene(rect.y, oy, cy, s, MASK_T.y, MASK_T.k, SCENE_T.y, SCENE_T.k);
  const y1 = mapMaskToScene(rect.y + rect.height, oy, cy, s, MASK_T.y, MASK_T.k, SCENE_T.y, SCENE_T.k);
  if (![x0, x1, y0, y1].every(Number.isFinite)) return TANK_GEOM_FALLBACK;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0, top: y0, base: y1 };
}

/**
 * Exact alpha calibration of the overlay (same technique as the jar):
 * reads the overlay's alpha channel, finds the glass body rows, insets past
 * the glass, and returns the true water interior in overlay pixels.
 */
function calibrateOverlay(): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.src = OVERLAY_URL;
    image.onload = () => {
      try {
        const w = image.naturalWidth;
        const h = image.naturalHeight;
        if (!w || !h) { resolve(null); return; }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) { resolve(null); return; }
        context.drawImage(image, 0, 0, w, h);
        const pixels = context.getImageData(0, 0, w, h).data;
        const bounds: { left: number; right: number }[] = [];
        for (let y = 0; y < h; y += 1) {
          let left = -1;
          let right = -1;
          for (let x = 0; x < w; x += 1) {
            if (pixels[(y * w + x) * 4 + 3] <= ALPHA_THRESHOLD) continue;
            if (left === -1) left = x;
            right = x;
          }
          bounds.push(left === -1 ? { left: -1, right: -1 } : { left, right });
        }
        let maxSpan = 0;
        for (const row of bounds) {
          if (row.left === -1) continue;
          maxSpan = Math.max(maxSpan, row.right - row.left);
        }
        if (maxSpan <= 0) { resolve(null); return; }
        // Glass body rows: wide, contiguous content (the straight-walled tank).
        let top = -1;
        let bottom = -1;
        for (let y = 0; y < h; y += 1) {
          const row = bounds[y];
          if (row.left !== -1 && row.right - row.left > maxSpan * 0.55) {
            if (top === -1) top = y;
            bottom = y;
          }
        }
        if (top === -1 || bottom - top < 40) { resolve(null); return; }
        // Median walls across the straight middle section (skip rim/base).
        const walls: number[] = [];
        const wallR: number[] = [];
        for (let y = top + 30; y <= bottom - 30; y += 1) {
          const row = bounds[y];
          if (row.left !== -1 && row.right - row.left > maxSpan * 0.55) {
            walls.push(row.left);
            wallR.push(row.right);
          }
        }
        if (walls.length === 0) { resolve(null); return; }
        walls.sort((a, b) => a - b);
        wallR.sort((a, b) => a - b);
        const left = walls[Math.floor(walls.length / 2)] + GLASS_X;
        const right = wallR[Math.floor(wallR.length / 2)] - GLASS_X;
        const y0 = top + RIM_TOP;
        const y1 = bottom - BASE_BOTTOM;
        if (right - left < 40 || y1 - y0 < 40) { resolve(null); return; }
        resolve({ x: left, y: y0, width: right - left, height: y1 - y0 });
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
  });
}

/**
 * Measures the overlay's own box (absolute inset-0 in the same container
 * as the scene/mask images, so W×H is exactly their content box) and keeps
 * the mapped tank geometry live on resize.
 */
export function useTankGeom() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [calibrated, setCalibrated] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setBox({ width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let live = true;
    calibrateOverlay().then((rect) => {
      if (live && rect) {
        setCalibrated(rect);
        console.log(`[TankCal] mask interior x=${rect.x} y=${rect.y} w=${rect.width} h=${rect.height}`);
      }
    });
    return () => { live = false; };
  }, []);
  const geom = computeTankGeom(box.width, box.height, calibrated ?? MASK_TANK);
  return { ref, geom };
}
