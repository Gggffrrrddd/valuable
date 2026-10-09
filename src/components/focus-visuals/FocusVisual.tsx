import { lazy, Suspense } from 'react';
import HourglassVisual from './HourglassVisual';
import JarVisual from './JarVisual';
import TreeVisual from './TreeVisual';
import ButterflyConstellationVisual from './ButterflyConstellationVisual';
import type { FocusVisualProps, FocusVisualTheme } from './types';
import { ModelLoadingShimmer, ModelVisualErrorBoundary } from './model-core';

const BladeVisual = lazy(() => lazyVisual(() => import('./BladeVisual')));
const SolarSystemVisual = lazy(() => lazyVisual(() => import('./SolarSystemVisual')));

/**
 * Chunk-load hardening. A lazy visual chunk can 404 when the browser runs a
 * stale bundle (old index.html referencing pruned chunks) or when the CDN
 * briefly serves a cached 404 mid-deploy. Retry the import twice first, then
 * do a single session-guarded reload to fetch a consistent bundle; only if
 * that still fails does the error reach the boundary fallback.
 */
const CHUNK_RELOAD_KEY = 'valuable-chunk-reloaded';

function alreadyReloaded(): boolean {
  try {
    return !!sessionStorage.getItem(CHUNK_RELOAD_KEY);
  } catch {
    return true; // storage broken: skip reload, go straight to fallback
  }
}

function markReloaded(): void {
  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  } catch {
    /* storage unavailable — fallback will handle it */
  }
}

function lazyVisual<T>(factory: () => Promise<T>): Promise<T> {
  const tryImport = (left: number): Promise<T> =>
    factory().catch((error: unknown) => {
      if (left > 0) {
        return new Promise<T>((resolve, reject) => {
          setTimeout(() => {
            tryImport(left - 1).then(resolve, reject);
          }, 800);
        });
      }
      if (!alreadyReloaded()) {
        markReloaded();
        window.location.reload();
        return new Promise<T>(() => undefined);
      }
      throw error;
    });
  return tryImport(2);
}

/**
 * Model-based visuals (blade, ?) are wrapped in ModelVisualErrorBoundary:
 * asset failures are handled inside each visual via model-core state, and any
 * unexpected render crash still degrades to the Hourglass instead of taking
 * down the focus session UI.
 */
export default function FocusVisual({ theme, progress, duration, running, leafAsset, depth }: FocusVisualProps & { theme: FocusVisualTheme; duration?: number }) {
  if (theme === 'tree') return <TreeVisual progress={progress} duration={duration ?? 0} leafAsset={leafAsset} />;
  if (theme === 'butterfly') return <ButterflyConstellationVisual progress={progress} running={running} />;
  if (theme === 'jar') return <JarVisual progress={progress} running={running} />;
  if (theme === 'solar-system') {
    return (
      <ModelVisualErrorBoundary visualLabel="Solar System" progress={progress} running={running} duration={duration ?? 0}>
        <Suspense fallback={<ModelLoadingShimmer label="Solar System" />}>
          <SolarSystemVisual progress={progress} running={running} depth={depth} />
        </Suspense>
      </ModelVisualErrorBoundary>
    );
  }
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
