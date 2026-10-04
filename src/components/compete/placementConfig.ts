/**
 * Shared placement config for the Compete daily-tree view: hardcoded video
 * and soil-image transforms, the video's geometric fade mask (halo — still
 * tunable), and the Progress tuner rows.
 */

/** Placement transform — shifts are in % of the element box. */
export interface PlacementTransform {
  /** Horizontal shift (negative = left). */
  x: number;
  /** Vertical shift (negative = up). */
  y: number;
  zoom: number;
}

export interface SliderRow<T extends { [K in keyof T]: number } = PlacementTransform> {
  key: keyof T & string;
  label: string;
  min: number;
  max: number;
  step: number;
}

/**
 * Geometric CSS mask for the video — position based only, no colour
 * analysis, so it can never introduce a fringe or colour shift.
 * All values are % of the video element's own box.
 */
export interface VideoMask {
  /** Horizontal semi-axis of the fully-opaque safe zone (tree lives here). */
  safeW: number;
  /** Vertical semi-axis of the fully-opaque safe zone. */
  safeH: number;
  /** Radius where mask alpha reaches 0 across the top / sides (width axis). */
  fadeW: number;
  /** Radius where mask alpha reaches 0 across the top / sides (height axis). */
  fadeH: number;
  /** Distance from the top of the box (%) where the opaque bottom strip starts. */
  bottomKeep: number;
}

/** Hardcoded video placement (read off the Video tuner). */
export const DEFAULT_VIDEO_TRANSFORM: PlacementTransform = { x: 0, y: -14, zoom: 0.5 };
/** Hardcoded soil-image placement (read off the Image tuner). */
export const DEFAULT_IMAGE_TRANSFORM: PlacementTransform = { x: -1, y: -1, zoom: 1.01 };

/** Progress tuner row: scrub today's growth (0 = seedling, 1 = full bloom). */
export interface ProgressTune {
  progress: number;
}

export const PROGRESS_SLIDER_ROWS: SliderRow<ProgressTune>[] = [
  { key: 'progress', label: 'Progress (today vs target)', min: 0, max: 1, step: 0.01 },
];

export const VIDEO_SLIDER_ROWS: SliderRow[] = [
  { key: 'zoom', label: 'Zoom', min: 0.5, max: 3, step: 0.01 },
  { key: 'x', label: 'Move X (left / right)', min: -100, max: 100, step: 1 },
  { key: 'y', label: 'Move Y (up / down)', min: -100, max: 100, step: 1 },
];

export const IMAGE_SLIDER_ROWS: SliderRow[] = [
  { key: 'zoom', label: 'Zoom', min: 0.5, max: 3, step: 0.01 },
  { key: 'x', label: 'Move X (left / right)', min: -100, max: 100, step: 1 },
  { key: 'y', label: 'Move Y (up / down)', min: -100, max: 100, step: 1 },
];

/** Default mask — hardcoded halo calibration. */
export const DEFAULT_VIDEO_MASK: VideoMask = {
  safeW: 50,
  safeH: 31.5,
  fadeW: 35,
  fadeH: 50,
  bottomKeep: 100,
};

/** Mask tuner rows: shape the fade halo around the video. */
export const MASK_SLIDER_ROWS: SliderRow<VideoMask>[] = [
  { key: 'safeW', label: 'Safe zone width', min: 10, max: 50, step: 0.5 },
  { key: 'safeH', label: 'Safe zone height', min: 10, max: 50, step: 0.5 },
  { key: 'fadeW', label: 'Fade radius (width)', min: 30, max: 70, step: 0.5 },
  { key: 'fadeH', label: 'Fade radius (height)', min: 30, max: 70, step: 0.5 },
  { key: 'bottomKeep', label: 'Bottom opaque from (%)', min: 0, max: 100, step: 0.5 },
];

/**
 * Builds the two mask layers:
 *  - layer 1: radial gradient — opaque ellipse in the safe zone, fading to
 *    transparent at the top / side edges of the box;
 *  - layer 2: linear gradient — keeps the bottom strip (soil seam) fully
 *    opaque with a clean hard edge instead of a fade.
 * The layers are unioned (CSS mask layers default to `add` / `source-over`).
 */
export function buildVideoMask(m: VideoMask): { image: string; size: string; repeat: string } {
  const fadeW = Math.max(m.fadeW, m.safeW + 1);
  const fadeH = Math.max(m.fadeH, m.safeH + 1);
  // opaque stop: guarantees alpha = 1 across both requested safe radii
  const inner = Math.min(95, Math.max(m.safeW / fadeW, m.safeH / fadeH) * 100);
  const radial = `radial-gradient(ellipse ${fadeW}% ${fadeH}% at 50% 50%, #000 ${inner.toFixed(2)}%, transparent 100%)`;
  const bottom = `linear-gradient(to bottom, transparent ${m.bottomKeep}%, #000 ${m.bottomKeep}%)`;
  return {
    image: `${radial}, ${bottom}`,
    size: '100% 100%, 100% 100%',
    repeat: 'no-repeat, no-repeat',
  };
}
