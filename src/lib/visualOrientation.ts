/** Real landscape for active visuals: fullscreen first, then orientation lock. */
export async function enterVisualLandscape() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    }
  } catch {
    /* Fullscreen can be blocked without a user gesture; lock below may fail. */
  }

  // Desktop keeps its existing fullscreen-only behavior.
  if (!window.matchMedia("(pointer: coarse)").matches) return;

  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (mode: "landscape") => Promise<void>;
    };
    await orientation.lock?.("landscape");
  } catch {
    /* Unsupported (e.g. iOS Safari) — device rotation stays natural. */
  }
}

export function exitVisualLandscape() {
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      unlock?: () => void;
    };
    orientation.unlock?.();
  } catch {
    /* unsupported */
  }
}
