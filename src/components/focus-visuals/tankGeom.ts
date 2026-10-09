import { useEffect, useRef, useState } from 'react';

/** Scene + mask images share size and content box (object-contain, same box). */
export const TANK_IMG_W = 1670;
export const TANK_IMG_H = 942;

/** Hardcoded CSS placements (translate px, scale) shared by the layers. */
export const SCENE_T = { x: 41, y: 38, k: 1.27 };
export const MASK_T = { x: -378, y: 152, k: 0.54 };

/** Tank interior inside aquarium-overlay.png pixels (conservative). */
export const MASK_TANK = { x: 150, y: 345, width: 1368, height: 300 };

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
export function computeTankGeom(W: number, H: number): TankGeom {
  if (W <= 0 || H <= 0) return TANK_GEOM_FALLBACK;
  const s = Math.min(W / TANK_IMG_W, H / TANK_IMG_H);
  if (s <= 0) return TANK_GEOM_FALLBACK;
  const ox = (W - TANK_IMG_W * s) / 2;
  const oy = (H - TANK_IMG_H * s) / 2;
  const cx = W / 2;
  const cy = H / 2;
  const x0 = mapMaskToScene(MASK_TANK.x, ox, cx, s, MASK_T.x, MASK_T.k, SCENE_T.x, SCENE_T.k);
  const x1 = mapMaskToScene(MASK_TANK.x + MASK_TANK.width, ox, cx, s, MASK_T.x, MASK_T.k, SCENE_T.x, SCENE_T.k);
  const y0 = mapMaskToScene(MASK_TANK.y, oy, cy, s, MASK_T.y, MASK_T.k, SCENE_T.y, SCENE_T.k);
  const y1 = mapMaskToScene(MASK_TANK.y + MASK_TANK.height, oy, cy, s, MASK_T.y, MASK_T.k, SCENE_T.y, SCENE_T.k);
  if (![x0, x1, y0, y1].every(Number.isFinite)) return TANK_GEOM_FALLBACK;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0, top: y0, base: y1 };
}

/**
 * Measures the overlay's own box (absolute inset-0 in the same container
 * as the scene/mask images, so W×H is exactly their content box) and keeps
 * the mapped tank geometry live on resize.
 */
export function useTankGeom() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [geom, setGeom] = useState<TankGeom>(TANK_GEOM_FALLBACK);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setGeom(computeTankGeom(rect.width, rect.height));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, geom };
}
