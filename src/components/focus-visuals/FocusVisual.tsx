import BookVisual from './BookVisual';
import HourglassVisual from './HourglassVisual';
import JarVisual from './JarVisual';
import TreeVisual from './TreeVisual';
import type { FocusVisualProps, FocusVisualTheme } from './types';

export default function FocusVisual({ theme, progress }: FocusVisualProps & { theme: FocusVisualTheme }) {
  if (theme === 'tree') return <TreeVisual progress={progress} />;
  if (theme === 'book') return <BookVisual progress={progress} />;
  if (theme === 'jar') return <JarVisual progress={progress} />;
  return <HourglassVisual progress={progress} />;
}
