import { useEffect, useRef, useState } from 'react';
import type { FocusVisualProps } from './types';
import { COCOON_SLOTS, COCOON_PHASES } from './garden/cocoonSlots';
import { ASSETS, COCOON, GARDEN_PLACEMENT, SKY, COCOON_COUNT } from './garden/config';
import { CAMERA_KEYS, T, OPEN } from './garden/finaleTimeline';
import { resolveSessionPalette } from './garden/palette';
import { generateSky, type SkyLayer } from './garden/sky';

function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t;
}

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function interpolateCamera(tSec: number) {
  if (tSec <= CAMERA_KEYS[0].t) return CAMERA_KEYS[0];
  if (tSec >= CAMERA_KEYS[CAMERA_KEYS.length - 1].t) return CAMERA_KEYS[CAMERA_KEYS.length - 1];
  
  for (let i = 0; i < CAMERA_KEYS.length - 1; i++) {
    const k1 = CAMERA_KEYS[i];
    const k2 = CAMERA_KEYS[i + 1];
    if (tSec >= k1.t && tSec <= k2.t) {
      const progress = (tSec - k1.t) / (k2.t - k1.t);
      const eased = easeInOutCubic(progress);
      return {
        panY: lerp(k1.panY, k2.panY, eased),
        zoom: lerp(k1.zoom, k2.zoom, eased)
      };
    }
  }
  return CAMERA_KEYS[0];
}

export default function GardenVisual({ progress, running = false }: FocusVisualProps) {
  const palette = resolveSessionPalette();
  const value = Math.max(0, Math.min(1, progress));
  const complete = value >= 1;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skyLayerRef = useRef<SkyLayer | null>(null);
  
  // Timer for finale
  const [finaleTime, setFinaleTime] = useState(0);

  useEffect(() => {
    if (!complete) return;
    const start = performance.now();
    let frame: number;
    const loop = (now: number) => {
      const t = (now - start) / 1000;
      setFinaleTime(t);
      if (t < T.dollyEnd + 2) {
        frame = requestAnimationFrame(loop);
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [complete]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const cvs = canvasRef.current;
    const w = cvs.clientWidth;
    const h = cvs.clientHeight;
    if (cvs.width !== w || cvs.height !== h) {
      cvs.width = w;
      cvs.height = h;
      // Pre-render sky once
      skyLayerRef.current = generateSky(w, h * SKY.heightVh);
    }
    
    const ctx = cvs.getContext('2d');
    if (!ctx || !skyLayerRef.current) return;
    
    ctx.clearRect(0, 0, w, h);
    
    const cam = interpolateCamera(finaleTime);
    
    ctx.save();
    // Center origin for zoom
    ctx.translate(w / 2, h / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-w / 2, -h / 2);
    
    // Pan
    const maxPanPx = h * SKY.heightVh - h;
    const panPx = maxPanPx * cam.panY;
    ctx.translate(0, panPx);
    
    // Draw sky layer (placed above the viewport initially, revealed on pan up)
    // The sky rect spans from y = -h to y = h*0.5
    ctx.drawImage(skyLayerRef.current.canvas, 0, -skyLayerRef.current.height + h * 0.9);
    
    // Draw butterflies here eventually...
    
    ctx.restore();
  }, [finaleTime, complete]);
  
  // Cocoon glow response
  const isEndWindow = running && progress > 0.9;
  const baseGlow = running 
    ? COCOON.minGlow + value * (COCOON.maxGlow - COCOON.minGlow)
    : COCOON.pausedGlow;
  
  // In finale Act 1, cocoons go to full steady glow
  const inFinaleAct1 = complete && finaleTime < T.openStart;
  const targetGlow = inFinaleAct1 ? COCOON.brightGlow : (running && isEndWindow ? COCOON.brightGlow : baseGlow);
  const period = isEndWindow ? COCOON.breathPeriodEndS : COCOON.breathPeriodS;

  const cam = interpolateCamera(finaleTime);
  const maxPanPx = typeof window !== 'undefined' ? window.innerHeight * SKY.heightVh - window.innerHeight : 0;
  const panPx = maxPanPx * cam.panY;
  
  return (
    <div className="absolute inset-0 z-0 bg-[#090b0a] overflow-hidden" aria-hidden="true">
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 z-10 w-full h-full pointer-events-none"
      />
      
      <div 
        className="absolute inset-0 w-full h-full"
        style={{
          transform: `scale(${cam.zoom}) translateY(${panPx}px)`,
          transformOrigin: 'center center'
        }}
      >
        {/* Base garden art */}
        <img
          src={ASSETS.garden}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover"
          style={{ transform: `translate(${GARDEN_PLACEMENT.positionX}%, ${GARDEN_PLACEMENT.positionY}%) scale(${GARDEN_PLACEMENT.scale})` }}
        />
        
        {/* 30 Individual Cocoons */}
        {COCOON_SLOTS.map((slot, i) => {
          // If past their individual opening time, hide them
          const isOpened = complete && finaleTime >= (T.openStart + (i / COCOON_COUNT) * OPEN.stagger);
          if (isOpened) return null;
          
          return (
            <div 
              key={slot.id}
              className="absolute"
              style={{
                left: `${slot.x * 100}%`,
                top: `${slot.y * 100}%`,
                width: '100%',
                height: '100%',
                transform: `translate(-50%, -50%) scale(${slot.scale})`,
                pointerEvents: 'none',
              }}
            >
              {/* Base un-glowing sprite */}
              <img
                src={ASSETS.cocoon}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
              />
              {/* Additive glowing sprite overlay */}
              <img
                src={ASSETS.cocoon}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
                style={{
                  filter: `drop-shadow(0 0 ${COCOON.glowRadius}px ${palette.glow})`,
                  mixBlendMode: 'screen',
                  opacity: targetGlow,
                  animation: running && !complete ? `garden-breathe ${period}s ease-in-out infinite alternate` : 'none',
                  animationDelay: `-${COCOON_PHASES[i]}s`
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}