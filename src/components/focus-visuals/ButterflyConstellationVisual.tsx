import type { FocusVisualProps } from './types';

/** Artwork shown in place of the constellation canvas. */
const ART_URL = '/visuals/butterfly/butterfly-art.png';

/** Placement tuned live and hardcoded — tuner removed. */
const ART_TRANSFORM = {
  scale: 0.98,
  positionX: -2.2,
  positionY: 5.4,
};

/**
 * Butterfly visual, art pass: the provided butterfly artwork fills the
 * frame with the final tuned placement. TODO(real pass): layer the
 * constellation/star choreography and name reveal on top of this art.
 */
export default function ButterflyConstellationVisual(_props: FocusVisualProps) {
  void _props; // progress/running contract kept for FocusVisual; art pass ignores them

  return (
    <div className="butterfly-constellation focus-visual overflow-hidden" role="img" aria-label="Butterfly constellation">
      <img
        src={ART_URL}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-contain"
        style={{
          transform: `translate(${ART_TRANSFORM.positionX}%, ${ART_TRANSFORM.positionY}%) scale(${ART_TRANSFORM.scale})`,
        }}
      />
    </div>
  );
}
