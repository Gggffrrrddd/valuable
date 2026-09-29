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
  cocoon: '/visuals/butterfly/butterfly-art-2.png',
  garden: '/visuals/butterfly/butterfly-art.png',
} as const;

/** Garden base art placement (unchanged from the tuned hardcoded values). */
export const GARDEN_PLACEMENT = { positionX: 0, positionY: 1.3, scale: 1 } as const;

/**
 * Cocoon glow response to timer progress. The glow is vibrant from the very
 * first moment of the session and swells to a bright bloom as the cocoon
 * nears its opening, then keeps breathing until it breaks.
 */
export const COCOON = {
  minGlow: 0.62,
  maxGlow: 1,
  breathPeriodS: 3.6,
  breathPeriodEndS: 2.2,
  pausedGlow: 0.45,
  /** Core drop-shadow radius, in px. */
  glowRadius: 7,
  /** Wider bloom radius, in px, layered under the core glow. */
  bloomRadius: 18,
} as const;

/**
 * Butterfly rig (body + mirrored wings). Sizes are the butterfly's nominal
 * on-screen width in CSS pixels — small and delicate by design. Butterflies
 * are drawn entirely in code (see animatedButterfly.ts).
 */
export const RIG = {
  /** Body length relative to the wing height. */
  bodyWingRatio: 0.62,
  /** Thorax y within the body (0 top .. 1 bottom). */
  thoraxY: 0.42,
  /** Root edge y within the wing (the hinge line). */
  wingRootY: 0.5,
  /**
   * Wingbeat frequency. The flap always keeps a positive floor speed so it
   * never freezes at the extremes of the cycle.
   */
  flapHz: 3,
  flapVariance: 0.25,
  /** How far the wing sweeps shut, as a fraction of its full span. */
  flapClose: 0.34,
  bankDeg: 8,
  flipChance: 0.15,
  /** Nominal on-screen width range, in px. */
  minPx: 13,
  maxPx: 26,
  /**
   * Speed profile over a flight (in progress units). Butterflies accelerate,
   * ease as they near their target, then accelerate smoothly into the finish
   * — a continuous glide, never a stop-start stall.
   */
  speedGamma: 1.55,
  /** Gentle mid-flight surge so the pace reads as a natural flutter. */
  surgeAmount: 0.18,
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
  flightP: 0.05,
  /** How long the butterfly takes to melt into its star once it arrives. */
  convertP: 0.018,
  /** Duration of the bright landing pulse as the star appears. */
  pulseP: 0.035,
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
 * Phrase box, as fractions of the viewport. It is deliberately kept to the
 * left/centre of the dark upper area so the written phrase never slides under
 * the flip-clock timer, which sits vertically centred on the right.
 */
export const PHRASE = {
  boxX: 0.05,
  boxW: 0.63,
  boxY: 0.47,
  boxH: 0.15,
  maxFontPx: 40,
  minFontPx: 22,
} as const;

/** Fixed letter-particle pool (subsample if the phrase is too dense). */
export const PARTICLE_POOL = 1400;

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

/**
 * Premium moon. It fades in as the star field completes (end of phase A) and
 * stays for the rest of the session, so the phrase is written beneath it.
 * Positioned in the upper right, clear of the flip-clock.
 */
export const MOON = {
  /** Centre, as fractions of the viewport. */
  x: 0.82,
  y: 0.16,
  /** Radius as a fraction of min(viewport width, height). */
  radius: 0.05,
  /** Progress window over which the moon fades in. */
  fadeStart: 0.4,
  fadeEnd: 0.52,
} as const;

/** Phase B — cocoon opening + phrase writing. */
export const OPEN_WINDOW = {
  /** Shuffled opening moments are spread across this progress range. */
  start: 0.5,
  end: 0.9,
  /** Pop-out duration at the cocoon slot. */
  popP: 0.015,
  /** Flight from the slot to the first phrase point. */
  flyP: 0.03,
  /** How long a butterfly takes to trace its slice before settling on it. */
  settleP: 0.035,
  /** Particle burst duration when a cocoon opens. */
  burstP: 0.014,
} as const;

/** Session storage keys for palette/phrase persistence. */
export const GARDEN_BAG_KEY = 'valuable-garden-bag';
export const GARDEN_PHRASE_BAG_KEY = 'valuable-garden-phrase-bag';
