export interface FocusVisualProps {
  progress: number;
  running?: boolean;
  bladeCalibration?: BladeCalibration;
}

export interface BladeCalibration {
  scale: number;
  x: number;
  y: number;
  z: number;
  tilt: number;
}

export type FocusVisualTheme = 'hourglass' | 'tree' | 'book' | 'jar' | 'blade';

export const FOCUS_VISUAL_THEMES: { id: FocusVisualTheme; label: string; description: string }[] = [
  { id: 'hourglass', label: 'Hourglass', description: 'Watch the moment settle' },
  { id: 'tree', label: 'Growing Tree', description: 'Let each leaf drift away' },
  { id: 'book', label: "The Reader's Book", description: 'Turn focus into pages' },
  { id: 'jar', label: 'Water Jar', description: 'Fill the vessel slowly' },
  { id: 'blade', label: 'Spin Blade', description: 'Let momentum carry the session' },
];
