import { useEffect } from 'react';
import HourglassVisual from '../HourglassVisual';

/**
 * Graceful degradation for 3D model visuals.
 *
 * If a model visual fails to load/render for ANY reason, the user never sees
 * a blank screen or a dead-end "model unavailable" state: the visual quietly
 * falls back to the Hourglass (which has zero external assets) and shows a
 * small on-brand notice. The timer, flip-clock and session logic live outside
 * the visual, so they keep working regardless.
 */

export interface ModelVisualFallbackProps {
  /** Human-readable name of the failed visual, e.g. "Spin Blade". */
  visualLabel: string;
  /** Why the fallback was triggered (already logged at the source; kept for display). */
  reason?: Error | string | null;
  /** Pass-through props so the Hourglass continues the same session state. */
  progress: number;
  running?: boolean;
  duration?: number;
}

export function logModelVisualError(visualLabel: string, assetUrl: string, cause: Error | string | null) {
  const message = cause instanceof Error ? cause.message : cause ?? 'unknown error';
  console.error(`[${visualLabel}] Failed to load model: ${assetUrl} — ${message}`);
}

export default function ModelVisualFallback({ visualLabel, reason, progress, running, duration }: ModelVisualFallbackProps) {
  useEffect(() => {
    const message = reason instanceof Error ? reason.message : reason ?? 'unknown error';
    console.error(`[${visualLabel}] Visual unavailable, falling back to Hourglass — ${message}`);
  }, [visualLabel, reason]);

  return (
    <div className="relative h-full w-full">
      <HourglassVisual progress={progress} running={running ?? false} duration={duration ?? 0} />
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 w-max max-w-[92%] -translate-x-1/2 rounded-full border border-white/[.08] bg-black/45 px-4 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[.14em] text-stone-400 backdrop-blur-xl">
        {visualLabel} is temporarily unavailable — showing Hourglass
      </div>
    </div>
  );
}

/** On-brand loading shimmer shown while a model/texture is still loading. */
export function ModelLoadingShimmer({ label = 'Loading visual' }: { label?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <div className="h-16 w-16 animate-pulse rounded-full border border-white/[.08] bg-white/[.04] shadow-[inset_0_0_34px_rgba(255,255,255,.05)]" />
      <div className="h-px w-24 animate-pulse bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <span className="text-[10px] font-semibold uppercase tracking-[.2em] text-stone-600">{label}</span>
    </div>
  );
}
