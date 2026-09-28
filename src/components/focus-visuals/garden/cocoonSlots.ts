import { COCOON_COUNT } from './config';

/**
 * One cocoon = one sprite. Positions are the tuned hardcoded values,
 * expressed as percentages of the viewport (as used by the sprite transform),
 * converted here to 0..1 fractions with the origin at the top-left.
 */
export interface CocoonSlot {
  id: number;
  /** Horizontal centre, 0..1 of viewport width. */
  x: number;
  /** Vertical centre, 0..1 of viewport height. */
  y: number;
  /** Sprite scale (fraction of the contained asset box). */
  scale: number;
}

const RAW: { x: number; y: number; scale: number }[] = [
  { x: -48.1, y: 24.2, scale: 0.04 },
  { x: -45.5, y: 27.3, scale: 0.04 },
  { x: -34.8, y: 24.2, scale: 0.04 },
  { x: -36.1, y: 21.2, scale: 0.04 },
  { x: -31.8, y: 27.3, scale: 0.04 },
  { x: -21.2, y: 25.8, scale: 0.04 },
  { x: 0, y: 28.8, scale: 0.04 },
  { x: -12.1, y: 34.8, scale: 0.04 },
  { x: -18.2, y: 27.3, scale: 0.04 },
  { x: 9.1, y: 27.3, scale: 0.04 },
  { x: -14.9, y: 40.9, scale: 0.04 },
  { x: -37.9, y: 43.9, scale: 0.04 },
  { x: -7.6, y: 33.3, scale: 0.04 },
  { x: -36.4, y: 36.4, scale: 0.04 },
  { x: -2.2, y: 25.8, scale: 0.04 },
  { x: -46.4, y: 46.2, scale: 0.04 },
  { x: 28.8, y: 33.3, scale: 0.04 },
  { x: -47.4, y: 39.8, scale: 0.04 },
  { x: -22.7, y: 42.4, scale: 0.04 },
  { x: -25.4, y: 38.4, scale: 0.04 },
  { x: -10.6, y: 28.8, scale: 0.04 },
  { x: -13.6, y: 25.8, scale: 0.04 },
  { x: 7.6, y: 40.9, scale: 0.04 },
  { x: -25.8, y: 25.8, scale: 0.03 },
  { x: 4.5, y: 27.3, scale: 0.03 },
  { x: -43.9, y: 24.2, scale: 0.03 },
  { x: 12.1, y: 33.3, scale: 0.03 },
  { x: -4.5, y: 27.3, scale: 0.03 },
  { x: 21.2, y: 28.8, scale: 0.04 },
  { x: 16.7, y: 28.8, scale: 0.04 },
];

export const COCOON_SLOTS: CocoonSlot[] = RAW.map((s, i) => ({
  id: i,
  x: 0.5 + s.x / 100,
  y: 0.5 + s.y / 100,
  scale: s.scale,
}));

/** Random phase offset per cocoon so the breathing never looks synchronised. */
export const COCOON_PHASES: number[] = COCOON_SLOTS.map((_, i) => ((i * 137.508) % 360) * (Math.PI / 180));

/** Dev guard — the finale relies on exactly COCOON_COUNT individual cocoons. */
if (COCOON_SLOTS.length !== COCOON_COUNT) {
  console.error(`[garden] expected ${COCOON_COUNT} cocoon slots, found ${COCOON_SLOTS.length}`);
}
