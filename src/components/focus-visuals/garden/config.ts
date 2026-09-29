/*
 * Garden focus visual — all tunable constants live here.
 * The garden scene itself is the existing butterfly artwork; the night sky,
 * scattered stars and the written phrase are generated in code
 * (see sky.ts / starfield.ts). There is no camera and no constellation.
 */

/** Exactly 30 cocoons, each an individual sprite with its own slot. */
export const COCOON_COUNT = 30;

export interface SessionPalette {
  id: string;
  label: string;
  /** Radial glow colour (soft additive halos). */
  glow: string;
  /** Bright core colour (letter particles). */
  core: string;
  /** Accent tint mixed into a share of the scattered stars. */
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

/** Hue of the provided wing artwork (base for the per-session rotation). */
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
  breathPeriodS: 4,
  breathPeriodEndS: 2.4,
  pausedGlow: 0.04,
  glowRadius: 3.2,
} as const;

/**
 * Butterfly rig (body + mirrored wings). Sizes are the butterfly's nominal
 * on-screen width in CSS pixels — small and delicate by design. The sprites
 * are auto-cropped to their opaque content on load so wings hinge exactly at
 * the body, with no transparent gap.
 */
export const RIG = {
  /** Body length relative to the wing image height. */
  bodyWingRatio: 0.62,
  /** Thorax y within the body sprite (0 top .. 1 bottom). */
  thoraxY: 0.42,
  /** Root edge y within the cropped wing sprite (the hinge line). */
  wingRootY: 0.5,
  /** Inset from the (cropped) wing root edge, as a fraction of wing width. */
  hingeInset: 0,
  flapHz: 3,
  flapVariance: 0.25,
  bankDeg: 8,
  flipChance: 0.15,
  /** Nominal on-screen width range, in px. */
  minPx: 13,
  maxPx: 26,
} as const;

export const VARIATION = { size: 0.22 } as const;

/**
 * Phase A — butterflies enter from the left/right edges across this progress
 * range and dissolve into scattered stars (no constellation figure).
 */
export const ARRIVAL = {
  start: 0.02,
  end: 0.5,
  /** Flight duration for one arrival butterfly, in progress units. */
  flightP: 0.07,
  /** Vertical band (fraction of viewport) the arrivals enter from. */
  entryTopY: 0.06,
  entryBottomY: 0.55,
  /** Nominal width range for arriving butterflies, in px. */
  minPx: 11,
  maxPx: 20,
} as const;

/** Scattered stars the arrivals dissolve into (no shape, natural placement). */
export const STARFIELD = {
  /** Number of scattered stars (one arrival butterfly each). */
  points: 52,
  /** Centre of the scatter, as a fraction of the viewport height. */
  centerY: 0.32,
  /** Scatter half-extents, as fractions of viewport width / height. */
  spreadX: 0.4,
  spreadY: 0.26,
  tintChance: 0.3,
  prominentChance: 0.22,
} as const;

/**
 * Phrase placement as a fraction of the viewport height. The sampler centres
 * text in the canvas it is handed, so it receives a canvas that is
 * `2 * centerY` tall — putting the phrase centre exactly at `centerY`.
 */
export const PHRASE = { centerY: 0.6, fontPx: 42, maxAlpha: 0.92 } as const;

/** Fixed letter-particle pool (subsample if the phrase is too dense). */
export const PARTICLE_POOL = 700;

/** Generated premium night sky (written once to an offscreen canvas). */
export const SKY = {
  /** Height of the static sky overlay, as a fraction of the viewport height. */
  overlayVh: 0.7,
  /** Fraction of the sky height where the fade-to-transparent starts. */
  fadeFrom: 0.58,
  starsFull: 1100,
  starsReduced: 380,
  brightStars: 46,
  nebulaBlobs: 22,
  nebulaAlpha: 0.14,
  /** Fade-in window (in progress) for the whole sky layer. */
  fadeInEnd: 0.3,
} as const;

/** Phase B — cocoon opening + phrase writing. */
export const OPEN_WINDOW = {
  /** Shuffled opening moments are spread across this progress range. */
  start: 0.5,
  end: 0.9,
  /** Pop-out duration at the cocoon slot. */
  popP: 0.015,
  /** Flight from the slot to the first phrase point. */
  flyP: 0.05,
  /** Particle burst duration when a cocoon opens. */
  burstP: 0.02,
} as const;

/** Session storage keys for palette/phrase persistence. */
export const GARDEN_BAG_KEY = 'valuable-garden-bag';
export const GARDEN_PHRASE_BAG_KEY = 'valuable-garden-phrase-bag';
