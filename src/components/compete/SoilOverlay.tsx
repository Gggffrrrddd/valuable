import type { PlacementTransform } from './placementConfig';

/**
 * Static soil overlay for the daily-tree view: sits over the bottom portion
 * of the video, hiding the trunk/soil artifact. The mound has an organic,
 * feathered silhouette so it dissolves into the scene without a hard line.
 */
export default function SoilOverlay({ transform }: { transform: PlacementTransform }) {
  return (
    <img
      src="/visuals/compete/overlay-2.png"
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
