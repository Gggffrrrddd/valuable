export interface FocusVisualProps {
  progress: number;
  running?: boolean;
  leafAsset?: string;
  onFinaleComplete?: () => void;
}

export type FocusVisualTheme = 'hourglass' | 'tree' | 'jar' | 'blade' | 'butterfly';

export const FOCUS_VISUAL_THEMES: { id: FocusVisualTheme; label: string; description: string }[] = [
  { id: 'hourglass', label: 'Hourglass', description: 'Watch the moment settle' },
  { id: 'tree', label: 'Growing Tree', description: 'Let each leaf drift away' },
  { id: 'jar', label: 'Water Jar', description: 'Fill the vessel slowly' },
  { id: 'butterfly', label: 'Starlight Butterfly', description: 'Butterflies write your phrase in the stars' },
  { id: 'blade', label: 'Spin Blade', description: 'Let momentum carry the session' },
];
