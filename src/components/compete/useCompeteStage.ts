import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Fixed portrait stage for the Compete scene (~9:19 reference).
 *
 * Every scene element (tree, soil, dreams, plus) lives inside a constant
 * 405×855 box and is positioned relative to the STAGE — never to the raw
 * viewport. The stage is contain-fit scaled (scale = min(cw/405, ch/855))
 * and centered, so the full composition stays intact on any screen with no
 * stretch and no crop. Leftover letterbox is covered by sky/soil background
 * fills behind the stage (see index.css), so it reads as one scene.
 *
 * Pinch-to-zoom layers on top: 1x = contain-fit resting state. Max zoom is
 * coverScale/containScale computed per device (zoom only ever eats the
 * background-fill padding first). Pan is clamped so the stage always covers
 * the viewport; zoom snaps back to fit at 1x. Mounting fresh (section
 * reopened — App unmounts this tab on switch) resets automatically, and
 * double-tap/double-click resets instantly. Gestures are scoped to the
 * stage (touch-action:none there only) — page/nav/browser zoom untouched.
 *
 * Perf: the stage transform is written straight to the DOM (no React
 * re-renders per pointer move); only the container size lives in state.
 */

/** Reference stage size (~9:19 portrait). */
export const COMPETE_REF_W = 405;
export const COMPETE_REF_H = 855;

interface StageGeom {
  /** Contain-fit scale for the measured container. */
  s: number;
  /** Centered top-left of the unzoomed stage, container px. */
  ox: number;
  oy: number;
  /** Dynamic max zoom: cover-fit scale ÷ contain-fit scale. */
  maxZ: number;
  cw: number;
  ch: number;
}

export function useCompeteStage() {
  const fitRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  // View lives in a ref (mutated per pointer move, applied straight to DOM).
  const view = useRef({ z: 1, px: 0, py: 0 });
  const geom = useRef<StageGeom>({ s: 1, ox: 0, oy: 0, maxZ: 1, cw: 0, ch: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number; sx: number; sy: number }>());
  const pinch = useRef<null | { d0: number; z0: number; mx: number; my: number; px: number; py: number }>(null);
  const capturedRef = useRef(false);

  // Measure the fit container (content box, non-zero gated like elsewhere).
  useEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      const w = rect ? rect.width : 0;
      const h = rect ? rect.height : 0;
      if (w < 1 || h < 1) return;
      setBox((prev) =>
        Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Recompute geometry when the container changes; re-seat the stage.
  useEffect(() => {
    if (box.w < 1 || box.h < 1) return;
    const s = Math.min(box.w / COMPETE_REF_W, box.h / COMPETE_REF_H);
    const cover = Math.max(box.w / COMPETE_REF_W, box.h / COMPETE_REF_H);
    geom.current = {
      s,
      ox: (box.w - COMPETE_REF_W * s) / 2,
      oy: (box.h - COMPETE_REF_H * s) / 2,
      maxZ: Math.max(1, cover / Math.max(0.0001, s)),
      cw: box.w,
      ch: box.h,
    };
    applyView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box.w, box.h]);

  function clampPan(px: number, py: number, z: number): { x: number; y: number } {
    const g = geom.current;
    const Wz = COMPETE_REF_W * g.s * z;
    const Hz = COMPETE_REF_H * g.s * z;
    // Centered resting offsets for this zoom.
    const cx = g.cw / 2 - g.ox - Wz / 2;
    const cy = g.ch / 2 - g.oy - Hz / 2;
    let nx = cx;
    let ny = cy;
    if (Wz > g.cw) nx = Math.min(-g.ox, Math.max(g.cw - g.ox - Wz, px));
    if (Hz > g.ch) ny = Math.min(-g.oy, Math.max(g.ch - g.oy - Hz, py));
    return { x: nx, y: ny };
  }

  function applyView() {
    const el = stageRef.current;
    if (!el) return;
    const g = geom.current;
    const v = view.current;
    el.style.transform = `translate(${g.ox + v.px}px, ${g.oy + v.py}px) scale(${g.s * v.z})`;
  }

  function resetView() {
    view.current = { z: 1, px: 0, py: 0 };
    pinch.current = null;
    pointers.current.clear();
    applyView();
  }

  function capture(el: HTMLElement | null, pointerId: number) {
    if (capturedRef.current || !el) return;
    try {
      el.setPointerCapture(pointerId);
      capturedRef.current = true;
    } catch {
      /* capture unsupported — moves still flow while over the stage */
    }
  }

  function releaseCapture(el: HTMLElement | null, pointerId: number) {
    if (!capturedRef.current || !el) return;
    capturedRef.current = false;
    try {
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    // No capture on tap: buttons inside the stage (dreams add/remove,
    // tuner) must keep receiving their clicks. Capture starts lazily on
    // real gesture movement (pan threshold or second pointer).
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    if (pointers.current.size === 2) {
      capture(e.currentTarget, e.pointerId);
      const [a, b] = Array.from(pointers.current.values());
      const d0 = Math.hypot(a.x - b.x, a.y - b.y);
      if (d0 > 0) {
        const v = view.current;
        pinch.current = {
          d0,
          z0: v.z,
          mx: (a.x + b.x) / 2,
          my: (a.y + b.y) / 2,
          px: v.px,
          py: v.py,
        };
      }
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: prev.sx, sy: prev.sy });
    const g = geom.current;
    if (pointers.current.size === 2) {
      capture(e.currentTarget, e.pointerId);
      const [a, b] = Array.from(pointers.current.values());
      const d1 = Math.hypot(a.x - b.x, a.y - b.y);
      const p = pinch.current;
      if (!p || p.d0 <= 0) return;
      const mx1 = (a.x + b.x) / 2;
      const my1 = (a.y + b.y) / 2;
      const z = Math.min(g.maxZ, Math.max(1, p.z0 * (d1 / p.d0)));
      // Pan follows the pinch midpoint so content tracks the fingers.
      const c = clampPan(p.px + (mx1 - p.mx), p.py + (my1 - p.my), z);
      view.current = { z, px: c.x, py: c.y };
      applyView();
    } else if (pointers.current.size === 1 && view.current.z > 1) {
      // Pan only past a small threshold so taps still click through.
      const moved = Math.hypot(e.clientX - prev.sx, e.clientY - prev.sy);
      if (moved < 8) return;
      capture(e.currentTarget, e.pointerId);
      const v = view.current;
      const c = clampPan(v.px + dx, v.py + dy, v.z);
      view.current = { z: v.z, px: c.x, py: c.y };
      applyView();
    }
  }

  function endPointer(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    releaseCapture(e.currentTarget, e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0 && view.current.z <= 1) {
      view.current = { z: 1, px: 0, py: 0 };
      applyView();
    }
  }

  return {
    fitRef,
    stageRef,
    stageW: COMPETE_REF_W,
    stageH: COMPETE_REF_H,
    stageProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onDoubleClick: resetView,
    },
  };
}
