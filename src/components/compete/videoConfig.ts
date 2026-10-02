/** Placement transform for the Compete mountain video, tuned via the live tuner. */
export interface VideoTransform {
  /** Horizontal shift in % of the video box (negative = left). */
  x: number;
  /** Vertical shift in % of the video box (negative = up). */
  y: number;
  zoom: number;
}

export const DEFAULT_VIDEO_TRANSFORM: VideoTransform = { x: 0, y: 0, zoom: 1 };

export const VIDEO_SLIDER_ROWS: {
  key: keyof VideoTransform;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: 'zoom', label: 'Zoom', min: 0.5, max: 3, step: 0.01 },
  { key: 'x', label: 'Move X (left / right)', min: -100, max: 100, step: 1 },
  { key: 'y', label: 'Move Y (up / down)', min: -100, max: 100, step: 1 },
];
