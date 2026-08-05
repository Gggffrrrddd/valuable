import { lazy, Suspense } from 'react';
import HourglassVisual from './HourglassVisual';
import JarVisual from './JarVisual';
import TreeVisual from './TreeVisual';
import type { FocusVisualProps, FocusVisualTheme } from './types';

const BladeVisual = lazy(() => import('./BladeVisual'));
const ButterflyMosaicVisual = lazy(() => import('./ButterflyMosaicVisual'));

export default function FocusVisual({ theme, progress, duration, running, leafAsset }: FocusVisualProps & { theme: FocusVisualTheme; duration?: number }) {
  if (theme === 'tree') return <TreeVisual progress={progress} duration={duration ?? 0} leafAsset={leafAsset} />;
  if (theme === 'butterfly') return <Suspense fallback={<div className="h-full w-full animate-pulse rounded-full bg-white/[.03]" />}><ButterflyMosaicVisual progress={progress} duration={duration ?? 0} /></Suspense>;
  if (theme === 'jar') return <JarVisual progress={progress} running={running} />;
  if (theme === 'blade') return <Suspense fallback={<div className="h-full w-full animate-pulse rounded-full bg-white/[.03]" />}><BladeVisual progress={progress} running={running} duration={duration} /></Suspense>;
  return <HourglassVisual progress={progress} duration={duration ?? 0} running={running ?? false} />;
}
