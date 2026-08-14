import { useEffect, useState } from 'react';
import { Texture, TextureLoader } from 'three';
import type { Group } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Shared, robust asset loading for every 3D model visual.
 *
 * Guarantees:
 * - NEVER throws: every failure (missing file, network error, malformed data)
 *   is captured into the returned `error` state.
 * - Results are cached per URL, so the same model/texture used by several
 *   components (e.g. a model + its reflection) is fetched and parsed once.
 * - Failed loads are evicted from the cache so a retry can succeed later.
 */

export interface AssetState<T> {
  asset: T | null;
  isLoading: boolean;
  error: Error | null;
}

type LoaderKind = 'obj' | 'glb' | 'texture';

interface CacheEntry {
  promise: Promise<unknown>;
  label: string;
}

const assetCache = new Map<string, CacheEntry>();

function kindForUrl(url: string): LoaderKind {
  const path = url.split(/[?#]/)[0].toLowerCase();
  if (path.endsWith('.glb') || path.endsWith('.gltf')) return 'glb';
  if (path.endsWith('.obj')) return 'obj';
  return 'texture';
}

async function loadAssetUncached(url: string, kind: LoaderKind): Promise<unknown> {
  if (kind === 'obj') {
    const root = await new OBJLoader().loadAsync(url);
    if (!root.children.length) throw new Error('model contains no renderable geometry');
    return root;
  }
  if (kind === 'glb') {
    const gltf = await new GLTFLoader().loadAsync(url);
    if (!gltf.scene.children.length) throw new Error('model contains no renderable geometry');
    return gltf.scene;
  }
  return new TextureLoader().loadAsync(url);
}

function loadAssetShared(url: string): { promise: Promise<unknown>; label: string } {
  const cached = assetCache.get(url);
  if (cached) return cached;
  const label = describeAsset(url);
  const entry: CacheEntry = {
    label,
    promise: loadAssetUncached(url, kindForUrl(url)).catch((cause) => {
      // Evict the failure so a later retry is not poisoned by this result.
      assetCache.delete(url);
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`Failed to load ${label}: ${url} — ${message}`);
    }),
  };
  assetCache.set(url, entry);
  return entry;
}

function describeAsset(url: string): string {
  const kind = kindForUrl(url);
  if (kind === 'texture') return 'texture';
  return 'model';
}

/**
 * Imperative, promise-based loader (same shared cache as the hooks).
 * Use inside effects when a component needs both a model and derived data
 * (e.g. surface points) in one async flow. Never throws a bare network error:
 * the rejection message always names the asset kind and URL.
 */
export async function loadModel(url: string): Promise<Group> {
  const { promise } = loadAssetShared(url);
  return promise as Promise<Group>;
}

export async function loadTexture(url: string): Promise<Texture> {
  const { promise } = loadAssetShared(url);
  return promise as Promise<Texture>;
}

/** Warm the shared cache ahead of time (e.g. at module scope or on hover). */
export function preloadAssets(...urls: string[]): void {
  for (const url of urls) {
    loadAssetShared(url).promise.catch(() => undefined);
  }
}

function useSharedAsset<T>(url: string | null | undefined): AssetState<T> {
  const [state, setState] = useState<AssetState<T>>({ asset: null, isLoading: !!url, error: null });

  useEffect(() => {
    if (!url) {
      setState({ asset: null, isLoading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ asset: null, isLoading: true, error: null });
    loadAssetShared(url)
      .promise.then((asset) => {
        if (!cancelled) setState({ asset: asset as T, isLoading: false, error: null });
      })
      .catch((error: unknown) => {
        const wrapped = error instanceof Error ? error : new Error(String(error));
        console.error(wrapped.message);
        if (!cancelled) setState({ asset: null, isLoading: false, error: wrapped });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}

/**
 * Load any `.obj` / `.glb` / `.gltf` model by path.
 * Returns `{ model, isLoading, error }`; consuming visuals must handle all
 * three states explicitly (shimmer while loading, graceful fallback on error).
 */
export function useModelLoader(url: string | null | undefined): {
  model: Group | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { asset, isLoading, error } = useSharedAsset<Group>(url);
  return { model: asset, isLoading, error };
}

/** Load a texture image by path with the same error/loading contract. */
export function useTextureLoader(url: string | null | undefined): {
  texture: Texture | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { asset, isLoading, error } = useSharedAsset<Texture>(url);
  return { texture: asset, isLoading, error };
}
