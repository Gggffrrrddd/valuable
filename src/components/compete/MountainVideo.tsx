import { useEffect, useMemo, useRef } from 'react';
import { buildVideoMask, type PlacementTransform, type VideoMask } from './placementConfig';

/**
 * Background video for the Compete view.
 *
 * Instead of chroma-keying the background out by colour (which can leave a
 * fringe / colour shift), the background is handled with a purely geometric
 * CSS mask: an opaque safe zone covers the tree, the top/sides fade out to
 * the box edges, and the bottom strip stays fully opaque where the soil
 * layer sits on top. No pixel of the video is ever recoloured.
 */
export default function MountainVideo({
  transform,
  mask,
  progress = 1,
}: {
  transform: PlacementTransform;
  mask: VideoMask;
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
        video.currentTime = video.duration * progress;
      }
    };

    if (video.readyState >= 1) {
      setTime();
    } else {
      video.addEventListener('loadedmetadata', setTime);
      return () => video.removeEventListener('loadedmetadata', setTime);
    }
  }, [progress]);

  return (
    <video
      ref={videoRef}
      src="/visuals/compete/everest.mp4"
      muted
      playsInline
      className="absolute inset-0 h-full w-full object-cover"
      style={{
        transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.zoom})`,
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
