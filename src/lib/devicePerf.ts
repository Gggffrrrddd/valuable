/*
 * Device-aware quality gate for the heavy 3D visuals (Solar System, Study
 * Table). Budget Android phones render through a WebView GPU that chokes on
 * full devicePixelRatio + antialiasing + shadow maps + TIFF decodes, so those
 * cost centers are switched off ONLY when there is a positive low-end signal.
 *
 * Rules (deliberately conservative — unknown devices stay high quality):
 * - Fine-pointer devices (desktop/laptop) are ALWAYS 'high' → desktop is
 *   pixel-identical to before, zero behavior change.
 * - Coarse-pointer (touch) devices are 'low' only with a positive signal:
 *   hardwareConcurrency <= 4 cores, or deviceMemory <= 4 GB (when exposed).
 *   iPhones (6 cores, no deviceMemory API) and capable Androids stay 'high'.
 *
 * Everything here is static per page load (memoized); no listeners, no
 * re-renders, never throws.
 */

export type DeviceQuality = 'high' | 'low';

export function isCoarsePointer(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches
    );
  } catch {
    return false;
  }
}

let cached: DeviceQuality | null = null;

export function getDeviceQuality(): DeviceQuality {
  if (cached) return cached;
  let low = false;
  try {
    if (isCoarsePointer() && typeof navigator !== 'undefined') {
      const cores = (navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency;
      const memGB = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      if (typeof cores === 'number' && cores <= 4) low = true;
      else if (typeof memGB === 'number' && memGB <= 4) low = true;
      // Unknown specs (e.g. iOS: no deviceMemory API) stay HIGH — never
      // punish a capable device we cannot measure.
    }
  } catch {
    low = false;
  }
  cached = low ? 'low' : 'high';
  return cached;
}

/** Test hook: forget the memoized verdict (unit tests / hot-swap). */
export function resetDeviceQualityCache(): void {
  cached = null;
}
