import { lazy, Suspense, useState } from 'react';
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
  const [bladeZoom, setBladeZoom] = useState(1);
  const [bladeX, setBladeX] = useState(0);
  const [bladeY, setBladeY] = useState(0);
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
      <>
        {/* Mobile: keep the 3D spin blade as-is. */}
        <div className="h-full w-full lg:hidden">
          <ModelVisualErrorBoundary visualLabel="Spin Blade" progress={progress} running={running} duration={duration ?? 0}>
            <Suspense fallback={<ModelLoadingShimmer label="Spin Blade" />}>
              <BladeVisual progress={progress} running={running} duration={duration} />
            </Suspense>
          </ModelVisualErrorBoundary>
        </div>
        {/* Desktop: full-bleed image with live tuner overlay. */}
        <div className="relative hidden h-full w-full items-center justify-center lg:flex">
          <img
            src="/visuals/blade/easel-moody-studio.png"
            alt="Blue Textured Canvas Pane"
            className="h-full w-full object-cover"
            style={{ transform: `translate(${bladeX}%, ${bladeY}%) scale(${bladeZoom})` }}
            draggable={false}
          />
          {/* Temporary tuner — remove once final values are set. */}
          <div className="absolute bottom-6 left-6 z-30 flex flex-col gap-2 rounded-2xl bg-black/70 px-5 py-4 backdrop-blur-sm">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Image Tuner</div>
            {([
              ['Zoom', bladeZoom, setBladeZoom, 1, 3, 0.01, 'x'],
              ['X', bladeX, setBladeX, -50, 50, 0.5, '%'],
              ['Y', bladeY, setBladeY, -50, 50, 0.5, '%'],
            ] as const).map(([label, val, set, min, max, step, unit]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-10 text-[11px] font-medium text-white/70">{label}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={val}
                  onChange={(e) => set(Number(e.target.value))}
                  className="w-36 cursor-pointer accent-lime-400"
                />
                <span className="w-12 text-right text-[11px] tabular-nums text-lime-300">{val.toFixed(2)}{unit}</span>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }
  return <HourglassVisual progress={progress} duration={duration ?? 0} running={running ?? false} />;
}
