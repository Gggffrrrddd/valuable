/**
 * model-core — the shared foundation for ALL 3D rotating-model visuals.
 *
 * ── How to add a new 3D model visual ────────────────────────────────────────
 * 1) Place model + texture files in `/public/visuals/[name]/`
 *    (e.g. `/public/visuals/lion/lion.obj`, `lion-texture.jpg`).
 * 2) Create a thin wrapper component in `src/components/focus-visuals/`
 *    (e.g. `LionVisual.tsx`) that imports ONLY from this module:
 *      - `useModelLoader(modelUrl)`       → { model, isLoading, error }
 *      - `useTextureLoader(textureUrl)`   → { texture, isLoading, error }
 *      - `useSurfacePoints(model, count)` → sampled points + normals
 *      - `createWrapTextureMaterial` / `<ModelWrapTexture />` → texturing
 *        (pass 1 texture for a simple wrap, N textures + view directions for
 *        the multi-angle directional blend)
 *      - `createSpinBehaviorController(config)` → rotation / spin-decay /
 *        topple behavior driven by session progress
 *      - `<ConstellationPoints points progress />` → star ignition effect
 *    Handle all three asset states explicitly:
 *      - `isLoading` → render `<ModelLoadingShimmer />`
 *      - `error`     → render `<ModelVisualFallback />` (auto-Hourglass)
 *      - loaded      → render the model
 *    Wrap the whole visual in `<ModelVisualErrorBoundary>` at the call site.
 * 3) Register the theme in `focus-visuals/types.ts` and wire it into
 *    `FocusVisual.tsx` — done.
 *
 * DO NOT duplicate loading / sampling / texture-wrapping / fallback logic in
 * the wrapper. If the core is missing something you need, extend the core —
 * every model visual benefits from the fix.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export {
  useModelLoader,
  useTextureLoader,
  loadModel,
  loadTexture,
  preloadAssets,
} from './useModelLoader';
export type { AssetState } from './useModelLoader';

export {
  useSurfacePoints,
  sampleSurfacePoints,
} from './useSurfacePoints';
export type { SurfacePoint, SurfacePointsOptions, SurfacePointsState } from './useSurfacePoints';

export {
  default as ModelWrapTexture,
  applyWrapTexture,
  createWrapTextureMaterial,
  defaultViewDirections,
} from './ModelWrapTexture';
export type { WrapTextureOptions } from './ModelWrapTexture';

export {
  createSpinBehaviorController,
  BLADE_SPIN_CONFIG,
} from './ProgressRotation';
export type {
  SpinBehaviorConfig,
  SpinBehaviorInput,
  SpinPose,
  SpinBehaviorController,
} from './ProgressRotation';

export {
  default as ModelVisualFallback,
  ModelLoadingShimmer,
  logModelVisualError,
} from './ModelVisualFallback';
export type { ModelVisualFallbackProps } from './ModelVisualFallback';

export { default as ModelVisualErrorBoundary } from './ModelVisualErrorBoundary';

export { default as ConstellationPoints } from './ConstellationPoints';
export type { ConstellationPointsProps } from './ConstellationPoints';

export { useReducedMotion } from './useReducedMotion';

export { smoothstep, clamp01, createGlowTexture, normalizeModel } from './canvasUtils';
