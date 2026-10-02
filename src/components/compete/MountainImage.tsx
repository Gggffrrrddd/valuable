import type { PlacementTransform } from './placementConfig';

export default function MountainImage({ transform }: { transform: PlacementTransform }) {
  return (
    <img
      src="/visuals/compete/overlay.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      style={{
        transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.zoom})`,
      }}
    />
  );
}
