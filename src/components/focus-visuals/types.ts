export interface FocusVisualProps {
  progress: number;
  running?: boolean;
  leafAsset?: string;
}

export type FocusVisualTheme = 'hourglass' | 'tree' | 'jar' | 'blade' | 'horse';

export const FOCUS_VISUAL_THEMES: { id: FocusVisualTheme; label: string; description: string }[] = [
  { id: 'hourglass', label: 'Hourglass', description: 'Watch the moment settle' },
  { id: 'tree', label: 'Growing Tree', description: 'Let each leaf drift away' },
  { id: 'jar', label: 'Water Jar', description: 'Fill the vessel slowly' },
  { id: 'horse', label: 'Starlight Horse', description: 'Ignite a constellation point by point' },
  { id: 'blade', label: 'Spin Blade', description: 'Let momentum carry the session' },
];
