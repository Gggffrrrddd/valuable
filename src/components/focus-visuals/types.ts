export interface FocusVisualProps {
  progress: number;
  running?: boolean;
  leafAsset?: string;
}

export type FocusVisualTheme = 'hourglass' | 'tree' | 'jar' | 'blade' | 'horse';

/**
 * Each visual owns a signature hue — the app's multi-color accent system.
 * Hues are muted/desaturated to sit on the deep-violet base.
 */
export interface FocusVisualThemeMeta {
  id: FocusVisualTheme;
  label: string;
  description: string;
  hue: string;
  preview: string;
}

export const FOCUS_VISUAL_THEMES: FocusVisualThemeMeta[] = [
  { id: 'hourglass', label: 'Hourglass', description: 'Watch the moment settle', hue: '#D4AF7F', preview: '/visuals/hourglass/hourglass-preview.png' },
  { id: 'tree', label: 'Growing Tree', description: 'Let each leaf drift away', hue: '#8FBC7F', preview: '/visuals/tree/tree-preview.png' },
  { id: 'jar', label: 'Water Jar', description: 'Fill the vessel slowly', hue: '#6FB5A8', preview: '/visuals/jar/jar-preview.png' },
  { id: 'horse', label: 'Starlight Horse', description: 'Ignite a constellation point by point', hue: '#7C9FE8', preview: '/visuals/horse/real-horse.png' },
  { id: 'blade', label: 'Spin Blade', description: 'Let momentum carry the session', hue: '#C98B5E', preview: '/visuals/blade/blade-preview.png' },
];
