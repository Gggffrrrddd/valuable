import { lazy, Suspense } from 'react';
import HourglassVisual from './HourglassVisual';
import JarVisual from './JarVisual';
import TreeVisual from './TreeVisual';
import type { FocusVisualProps, FocusVisualTheme } from './types';
import { ModelLoadingShimmer, ModelVisualErrorBoundary } from './model-core';

const BladeVisual = lazy(() => import('./BladeVisual'));
const HorseConstellationVisual = lazy(() => import('./HorseConstellationVisual'));

/**
 * Model-based visuals (blade, horse, …) are wrapped in ModelVisualErrorBoundary:
 * asset failures are handled inside each visual via model-core state, and any
 * unexpected render crash still degrades to the Hourglass instead of taking
 * down the focus session UI.
 */
export default function FocusVisual({ theme, progress, duration, running, leafAsset }: FocusVisualProps & { theme: FocusVisualTheme; duration?: number }) {
  if (theme === 'tree') return <TreeVisual progress={progress} duration={duration ?? 0} leafAsset={leafAsset} />;
  if (theme === 'horse') {
    return (
      <ModelVisualErrorBoundary visualLabel="Starlight Horse" progress={progress} running={running} duration={duration ?? 0}>
        <Suspense fallback={<ModelLoadingShimmer label="Starlight Horse" />}>
          <HorseConstellationVisual progress={progress} duration={duration ?? 0} />
        </Suspense>
      </ModelVisualErrorBoundary>
    );
  }
  if (theme === 'jar') return <JarVisual progress={progress} running={running} />;
  if (theme === 'blade') {
    return (
      <ModelVisualErrorBoundary visualLabel="Spin Blade" progress={progress} running={running} duration={duration ?? 0}>
        <Suspense fallback={<ModelLoadingShimmer label="Spin Blade" />}>
          <BladeVisual progress={progress} running={running} duration={duration} />
        </Suspense>
      </ModelVisualErrorBoundary>
    );
  }
  return <HourglassVisual progress={progress} duration={duration ?? 0} running={running ?? false} />;
}
