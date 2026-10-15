import { lazy, Suspense } from 'react';
import HourglassVisual from './HourglassVisual';
import JarVisual from './JarVisual';
import TreeVisual from './TreeVisual';
import ButterflyConstellationVisual from './ButterflyConstellationVisual';
import ParticlePainting from './ParticlePainting';
import type { FocusVisualProps, FocusVisualTheme } from './types';
import { ModelLoadingShimmer, ModelVisualErrorBoundary } from './model-core';

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
    // Particle Painting on every breakpoint (mobile uses fewer particles).
    // Base scene is always cover with easel-preserving anchors (Jar pattern:
    // same transform as the painting math, so they never misalign).
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-[#090b0a]">
        <img
          src="/visuals/blade/easel-base.png"
          alt="Minimalist Easel with Blank Canvas"
          className="blade-easel-base absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <ParticlePainting progress={progress} running={running ?? false} duration={duration ?? 0} />
      </div>
    );
  }
  return <HourglassVisual progress={progress} duration={duration ?? 0} running={running ?? false} />;
}
