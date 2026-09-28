/**
 * Finale timeline — every time is relative to T0 (session completion) and must
 * be a constant so the whole sequence stays tunable from one place.
 */

export const T = {
  /** Timer/controls fade out; cocoons reach full steady glow (no opening). */
  fadeEnd: 1,
  /** Arrival swarm enters from outside the screen. */
  arrivalStart: 1,
  arrivalEnd: 5,
  panStart: 3,
  /** Arriving butterflies dissolve into stars. */
  dissolveStart: 5,
  dissolveEnd: 7,
  /** Formation. */
  formStart: 7,
  formEnd: 17,
  settleEnd: 19,
  /** Act 2: camera eases back down to the finale view. */
  viewStart: 19,
  viewEnd: 21,
  /** Cocoons open one by one. */
  openStart: 21,
  openEnd: 25,
  /** Butterflies rise toward the phrase area. */
  riseStart: 25,
  riseEnd: 27,
  /** Writing. */
  writeStart: 27,
  writeEnd: 33,
  /** Hold, then final dolly-out + Continue. */
  holdEnd: 37,
  dollyEnd: 41,
} as const;

/** Formation group order (each group starts later, overlapping). */
export const FORMATION_GROUPS = [
  { group: 'outer' as const, start: 7, end: 10 },
  { group: 'wing' as const, start: 9, end: 12 },
  { group: 'upperLower' as const, start: 11, end: 14 },
  { group: 'center' as const, start: 13, end: 16 },
];

/** Writing timing per butterfly (proportional to slice length, clamped). */
export const WRITE = { minS: 1.6, maxS: 3.4, leftToRightSpan: 2.4 } as const;

/** Cocoon opening. */
export const OPEN = { stagger: 3, popFrom: 0.2, popS: 0.8 } as const;

/** Rise from the garden. */
export const RISE = { minS: 0.8, maxS: 1.4, wander: 0.5 } as const;

/** Camera keyframes (panY/zoom), evaluated with easeInOutCubic. */
export const CAMERA_KEYS = [
  { t: 0, panY: 0, zoom: 1 },
  { t: 3, panY: 0, zoom: 1 },
  { t: 7, panY: 0.34, zoom: 0.94 },
  { t: 16, panY: 0.52, zoom: 0.86 },
  { t: 19, panY: 0.58, zoom: 1 },
  { t: 21, panY: 0.58, zoom: 1 },
  { t: 37, panY: 0.58, zoom: 1 },
  { t: 41, panY: 0.66, zoom: 0.92 },
] as const;

export const FINALE_DURATION = T.dollyEnd;
