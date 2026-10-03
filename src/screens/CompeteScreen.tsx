import { useState } from 'react';
import MountainVideo from '@/components/compete/MountainVideo';
import MountainImage from '@/components/compete/MountainImage';
import PlacementTuner from '@/components/compete/PlacementTuner';
import {
  DEFAULT_VIDEO_TRANSFORM,
  DEFAULT_IMAGE_TRANSFORM,
  DEFAULT_VIDEO_MASK,
  VIDEO_SLIDER_ROWS,
  IMAGE_SLIDER_ROWS,
  MASK_SLIDER_ROWS,
  type PlacementTransform,
  type VideoMask,
} from '@/components/compete/placementConfig';

/**
 * Compete section: the climb view IS the screen — video (masked by a purely
 * geometric CSS gradient, no colour keying) under the soil image overlay,
 * with live placement/mask tuners and a progress scrubber.
 */
export default function CompeteScreen() {
  const [videoTransform, setVideoTransform] = useState<PlacementTransform>(
    DEFAULT_VIDEO_TRANSFORM,
  );
  const [imageTransform, setImageTransform] = useState<PlacementTransform>(
    DEFAULT_IMAGE_TRANSFORM,
  );
  const [videoMask, setVideoMask] = useState<VideoMask>(DEFAULT_VIDEO_MASK);
  const [progress, setProgress] = useState(1);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MountainVideo transform={videoTransform} mask={videoMask} progress={progress} />
      <MountainImage transform={imageTransform} />
      <div className="absolute bottom-4 right-4 z-20 flex w-60 flex-col gap-3 sm:bottom-6 sm:right-6">
        <div className="rounded-[1.2rem] border border-white/[.07] bg-black/40 p-4 backdrop-blur-xl">
          <label className="block">
            <span className="flex items-center justify-between text-xs font-bold text-stone-300">
              Progress
              <span className="font-mono text-[10px] text-stone-500">
                {(progress * 100).toFixed(0)}%
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="mt-1.5 w-full accent-lime-300"
            />
          </label>
        </div>
        <PlacementTuner
          title="Video tuner"
          logTag="compete-video"
          rows={VIDEO_SLIDER_ROWS}
          defaults={DEFAULT_VIDEO_TRANSFORM}
          transform={videoTransform}
          onChange={(patch) => setVideoTransform((t) => ({ ...t, ...patch }))}
        />
        <PlacementTuner
          title="Mask tuner"
          logTag="compete-mask"
          rows={MASK_SLIDER_ROWS}
          defaults={DEFAULT_VIDEO_MASK}
          transform={videoMask}
          onChange={(patch) => setVideoMask((m) => ({ ...m, ...patch }))}
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
