import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  buildVideoMask,
  DEFAULT_VIDEO_MASK,
  type PlacementTransform,
  type VideoMask,
} from "./placementConfig";

/**
 * Daily-tree background video for the Compete view.
 *
 * The boy-watering-tree clip is a DAILY ritual: `progress` (0..1) is today's
 * tracked focus vs the daily target, and the video seeks to the matching
 * frame — 0 = bare seedling, 1 = fully grown tree with fruit.
 *
 * Instead of chroma-keying the background by colour (which can leave a
 * fringe / colour shift), the background is handled with a purely geometric
 * CSS mask: an opaque safe zone covers the tree and the top/sides fade out
 * to the box edges. No pixel of the video is ever recoloured.
 */
export default function TreeVideo({
  transform,
  mask = DEFAULT_VIDEO_MASK,
  progress = 1,
  preview = false,
}: {
  transform: PlacementTransform;
  mask?: VideoMask;
  progress?: number;
  preview?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const target = Math.min(1, Math.max(0, progress));
  /** Last frame shown, so a refresh eases from the old stage to the new one. */
  const shownRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  const { image, size, repeat } = useMemo(() => buildVideoMask(mask), [mask]);

  const seekTo = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) return;
    if (Number.isFinite(video.duration) && video.duration > 0) {
      try {
        video.currentTime = video.duration * value;
      } catch {
        /* slow mobile networks may reject early seeks — canplay retries */
      }
    }
  }, []);

  // The first frame can arrive after metadata; always restore the latest
  // progress (and any in-flight easing) when the clip becomes seekable.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const setTime = () => {
      if (!preview) seekTo(shownRef.current);
    };
    if (video.readyState >= 1) setTime();
    video.addEventListener("loadedmetadata", setTime);
    video.addEventListener("canplay", setTime);
    return () => {
      video.removeEventListener("loadedmetadata", setTime);
      video.removeEventListener("canplay", setTime);
    };
  }, [seekTo, preview]);

  // Before Start, play the clip once at half speed and hold the full-bloom
  // frame (never loop back to the seedling). Start pauses it and hands the
  // playhead to today's progress (the normal growth behavior).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!preview) {
      video.loop = false;
      video.pause();
      seekTo(shownRef.current);
      return;
    }

    video.loop = false;
    video.playbackRate = 0.5;
    const stopAtBloom = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const bloom = video.duration * 0.97;
      if (video.currentTime >= bloom) {
        video.pause();
        try {
          video.currentTime = bloom;
        } catch {
          /* last frame is already visible */
        }
      }
    };
    video.addEventListener("timeupdate", stopAtBloom);
    void video.play().catch(() => {
      /* muted autoplay can still be blocked; first frame stays visible */
    });
    return () => video.removeEventListener("timeupdate", stopAtBloom);
  }, [preview, seekTo]);

  // Ease the video playhead to the new progress instead of cutting to it.
  // The displayed value tracks every tick, while actual seeks are throttled
  // so mobile browsers are not flooded with decoder requests.
  useEffect(() => {
    if (preview) {
      shownRef.current = target;
      return;
    }
    const from = shownRef.current;
    const to = target;
    if (Math.abs(to - from) < 0.001) {
      shownRef.current = to;
      seekTo(to);
      return;
    }

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const started = performance.now();
    const DURATION_MS = 900;
    let lastSeek = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (to - from) * eased;
      shownRef.current = value;

      if (now - lastSeek >= 70 || t === 1) {
        seekTo(value);
        lastSeek = now;
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        shownRef.current = to;
        seekTo(to);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [target, seekTo, preview]);

  return (
    <video
      ref={videoRef}
      src="/visuals/compete/tree-growth-2.mp4"
      muted
      playsInline
      preload="auto"
      autoPlay={preview}
      loop={false}
      className="absolute inset-0 h-full w-full object-cover"
      style={{
        transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.zoom}) rotate(${transform.rot ?? 0}deg)`,
        // screen blend: the video's near-black background becomes exactly the
        // app background behind it, so no dark halo is visible in the fade zone
        mixBlendMode: "screen",
        maskImage: image,
        WebkitMaskImage: image,
        maskSize: size,
        WebkitMaskSize: size,
        maskRepeat: repeat,
        WebkitMaskRepeat: repeat,
      }}
    />
  );
}
