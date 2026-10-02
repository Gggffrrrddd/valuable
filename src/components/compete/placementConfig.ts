/**
 * Shared placement config for the Compete climb view: the background video
 * and the image overlay each get their own transform + tuner rows.
 */

/** Placement transform — shifts are in % of the element box. */
export interface PlacementTransform {
  /** Horizontal shift (negative = left). */
  x: number;
  /** Vertical shift (negative = up). */
  y: number;
  zoom: number;
}

export interface SliderRow {
  key: keyof PlacementTransform;
  label: string;
  min: number;
  max: number;
  step: number;
}

export const DEFAULT_VIDEO_TRANSFORM: PlacementTransform = { x: 0, y: 0, zoom: 1 };
export const DEFAULT_IMAGE_TRANSFORM: PlacementTransform = { x: 0, y: 0, zoom: 1 };

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
