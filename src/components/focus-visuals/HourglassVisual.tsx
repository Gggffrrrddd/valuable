import { useEffect, useRef, useState } from 'react';
import type { FocusVisualProps } from './types';

interface HourglassProps extends FocusVisualProps {
  duration: number;
  running: boolean;
}

interface Iris {
  cx: number;
  cy: number;
  innerRx: number;
  innerRy: number;
  outerRx: number;
  outerRy: number;
}

type InteractionMode = 'move' | 'inner' | 'outer';

const VIDEO_DURATION = 1799.9;
const TARGET_FRAME_MS = 1000 / 18;
const WORKING_WIDTH = 520;
const DEBUG_OUTSIDE_COLOR = { red: 255, green: 0, blue: 0 };
const INITIAL_IRIS: Iris = {
  cx: 0.5,
  cy: 0.515,
  innerRx: 0.225,
  innerRy: 0.34,
  outerRx: 0.255,
  outerRy: 0.415,
};

const clamp = (value: number, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));

export default function HourglassVisual({ progress, duration, running }: HourglassProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const irisRef = useRef<Iris>(INITIAL_IRIS);
  const interactionRef = useRef<{ mode: InteractionMode; startX: number; startY: number; iris: Iris } | null>(null);
  const videoEndedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [iris, setIris] = useState<Iris>(INITIAL_IRIS);
  const complete = progress >= 1;
  const playbackRate = VIDEO_DURATION / duration;

  const handleEnded = () => {
    videoEndedRef.current = true;
    setVideoEnded(true);
  };

  const updateIris = (nextIris: Iris) => {
    const innerRx = clamp(nextIris.innerRx, 0.1, 0.45);
    const innerRy = clamp(nextIris.innerRy, 0.14, 0.45);
    const outerRx = clamp(nextIris.outerRx, innerRx + 0.012, 0.48);
    const outerRy = clamp(nextIris.outerRy, innerRy + 0.012, 0.48);
    const next = {
      cx: clamp(nextIris.cx, outerRx, 1 - outerRx),
      cy: clamp(nextIris.cy, outerRy, 1 - outerRy),
      innerRx,
      innerRy,
      outerRx,
      outerRy,
    };
    irisRef.current = next;
    setIris(next);
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
    const video = videoRef.current;
    const displayCanvas = canvasRef.current;
    if (!video || !displayCanvas || !loaded) return;

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) return;

    const workWidth = Math.min(WORKING_WIDTH, sourceWidth);
    const workHeight = Math.max(1, Math.round(workWidth * sourceHeight / sourceWidth));
    const workCanvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(workWidth, workHeight)
      : document.createElement('canvas');
    workCanvas.width = workWidth;
    workCanvas.height = workHeight;

    const workContext = workCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    const displayContext = displayCanvas.getContext('2d', { willReadFrequently: true });
    if (!workContext || !displayContext) return;

    displayCanvas.width = workWidth;
    displayCanvas.height = workHeight;

    let frameId = 0;
    let lastFrame = 0;

    const draw = (now: number) => {
      frameId = requestAnimationFrame(draw);
      if (now - lastFrame < TARGET_FRAME_MS || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      lastFrame = now;

      workContext.drawImage(video, 0, 0, workWidth, workHeight);
      const frame = workContext.getImageData(0, 0, workWidth, workHeight);
      const pixels = frame.data;
      const activeIris = irisRef.current;
      const centerX = activeIris.cx * workWidth;
      const centerY = activeIris.cy * workHeight;
      const innerRadiusX = activeIris.innerRx * workWidth;
      const innerRadiusY = activeIris.innerRy * workHeight;
      const outerRadiusX = activeIris.outerRx * workWidth;
      const outerRadiusY = activeIris.outerRy * workHeight;

      for (let index = 0; index < pixels.length; index += 4) {
        const pixel = index / 4;
        const deltaX = pixel % workWidth - centerX;
        const deltaY = Math.floor(pixel / workWidth) - centerY;
        const angle = Math.atan2(deltaY, deltaX);
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const radius = Math.hypot(deltaX, deltaY);
        const innerBoundary = 1 / Math.sqrt((cosine / innerRadiusX) ** 2 + (sine / innerRadiusY) ** 2);
        const outerBoundary = 1 / Math.sqrt((cosine / outerRadiusX) ** 2 + (sine / outerRadiusY) ** 2);
        const outsideAmount = clamp((radius - innerBoundary) / Math.max(1, outerBoundary - innerBoundary));

        if (outsideAmount === 0) continue;
        pixels[index] = Math.round(pixels[index] * (1 - outsideAmount) + DEBUG_OUTSIDE_COLOR.red * outsideAmount);
        pixels[index + 1] = Math.round(pixels[index + 1] * (1 - outsideAmount) + DEBUG_OUTSIDE_COLOR.green * outsideAmount);
        pixels[index + 2] = Math.round(pixels[index + 2] * (1 - outsideAmount) + DEBUG_OUTSIDE_COLOR.blue * outsideAmount);
        pixels[index + 3] = 255;
      }

      displayContext.putImageData(frame, 0, 0);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [loaded]);

  const beginInteraction = (event: React.PointerEvent<HTMLElement>, mode: InteractionMode) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = { mode, startX: event.clientX, startY: event.clientY, iris: irisRef.current };
  };

  const updateInteraction = (event: React.PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    const container = event.currentTarget.parentElement;
    if (!interaction || !container) return;
    const bounds = container.getBoundingClientRect();
    const deltaX = (event.clientX - interaction.startX) / bounds.width;
    const deltaY = (event.clientY - interaction.startY) / bounds.height;

    if (interaction.mode === 'move') {
      updateIris({ ...interaction.iris, cx: interaction.iris.cx + deltaX, cy: interaction.iris.cy + deltaY });
    } else if (interaction.mode === 'inner') {
      updateIris({ ...interaction.iris, innerRx: interaction.iris.innerRx + deltaX, innerRy: interaction.iris.innerRy + deltaY });
    } else {
      updateIris({ ...interaction.iris, outerRx: interaction.iris.outerRx + deltaX, outerRy: interaction.iris.outerRy + deltaY });
    }
  };

  const endInteraction = () => {
    interactionRef.current = null;
  };

  return (
    <div className={`hybrid-hourglass ${complete ? 'hybrid-hourglass-complete' : ''}`} role="img" aria-label={`Hourglass ${Math.round(progress * 100)} percent complete`}>
      <div className="hourglass-ambient" />
      {!loaded && <div className="hourglass-loading" />}
      <video
        ref={videoRef}
        className="hourglass-video"
        crossOrigin="anonymous"
        preload="auto"
        muted
        playsInline
        src="https://res.cloudinary.com/dcydj6gao/video/upload/v1785294925/project_video_1_rdj9o6.mp4"
        onLoadedData={() => setLoaded(true)}
        onEnded={handleEnded}
        aria-hidden="true"
      />
      <canvas ref={canvasRef} className="hourglass-canvas" aria-hidden="true" />
      <div className="absolute left-1/2 top-1 z-10 -translate-x-1/2 rounded bg-black/80 px-2 py-1 font-mono text-[10px] leading-relaxed text-lime-300">
        cx={iris.cx.toFixed(3)} cy={iris.cy.toFixed(3)}<br />
        innerRx={iris.innerRx.toFixed(3)} innerRy={iris.innerRy.toFixed(3)}<br />
        outerRx={iris.outerRx.toFixed(3)} outerRy={iris.outerRy.toFixed(3)}
      </div>
      <div
        className="hourglass-iris-control"
        style={{ left: `${iris.cx * 100}%`, top: `${iris.cy * 100}%`, width: `${iris.outerRx * 200}%`, height: `${iris.outerRy * 200}%` }}
        onPointerDown={(event) => beginInteraction(event, 'move')}
        onPointerMove={updateInteraction}
        onPointerUp={endInteraction}
        onPointerCancel={endInteraction}
      >
        <span className="hourglass-iris-label">Red debug: outer boundary</span>
        <div
          className="hourglass-iris-inner"
          style={{ width: `${iris.innerRx / iris.outerRx * 100}%`, height: `${iris.innerRy / iris.outerRy * 100}%` }}
        >
          <button
            type="button"
            className="hourglass-iris-handle hourglass-iris-inner-handle"
            aria-label="Resize inner video boundary"
            onPointerDown={(event) => {
              event.stopPropagation();
              beginInteraction(event, 'inner');
            }}
          />
        </div>
        <button
          type="button"
          className="hourglass-iris-handle hourglass-iris-outer-handle"
          aria-label="Resize outer red boundary"
          onPointerDown={(event) => {
            event.stopPropagation();
            beginInteraction(event, 'outer');
          }}
        />
      </div>
    </div>
  );
}
