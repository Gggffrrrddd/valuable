import { lazy, Suspense } from 'react';
import BookVisual from './BookVisual';
import HourglassVisual from './HourglassVisual';
import JarVisual from './JarVisual';
import TreeVisual from './TreeVisual';
import type { FocusVisualProps, FocusVisualTheme } from './types';

const BladeVisual = lazy(() => import('./BladeVisual'));

export default function FocusVisual({ theme, progress, duration, running }: FocusVisualProps & { theme: FocusVisualTheme; duration?: number }) {
  if (theme === 'tree') return <TreeVisual progress={progress} duration={duration ?? 0} />;
  if (theme === 'book') return <BookVisual progress={progress} />;
  if (theme === 'jar') return <JarVisual progress={progress} running={running} />;
  if (theme === 'blade') return <Suspense fallback={<div className="aspect-[5/4] w-full animate-pulse rounded-full bg-white/[.03]" />}><BladeVisual progress={progress} running={running} calibrate /></Suspense>;
  return <HourglassVisual progress={progress} duration={duration ?? 0} running={running ?? false} />;
}
