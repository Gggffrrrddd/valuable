export const MIN_FOCUS_MINUTES = 10;
export const MIN_BREAK_MINUTES = 5;

export function clampFocusMinutes(value: number): number {
  const n = Number.isFinite(value) ? value : MIN_FOCUS_MINUTES;
  return Math.max(MIN_FOCUS_MINUTES, n);
}

export function clampBreakMinutes(value: number): number {
  const n = Number.isFinite(value) ? value : MIN_BREAK_MINUTES;
  return Math.max(MIN_BREAK_MINUTES, n);
}
