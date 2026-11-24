import { useEffect, useRef, useState } from "react";
import TreeVideo from "./TreeVideo";
import SoilOverlay from "./SoilOverlay";
import {
  DEFAULT_IMAGE_TRANSFORM,
  DEFAULT_VIDEO_MASK,
  DEFAULT_VIDEO_TRANSFORM,
} from "./placementConfig";

/** Fixed composition box, matched to the 16:9 growth clip. */
const REF_W = 960;
const REF_H = 540;

/**
 * The complete daily-tree scene (growth video + tuned soil overlay) authored
 * at its original reference size, then uniformly contain-scaled into its
 * container. The card uses the same 16:9 aspect, so no crop or stretch occurs.
 */
export default function TreeScene({
  progress,
  preview = false,
  className = "",
}: {
  progress: number;
  preview?: boolean;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setScale(Math.min(w / REF_W, h / REF_H));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden bg-[#090b0a] ${className}`}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: REF_W,
          height: REF_H,
          transform: `translate(-50%, -50%) scale(${scale || 1})`,
          opacity: scale > 0 ? 1 : 0,
          backgroundColor: "#090b0a",
        }}
      >
        <TreeVideo
          transform={DEFAULT_VIDEO_TRANSFORM}
          mask={DEFAULT_VIDEO_MASK}
          progress={progress}
          preview={preview}
        />
        <SoilOverlay transform={DEFAULT_IMAGE_TRANSFORM} />
      </div>
    </div>
  );
}
