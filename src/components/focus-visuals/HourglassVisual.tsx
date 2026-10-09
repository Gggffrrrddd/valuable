import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Canvas } from '@react-three/fiber';
import { normalizeModel, useModelLoader } from './model-core';
import type { Group } from 'three';
import type { FocusVisualProps } from './types';

interface HourglassProps extends FocusVisualProps {
  duration: number;
  running: boolean;
}

const VIDEO_DURATION = 1799.9;
const MASK_URL = '/visuals/hourglass/hourglass-mask-source.png';
const BOOK_URL = '/visuals/table/book-v2.glb';
const MASK_ALIGNMENT = {
  x: 0.49851190476190477,
  y: 0.4999999999999999,
  scale: 1.35,
};

/** Closed book placement over the hourglass (tunable). */
const BOOK_CAL = {
  x: 0,
  y: 0,
  z: 0,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  zoom: 1,
};

const CALIBRATING = true;

const SESSION_COLOR_TINTS = [
  { hue: 0, saturate: 1.2, label: 'amber-orange' },
  { hue: 30, saturate: 1.25, label: 'gold-topaz' },
  { hue: 200, saturate: 1.3, label: 'blue-sapphire' },
  { hue: 280, saturate: 1.25, label: 'purple-violet' },
  { hue: 340, saturate: 1.3, label: 'red-ruby' },
  { hue: 120, saturate: 1.2, label: 'green-emerald' },
  { hue: 170, saturate: 1.25, label: 'teal-aquamarine' },
  { hue: 300, saturate: 1.3, label: 'magenta-amethyst' },
  { hue: 50, saturate: 1.2, label: 'yellow-citrine' },
  { hue: 260, saturate: 1.25, label: 'indigo-lapis' },
];

