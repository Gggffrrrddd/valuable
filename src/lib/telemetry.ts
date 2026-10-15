/*
 * Release-health-lite telemetry: breadcrumbs + error capture, local-first.
 * No SDK, no backend, no migration. Never throws — every path is guarded so
 * diagnostics can never break the app.
 *
 * - Ring buffer (200 in memory, last 50 persisted to localStorage).
 * - Global `error` + `unhandledrejection` capture, installed once.
 * - Console prefix `[telemetry]`; full report via `getTelemetryReport()`
 *   (also exposed as `window.__valuableTelemetry` for mobile debugging).
 */

export interface TeleEvent {
  t: number;
  kind: 'crumb' | 'error' | 'unhandled';
  cat: string;
  msg: string;
  data?: unknown;
}

const MAX_MEM = 200;
const LS_KEY = 'valuable-telemetry';
const MAX_LS = 50;

let installed = false;
const buf: TeleEvent[] = [];

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    try {
      return String(value);
    } catch {
      return '[unserializable]';
    }
  }
}

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(buf.slice(-MAX_LS)));
  } catch {
    /* storage full/blocked — memory buffer still works */
  }
}

function push(kind: TeleEvent['kind'], cat: string, msg: string, data?: unknown) {
  try {
    buf.push({ t: Date.now(), kind, cat, msg, data });
    if (buf.length > MAX_MEM) buf.splice(0, buf.length - MAX_MEM);
    persist();
  } catch {
    /* never break the app for diagnostics */
  }
}

/** Leave a breadcrumb (navigation, session saves, fallbacks). */
export function breadcrumb(cat: string, msg: string, data?: unknown) {
  push('crumb', cat, msg, data);
}

/** Full report: persisted crumbs + guidance. Paste from console on bugs. */
export function getTelemetryReport() {
  let persisted: TeleEvent[] = [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) persisted = JSON.parse(raw) as TeleEvent[];
  } catch {
    persisted = [];
  }
  return {
    app: 'valuable',
    exportedAt: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    memoryEvents: buf.slice(),
    persistedEvents: persisted,
  };
}

/** Install global error capture once. Safe to call repeatedly. */
export function installTelemetry() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  try {
    window.addEventListener('error', (e) => {
      const err = (e as ErrorEvent).error;
      const msg = (e as ErrorEvent).message || 'unknown error';
      const stack = err && typeof err === 'object' && 'stack' in err ? String((err as Error).stack).slice(0, 2000) : undefined;
      push('error', 'global', msg, {
        filename: (e as ErrorEvent).filename,
        lineno: (e as ErrorEvent).lineno,
        colno: (e as ErrorEvent).colno,
        stack,
      });
      try {
        // eslint-disable-next-line no-console
        console.log('[telemetry] captured error:', msg);
      } catch {
        /* ignore */
      }
    });
    window.addEventListener('unhandledrejection', (e) => {
      const reason = (e as PromiseRejectionEvent).reason;
      push('unhandled', 'global', reason instanceof Error ? reason.message : String(reason), {
        stack: reason instanceof Error ? String(reason.stack).slice(0, 2000) : undefined,
      });
      try {
        // eslint-disable-next-line no-console
        console.log('[telemetry] captured unhandled rejection');
      } catch {
        /* ignore */
      }
    });
    (window as unknown as { __valuableTelemetry?: unknown }).__valuableTelemetry = {
      report: getTelemetryReport,
      breadcrumb,
    };
  } catch {
    /* ignore */
  }
}
