import { useEffect, useMemo, useRef } from 'react';
import {
  buildVideoMask,
  DEFAULT_VIDEO_MASK,
  type PlacementTransform,
  type VideoMask,
} from './placementConfig';

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
}: {
  transform: PlacementTransform;
  mask?: VideoMask;
  progress?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { image, size, repeat } = useMemo(() => buildVideoMask(mask), [mask]);

  // drive playback position from the progress value
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const setTime = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        try {
          video.currentTime = video.duration * progress;
        } catch {
          /* slow mobile networks may reject early seeks — canplay retries */
        }
      }
    };

    // Slow networks (real mobile) often have metadata but no frame data yet;
    // retry on canplay so the 97% frame always lands.
    if (video.readyState >= 1) {
      setTime();
    }
    video.addEventListener('loadedmetadata', setTime);
    video.addEventListener('canplay', setTime);
    return () => {
      video.removeEventListener('loadedmetadata', setTime);
      video.removeEventListener('canplay', setTime);
    };
  }, [progress]);

  return (
    <video
      ref={videoRef}
      src="/visuals/compete/tree-growth-2.mp4"
      muted
      playsInline
      preload="auto"
      className="absolute inset-0 h-full w-full object-cover"
      style={{
        transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.zoom})`,
        // screen blend: the video's near-black background becomes exactly the
        // app background behind it, so no dark halo is visible in the fade zone
        mixBlendMode: 'screen',
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
