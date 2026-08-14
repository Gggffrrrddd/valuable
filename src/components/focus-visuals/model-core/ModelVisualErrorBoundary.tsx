import { Component } from 'react';
import type { ReactNode } from 'react';
import ModelVisualFallback from './ModelVisualFallback';
import type { ModelVisualFallbackProps } from './ModelVisualFallback';

/**
 * Last line of defense for model visuals. Load errors are already caught by
 * useModelLoader/useSurfacePoints (state-based), but anything thrown during
 * rendering (e.g. WebGL context loss inside the Canvas) is caught here and
 * converted into the Hourglass fallback — the rest of the app (timer,
 * flip-clock, session logging) is never affected.
 */

interface ModelVisualErrorBoundaryProps extends Omit<ModelVisualFallbackProps, 'reason'> {
  children: ReactNode;
}

interface ModelVisualErrorBoundaryState {
  error: Error | null;
}

export default class ModelVisualErrorBoundary extends Component<
  ModelVisualErrorBoundaryProps,
  ModelVisualErrorBoundaryState
> {
  state: ModelVisualErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ModelVisualErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown) {
    console.error(
      `[${this.props.visualLabel}] Visual crashed during render — falling back to Hourglass.`,
      error,
    );
  }

  render() {
    if (this.state.error) {
      const { visualLabel, progress, running, duration } = this.props;
      return (
        <ModelVisualFallback
          visualLabel={visualLabel}
          reason={this.state.error}
          progress={progress}
          running={running}
          duration={duration}
        />
      );
    }
    return this.props.children;
  }
}