/** Number box + slider pair; draft text syncs when the external value changes. */
function CalBox({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(value.toFixed(2));
  useEffect(() => { setDraft(value.toFixed(2)); }, [value]);
  return (
    <label style={{ fontSize: '10px', color: '#f6e3ba', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', width: '110px' }}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#f6e3ba' }}
      />
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const parsed = parseFloat(draft);
          if (Number.isFinite(parsed)) onChange(Math.max(min, Math.min(max, parsed)));
          else setDraft(value.toFixed(2));
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        style={{ width: '100%', height: '21px', background: 'rgba(246,227,186,.08)', border: '1px solid rgba(246,227,186,.4)', borderRadius: '4px', color: '#f6e3ba', textAlign: 'center', fontSize: '10px' }}
      />
    </label>
  );
}

function BookModel({ model, cal }: { model: Group; cal: typeof BOOK_CAL }) {
  const staged = useRef<Group | null>(null);
  if (!staged.current) {
    const clone = model.clone(true);
    normalizeModel(clone, 0.5);
    staged.current = clone;
  }
  return (
    <group
      position={[cal.x, cal.y, cal.z]}
      rotation={[(cal.rotX * Math.PI) / 180, (cal.rotY * Math.PI) / 180, (cal.rotZ * Math.PI) / 180]}
      scale={cal.zoom}
    >
      <primitive object={staged.current} />
    </group>
  );
}

export default function HourglassVisual({ progress, duration, running }: HourglassProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoEndedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [sessionColor] = useState(() => SESSION_COLOR_TINTS[Math.floor(Math.random() * SESSION_COLOR_TINTS.length)]);
  const [cal, setCal] = useState(BOOK_CAL);
  const svgId = useId().replace(/:/g, '');
  const { model: bookModel } = useModelLoader(BOOK_URL);
  const complete = progress >= 1;
  const playbackRate = duration > 0 ? VIDEO_DURATION / duration : 1;
  const videoStyle: CSSProperties = {
    opacity: maskDataUrl ? 1 : 0,
    maskImage: maskDataUrl ? `url(${maskDataUrl})` : undefined,
    WebkitMaskImage: maskDataUrl ? `url(${maskDataUrl})` : undefined,
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskSize: '100% 100%',
    WebkitMaskSize: '100% 100%',
    maskPosition: '0 0',
    WebkitMaskPosition: '0 0',
    filter: duration > 0 ? `hue-rotate(${sessionColor.hue}deg) saturate(${sessionColor.saturate})` : undefined,
  };

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
    if (!CALIBRATING) return;
    console.log(
      `[HourglassBook] x=${cal.x.toFixed(2)} y=${cal.y.toFixed(2)} z=${cal.z.toFixed(2)} `
      + `rotX=${cal.rotX.toFixed(1)} rotY=${cal.rotY.toFixed(1)} rotZ=${cal.rotZ.toFixed(1)} `
      + `zoom=${cal.zoom.toFixed(3)}`,
    );
  }, [cal]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const image = new Image();
    const createMask = () => {
      if (cancelled) return;
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(rect.width * pixelRatio);
      canvas.height = Math.round(rect.height * pixelRatio);
      const context = canvas.getContext('2d');
      if (!context) return;

      const width = rect.width * MASK_ALIGNMENT.scale;
      const height = width * image.naturalHeight / image.naturalWidth;
      context.scale(pixelRatio, pixelRatio);
      context.drawImage(
        image,
        rect.width * MASK_ALIGNMENT.x - width / 2,
        rect.height * MASK_ALIGNMENT.y - height / 2,
        width,
        height,
      );
      setMaskDataUrl(canvas.toDataURL('image/png'));
    };

    image.onload = createMask;
    image.src = MASK_URL;
    const observer = new ResizeObserver(createMask);
    observer.observe(container);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  const setCalField = (field: keyof typeof BOOK_CAL) => (v: number) => {
    console.log(`[HourglassBook] ${field}=${v}`);
    setCal((c) => ({ ...c, [field]: v }));
  };

  return (
    <div
      ref={containerRef}
      className={`hybrid-hourglass ${complete ? 'hybrid-hourglass-complete' : ''}`}
      role="img"
      aria-label={`Hourglass ${Math.round(progress * 100)} percent complete`}
    >
      <div
        className="hourglass-ambient"
        style={{
          filter: duration > 0 ? `hue-rotate(${sessionColor.hue}deg) saturate(${sessionColor.saturate})` : undefined
        }}
      />
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

      {/* Closed book model over the hourglass (transparent 3D overlay). */}
      {bookModel && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
          <Canvas
            key={`book-canvas-${svgId}`}
            camera={{ position: [0, 0.4, 2.4], fov: 45 }}
            gl={{ alpha: true, antialias: true }}
            style={{ background: 'transparent' }}
          >
            <ambientLight intensity={1.1} />
            <directionalLight position={[3, 5, 4]} intensity={1.4} />
            <directionalLight position={[-3, 2, -2]} intensity={0.5} />
            <BookModel model={bookModel} cal={cal} />
          </Canvas>
        </div>
      )}

      {CALIBRATING && (
        <div style={{
          position: 'fixed', bottom: '16px', left: '16px', zIndex: 9999,
          background: 'rgba(0,0,0,0.85)', border: '1px solid #f6e3ba', borderRadius: '8px',
          padding: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap',
        }}>
          <CalBox label="X" value={cal.x} min={-3} max={3} step={0.01} onChange={setCalField('x')} />
          <CalBox label="Y" value={cal.y} min={-3} max={3} step={0.01} onChange={setCalField('y')} />
          <CalBox label="Z" value={cal.z} min={-3} max={3} step={0.01} onChange={setCalField('z')} />
          <CalBox label="Tilt X (°)" value={cal.rotX} min={-180} max={180} step={1} onChange={setCalField('rotX')} />
          <CalBox label="Tilt Y (°)" value={cal.rotY} min={-180} max={180} step={1} onChange={setCalField('rotY')} />
          <CalBox label="Tilt Z (°)" value={cal.rotZ} min={-180} max={180} step={1} onChange={setCalField('rotZ')} />
          <CalBox label="Zoom" value={cal.zoom} min={0.1} max={5} step={0.01} onChange={setCalField('zoom')} />
        </div>
      )}
    </div>
  );
}
