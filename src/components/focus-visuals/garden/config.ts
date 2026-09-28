/*
 * Garden finale — all tunable constants live here.
 * The garden scene itself is the existing butterfly artwork; the sky, stars,
 * moon, milky way and nebula are generated in code (see sky.ts).
 */

/** Exactly 30 cocoons, each an individual sprite with its own slot. */
export const COCOON_COUNT = 30;

/** Act 1 arrivals (butterflies flying in from outside the screen). */
export const ARRIVAL_COUNT = 70;

export interface SessionPalette {
  id: string;
  label: string;
  /** Radial glow colour (soft additive halos). */
  glow: string;
  /** Bright core colour (centres, letter particles). */
  core: string;
  /** Star tint mixed into ~25% of constellation stars. */
  starTint: string;
  /** Target hue (0-360) for the session wing rotation. */
  hue: number;
}

export const PALETTE: SessionPalette[] = [
  { id: 'gold-amber', label: 'Gold Amber', glow: '#ffb347', core: '#ffe9b0', starTint: '#ffd98a', hue: 38 },
  { id: 'ice-cyan', label: 'Ice Cyan', glow: '#6fe3ff', core: '#d8f7ff', starTint: '#a8ecff', hue: 190 },
  { id: 'violet', label: 'Violet', glow: '#b07cff', core: '#efe0ff', starTint: '#cfaaff', hue: 275 },
  { id: 'pearl-white', label: 'Pearl White', glow: '#dfe8ff', core: '#ffffff', starTint: '#e8eefc', hue: 222 },
  { id: 'rose', label: 'Rose', glow: '#ff8fb3', core: '#ffe0ea', starTint: '#ffaecb', hue: 340 },
];

/**
 * Hue of the provided wing artwork. Measured/recorded here as the base for the
 * per-session hue rotation; `detectBaseHue()` refines it at runtime.
 */
export const BASE_HUE = 45;

export const ASSETS = {
  wing: '/visuals/garden/butterfly/wing.png',
  bodyTop: '/visuals/garden/butterfly/body-top.png',
  bodyUnder: '/visuals/garden/butterfly/body-under.png',
  cocoon: '/visuals/butterfly/butterfly-art-2.png',
  garden: '/visuals/butterfly/butterfly-art.png',
} as const;

/** Garden base art placement (unchanged from the tuned hardcoded values). */
export const GARDEN_PLACEMENT = { positionX: 0, positionY: 1.3, scale: 1 } as const;

/** Sprites are downscaled on load to this max dimension. */
export const SPRITE_MAX_PX = 256;

/** Cocoon glow response to timer progress. */
export const COCOON = {
  minGlow: 0.12,
  maxGlow: 0.85,
  brightGlow: 1.0,
  breathPeriodS: 4,
  breathPeriodEndS: 2,
  endWindowSeconds: 10,
  pausedGlow: 0.04,
  glowRadius: 3.2,
} as const;

/** Butterfly rig (body + mirrored wings). */
export const RIG = {
  /** Wing length as a fraction of the butterfly's nominal size. */
  wingScale: 1,
  /** Body length relative to wing length. */
  bodyWingRatio: 0.6,
  /** Thorax y within the body sprite (0 top .. 1 bottom). */
  thoraxY: 0.42,
  /** Hinge inset from the wing's root edge (fraction of wing width). */
  hingeInset: 0.06,
  flapHz: 3,
  flapVariance: 0.25,
  glideChance: 0.12,
  glideOpen: 0.9,
  glideMinS: 0.6,
  glideMaxS: 1.2,
  bankDeg: 8,
  flipChance: 0.15,
  minPx: 16,
  maxPx: 70,
} as const;

/** Depth tiers for the swarm (far / mid / near). */
export const DEPTH_TIERS = [
  { scale: 0.6, alpha: 0.6, blur: true },
  { scale: 1, alpha: 0.9, blur: false },
  { scale: 1.4, alpha: 1, blur: false },
] as const;

export const VARIATION = { size: 0.2, brightness: 0.1, lightChance: 0.2, lightMix: 0.25 } as const;

/** Ambient drifting pollen/fireflies during the session. */
export const AMBIENT = { count: 30, alpha: 0.3, speed: 14, curl: 0.7 } as const;

/** Procedural butterfly constellation. */
export const CONSTELLATION = {
  points: 110,
  fitW: 0.88,
  fitH: 0.6,
  centerY: 0.32,
  lineAlpha: 0.25,
  showLines: true,
  tintChance: 0.25,
  prominentChance: 0.18,
} as const;

/** Camera presets (viewport units; panY = world distance panned up). */
export const FINALE_VIEW = { panY: 0.58, zoom: 1 } as const;
export const DOLLY_OUT = { panY: 0.66, zoom: 0.92 } as const;

/** Phrase draw box, relative to the constellation bounding box. */
export const PHRASE_BOX = { w: 0.45, h: 0.22, maxAlpha: 0.35 } as const;

/** Fixed letter-particle pool (subsample / orbit if the phrase is too small). */
export const PARTICLE_POOL = 700;

/** Generated sky. */
export const SKY = {
  heightVh: 2.2,
  widthVw: 2,
  maxDim: 2048,
  starsFull: 800,
  starsReduced: 300,
  brightStars: 34,
  sparkleStars: 9,
  twinkleCount: 50,
  shootingMinS: 8,
  shootingMaxS: 15,
  moon: { x: 0.7, y: 0.2, r: 0.03 },
} as const;

/** Session storage keys for palette/phrase persistence. */
export const GARDEN_BAG_KEY = 'valuable-garden-bag';
