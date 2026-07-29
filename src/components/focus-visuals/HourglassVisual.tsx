import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { FocusVisualProps } from './types';

interface HourglassProps extends FocusVisualProps {
  duration: number;
  running: boolean;
}

interface MaskAlignment {
  x: number;
  y: number;
  scale: number;
}

interface DragState {
  pointerId: number;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  alignment: MaskAlignment;
  startDistance: number;
}

const VIDEO_DURATION = 1799.9;
const MASK_URL = '/visuals/hourglass/hourglass-mask-source.png';
const MASK_STORAGE_KEY = 'valuable-hourglass-mask-v2';
const MASK_ASPECT_RATIO = 666 / 374;
const DEFAULT_ALIGNMENT: MaskAlignment = { x: 0.5, y: 0.5, scale: 1 };

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

function readSavedAlignment(): MaskAlignment | null {
  try {
    const saved = JSON.parse(localStorage.getItem(MASK_STORAGE_KEY) ?? 'null') as Partial<MaskAlignment> | null;
    if (
      saved
      && typeof saved.x === 'number'
      && typeof saved.y === 'number'
      && typeof saved.scale === 'number'
    ) {
      return {
        x: clamp(saved.x, -0.5, 1.5),
        y: clamp(saved.y, -0.5, 1.5),
        scale: clamp(saved.scale, 0.2, 2.5),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export default function HourglassVisual({ progress, duration, running }: HourglassProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoEndedRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [savedAlignment, setSavedAlignment] = useState<MaskAlignment | null>(() => readSavedAlignment());
  const [draftAlignment, setDraftAlignment] = useState<MaskAlignment>(() => readSavedAlignment() ?? DEFAULT_ALIGNMENT);
  const [calibrating, setCalibrating] = useState(() => readSavedAlignment() === null);
  const complete = progress >= 1;
  const playbackRate = VIDEO_DURATION / duration;

  const handleEnded = () => {
    videoEndedRef.current = true;
    setVideoEnded(true);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !loaded) return;

    if (running && !videoEndedRef.current && !complete) {
      if (progress === 0) video.currentTime = 0;
      video.playbackRate = playbackRate;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [running, loaded, playbackRate, progress, complete, videoEnded]);

  useEffect(() => {
    if (progress === 0) {
      videoEndedRef.current = false;
      setVideoEnded(false);
    }
  }, [progress]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !loaded || !complete) return;
    video.pause();
  }, [complete, loaded]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const alignment = calibrating ? draftAlignment : savedAlignment;
  const maskWidth = containerSize.width * (alignment?.scale ?? 1);
  const maskHeight = maskWidth / MASK_ASPECT_RATIO;
  const maskLeft = containerSize.width * (alignment?.x ?? 0.5) - maskWidth / 2;
  const maskTop = containerSize.height * (alignment?.y ?? 0.5) - maskHeight / 2;
  const videoStyle: CSSProperties | undefined = !calibrating && savedAlignment
    ? {
        maskImage: `url(${MASK_URL})`,
        WebkitMaskImage: `url(${MASK_URL})`,
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskSize: `${maskWidth}px ${maskHeight}px`,
        WebkitMaskSize: `${maskWidth}px ${maskHeight}px`,
        maskPosition: `${maskLeft}px ${maskTop}px`,
        WebkitMaskPosition: `${maskLeft}px ${maskTop}px`,
      }
    : undefined;

  const startPointerAction = (event: ReactPointerEvent<HTMLElement>, mode: DragState['mode']) => {
    const container = containerRef.current;
    if (!container) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + draftAlignment.x * rect.width;
    const centerY = rect.top + draftAlignment.y * rect.height;
    dragRef.current = {
      pointerId: event.pointerId,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      alignment: draftAlignment,
      startDistance: Math.max(1, Math.hypot(event.clientX - centerX, event.clientY - centerY)),
    };
  };

  const movePointer = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !container) return;

    const rect = container.getBoundingClientRect();
    if (drag.mode === 'move') {
      setDraftAlignment({
        ...drag.alignment,
        x: clamp(drag.alignment.x + (event.clientX - drag.startX) / rect.width, -0.5, 1.5),
        y: clamp(drag.alignment.y + (event.clientY - drag.startY) / rect.height, -0.5, 1.5),
      });
      return;
    }

    const centerX = rect.left + drag.alignment.x * rect.width;
    const centerY = rect.top + drag.alignment.y * rect.height;
    const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
    setDraftAlignment({
      ...drag.alignment,
      scale: clamp(drag.alignment.scale * distance / drag.startDistance, 0.2, 2.5),
    });
  };

  const endPointerAction = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const saveAlignment = () => {
    localStorage.setItem(MASK_STORAGE_KEY, JSON.stringify(draftAlignment));
    setSavedAlignment(draftAlignment);
    setCalibrating(false);
  };

  const cancelCalibration = () => {
    if (!savedAlignment) return;
    setDraftAlignment(savedAlignment);
    setCalibrating(false);
  };

  const openCalibration = () => {
    setDraftAlignment(savedAlignment ?? DEFAULT_ALIGNMENT);
    setCalibrating(true);
  };

  return (
    <div
      ref={containerRef}
      className={`hybrid-hourglass ${complete ? 'hybrid-hourglass-complete' : ''}`}
      role="img"
      aria-label={`Hourglass ${Math.round(progress * 100)} percent complete`}
    >
      <div className="hourglass-ambient" />
      {!loaded && <div className="hourglass-loading" />}
      <video
        ref={videoRef}
        className="hourglass-video"
        style={videoStyle}
        crossOrigin="anonymous"
        preload="auto"
        muted
        playsInline
        src="https://res.cloudinary.com/dcydj6gao/video/upload/v1785294925/project_video_1_rdj9o6.mp4"
        onLoadedData={() => setLoaded(true)}
        onEnded={handleEnded}
        aria-hidden="true"
      />

      {calibrating && (
        <>
          <div
            className="hourglass-mask-guide"
            style={{
              left: `${maskLeft}px`,
              top: `${maskTop}px`,
              width: `${maskWidth}px`,
              height: `${maskHeight}px`,
            }}
            onPointerDown={(event) => startPointerAction(event, 'move')}
            onPointerMove={movePointer}
            onPointerUp={endPointerAction}
            onPointerCancel={endPointerAction}
          >
            <img src={MASK_URL} alt="Hourglass mask alignment guide" draggable={false} />
            <button
              type="button"
              className="hourglass-mask-resize"
              aria-label="Resize hourglass mask"
              onPointerDown={(event) => startPointerAction(event, 'resize')}
              onPointerMove={movePointer}
              onPointerUp={endPointerAction}
              onPointerCancel={endPointerAction}
            />
          </div>

          <div className="hourglass-mask-controls">
            <strong>Align mask</strong>
            <span>Drag the image. Use the corner handle or slider to resize.</span>
            <label>
              Size
              <input
                type="range"
                min="0.2"
                max="2.5"
                step="0.01"
                value={draftAlignment.scale}
                onChange={(event) => setDraftAlignment((current) => ({ ...current, scale: Number(event.target.value) }))}
              />
            </label>
            <div>
              <button type="button" onClick={() => setDraftAlignment(DEFAULT_ALIGNMENT)}>Reset</button>
              {savedAlignment && <button type="button" onClick={cancelCalibration}>Cancel</button>}
              <button type="button" className="hourglass-mask-save" onClick={saveAlignment}>Save mask</button>
            </div>
          </div>
        </>
      )}

      {!calibrating && (
        <button type="button" className="hourglass-mask-recalibrate" onClick={openCalibration}>
          Adjust mask
        </button>
      )}
    </div>
  );
}
