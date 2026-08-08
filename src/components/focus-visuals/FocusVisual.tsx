import BookVisual from './BookVisual';
import HourglassVisual from './HourglassVisual';
import JarVisual from './JarVisual';
import TreeVisual from './TreeVisual';
import ButterflyMosaicVisual from './ButterflyMosaicVisual';
import type { FocusVisualProps, FocusVisualTheme } from './types';

export default function FocusVisual({ theme, progress, duration, running }: FocusVisualProps & { theme: FocusVisualTheme; duration?: number; running?: boolean; leafAsset?: string }) {
  if (theme === 'tree') return <TreeVisual progress={progress} />;
  if (theme === 'book') return <BookVisual progress={progress} />;
  if (theme === 'jar') return <JarVisual progress={progress} />;
  if (theme === 'horse') return <ButterflyMosaicVisual progress={progress} duration={duration ?? 0} />;
  return <HourglassVisual progress={progress} duration={duration ?? 0} running={running ?? false} />;
}
