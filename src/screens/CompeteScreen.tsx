import { useState } from 'react';
import MountainVideo from '@/components/compete/MountainVideo';
import MountainImage from '@/components/compete/MountainImage';
import {
  DEFAULT_VIDEO_TRANSFORM,
  DEFAULT_IMAGE_TRANSFORM,
} from '@/components/compete/placementConfig';

/**
 * Compete section: the climb view IS the screen — video (masked by a purely
 * geometric CSS gradient, no colour keying) under the soil image overlay.
 * Video, image and mask placement are all hardcoded in placementConfig.
 */
export default function CompeteScreen() {
  const [progress, setProgress] = useState(1);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MountainVideo transform={DEFAULT_VIDEO_TRANSFORM} progress={progress} />
      <MountainImage transform={DEFAULT_IMAGE_TRANSFORM} />
      <div className="absolute bottom-24 right-4 z-20 w-60 sm:bottom-6 sm:right-6">
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
      </div>
    </div>
  );
}
