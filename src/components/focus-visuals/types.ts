export interface FocusVisualProps {
  progress: number;
  running?: boolean;
  leafAsset?: string;
  onFinaleComplete?: () => void;
  /** Solar System only: 0 = pushed front (close), 1 = pushed back (far). */
  depth?: number;
}

export type FocusVisualTheme = 'hourglass' | 'tree' | 'jar' | 'aquarium' | 'blade' | 'butterfly' | 'solar-system';

export const FOCUS_VISUAL_THEMES: { id: FocusVisualTheme; label: string; description: string }[] = [
  { id: 'hourglass', label: 'Hourglass', description: 'Watch the moment settle' },
  { id: 'tree', label: 'Growing Tree', description: 'Let each leaf drift away' },
  { id: 'aquarium', label: 'Aquarium', description: 'Fill the tank slowly' },
  { id: 'butterfly', label: 'Starlight Butterfly', description: 'Butterflies write your phrase in the stars' },
  { id: 'blade', label: 'Spin Blade', description: 'Let momentum carry the session' },
  { id: 'solar-system', label: 'Solar System', description: 'A cold, awe-inspiring cosmic void' },
];
