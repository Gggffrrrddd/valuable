import { CONSTELLATION } from './config';

export interface StarTarget {
  id: number;
  x: number;
  y: number;
  group: 'outer' | 'wing' | 'upperLower' | 'center';
  isProminent: boolean;
}

export function generateConstellation(width: number, height: number): StarTarget[] {
  const targets: StarTarget[] = [];
  const cx = width * 0.5;
  // The figure lives in the dark upper area of the current static view (no
  // camera anymore), centred at a fraction of the viewport height.
  const cy = height * CONSTELLATION.centerY;
  const halfW = (width * CONSTELLATION.fitW) / 2;
  const h = height * CONSTELLATION.fitH;
  
  let idGen = 0;
  
  function addPoint(x: number, y: number, group: StarTarget['group']) {
    targets.push({
      id: idGen++,
      x: cx + x * halfW,
      y: cy + y * (h / 2),
      group,
      isProminent: Math.random() < CONSTELLATION.prominentChance
    });
  }

  // Simplified procedural butterfly shape (normalized coordinates -1 to 1)
  
  // Center body
  for (let i = -0.5; i <= 0.5; i += 0.2) addPoint(0, i, 'center');
  
  // Outer wing (Right side)
  const rightOuter = [
    [0.1, -0.6], [0.4, -0.8], [0.8, -0.6], [1.0, -0.2], 
    [0.9, 0.2], [0.7, 0.4], [0.4, 0.3], [0.1, 0.2]
  ];
  rightOuter.forEach(p => addPoint(p[0], p[1], 'outer'));
  
  // Inner wing (Right side)
  const rightInner = [
    [0.2, -0.4], [0.5, -0.5], [0.7, -0.3], [0.6, 0.0], [0.3, 0.1]
  ];
  rightInner.forEach(p => addPoint(p[0], p[1], 'wing'));

  // Antenna (Right)
  addPoint(0.1, -0.8, 'upperLower');
  addPoint(0.2, -0.9, 'upperLower');

  // Tail lobe (Right)
  addPoint(0.6, 0.7, 'upperLower');
  addPoint(0.4, 0.9, 'upperLower');
  addPoint(0.2, 0.7, 'upperLower');

  // Mirror for left side
  const rightCount = targets.length;
  for (let i = 0; i < rightCount; i++) {
    const t = targets[i];
    if (t.x === cx) continue; // don't duplicate center points
    targets.push({
      id: idGen++,
      x: cx - (t.x - cx),
      y: t.y,
      group: t.group,
      isProminent: t.isProminent
    });
  }

  return targets;
}
