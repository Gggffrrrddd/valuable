/**
 * Scattered star targets for the arrivals to dissolve into. There is no
 * constellation figure any more — just an even, natural-looking scatter across
 * the dark upper area, with a lighter dusting near the centre.
 */
import { STARFIELD } from './config';

export interface StarTarget {
  id: number;
  x: number;
  y: number;
  isProminent: boolean;
}

export function generateStarfield(width: number, height: number): StarTarget[] {
  const targets: StarTarget[] = [];
  const cx = width * 0.5;
  const cy = height * STARFIELD.centerY;
  const halfW = width * STARFIELD.spreadX;
  const halfH = height * STARFIELD.spreadY;

  // Golden-ratio spiral gives an even, organic scatter with no clumps.
  const GR = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < STARFIELD.points; i++) {
    const t = (i + 0.5) / STARFIELD.points;
    const radius = Math.sqrt(t);
    const angle = i * GR;
    // Slightly wider than tall for a natural sky spread.
    const x = cx + Math.cos(angle) * radius * halfW;
    const y = cy + Math.sin(angle) * radius * halfH * 0.92;
    targets.push({
      id: i,
      x,
      y,
      isProminent: fract(Math.sin(i * 12.9898) * 43758.5453) < STARFIELD.prominentChance,
    });
  }

  return targets;
}

function fract(n: number) {
  return n - Math.floor(n);
}
