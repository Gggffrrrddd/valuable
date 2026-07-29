import BookVisual from './BookVisual';
import HourglassVisual from './HourglassVisual';
import JarVisual from './JarVisual';
import TreeVisual from './TreeVisual';
import type { FocusVisualProps, FocusVisualTheme } from './types';

export default function FocusVisual({ theme, progress, duration, running, remaining }: FocusVisualProps & { theme: FocusVisualTheme; duration?: number; running?: boolean; remaining?: number }) {
  if (theme === 'tree') return <TreeVisual progress={progress} />;
  if (theme === 'book') return <BookVisual progress={progress} />;
  if (theme === 'jar') return <JarVisual progress={progress} />;
  return <HourglassVisual progress={progress} duration={duration ?? 0} running={running ?? false} remaining={remaining ?? 0} />;
}
