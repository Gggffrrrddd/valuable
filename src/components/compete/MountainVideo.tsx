import type { VideoTransform } from './videoConfig';

export default function MountainVideo({ transform }: { transform: VideoTransform }) {
  return (
    <video
      src="/visuals/compete/everest.mp4"
      autoPlay
      muted
      loop
      playsInline
      className="absolute inset-0 h-full w-full object-cover"
      style={{
        transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.zoom})`,
      }}
    />
  );
}
