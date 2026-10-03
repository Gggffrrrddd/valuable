import { useState } from 'react';
import MountainVideo from '@/components/compete/MountainVideo';
import MountainImage from '@/components/compete/MountainImage';
import PlacementTuner from '@/components/compete/PlacementTuner';
import {
  DEFAULT_VIDEO_TRANSFORM,
  DEFAULT_IMAGE_TRANSFORM,
  VIDEO_SLIDER_ROWS,
  IMAGE_SLIDER_ROWS,
  type PlacementTransform,
} from '@/components/compete/placementConfig';

/**
 * Compete section: the climb view IS the screen — video + image overlay with
 * live placement tuners, no setup/goal gate. Tuned values get hardcoded into
 * placementConfig once approved.
 */
export default function CompeteScreen() {
  const [videoTransform, setVideoTransform] = useState<PlacementTransform>(
    DEFAULT_VIDEO_TRANSFORM,
  );
  const [imageTransform, setImageTransform] = useState<PlacementTransform>(
    DEFAULT_IMAGE_TRANSFORM,
  );

  return (
    <div className="relative mx-auto w-full max-w-6xl pt-6 sm:pt-10">
      <div className="relative h-[70vh] min-h-[420px] overflow-hidden rounded-[1.75rem] border border-white/[.07] bg-[#090b0a]">
        <MountainVideo transform={videoTransform} />
        <MountainImage transform={imageTransform} />
      </div>
      <div className="absolute bottom-4 right-4 z-20 flex w-60 flex-col gap-3 sm:bottom-6 sm:right-6">
        <PlacementTuner
          title="Video tuner"
          logTag="compete-video"
          rows={VIDEO_SLIDER_ROWS}
          defaults={DEFAULT_VIDEO_TRANSFORM}
          transform={videoTransform}
          onChange={(patch) => setVideoTransform((t) => ({ ...t, ...patch }))}
        />
        <PlacementTuner
          title="Image tuner"
          logTag="compete-image"
          rows={IMAGE_SLIDER_ROWS}
          defaults={DEFAULT_IMAGE_TRANSFORM}
          transform={imageTransform}
          onChange={(patch) => setImageTransform((t) => ({ ...t, ...patch }))}
        />
      </div>
    </div>
  );
}
