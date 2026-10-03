import type { PlacementTransform } from './placementConfig';

/**
 * Static soil overlay for the daily-tree view: sits over the bottom portion
 * of the video, hiding the trunk/soil artifact. Its top edge carries a soft
 * alpha ramp (baked into the PNG) so it dissolves into the video instead of
 * cutting a hard line.
 */
export default function SoilOverlay({ transform }: { transform: PlacementTransform }) {
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
