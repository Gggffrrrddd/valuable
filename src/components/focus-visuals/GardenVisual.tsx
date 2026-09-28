import { useEffect, useRef, useState } from 'react';
import type { FocusVisualProps } from './types';
import { COCOON_SLOTS, COCOON_PHASES } from './garden/cocoonSlots';
import { ASSETS, COCOON, GARDEN_PLACEMENT, SKY, COCOON_COUNT } from './garden/config';
import { CAMERA_KEYS, T, OPEN } from './garden/finaleTimeline';
import { resolveSessionPalette } from './garden/palette';
import { generateSky, type SkyLayer } from './garden/sky';
import { ButterflyRenderer } from './garden/butterflySprite';
import { generateConstellation } from './garden/constellation';
import { ArrivalSwarm, EmergenceSwarm } from './garden/butterflySwarm';
import { samplePhrase, PHRASE_POOL } from './garden/phrases';
import { smoothstep } from './model-core/canvasUtils';

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
  const skyCanvasRef = useRef<HTMLCanvasElement>(null);
  const effectsCanvasRef = useRef<HTMLCanvasElement>(null);
  const skyLayerRef = useRef<SkyLayer | null>(null);
  const rendererRef = useRef<ButterflyRenderer | null>(null);
  const swarmsRef = useRef<{ arrival: ArrivalSwarm; emergence: EmergenceSwarm } | null>(null);
  const lastTimeRef = useRef(0);
  
  // Timer for finale
  const [finaleTime, setFinaleTime] = useState(0);

  useEffect(() => {
    if (!complete) return;
    
    // Initialize renderer and swarms if not ready
    if (!rendererRef.current) {
      rendererRef.current = new ButterflyRenderer(palette.hue);
    }
    
    const start = performance.now();
    lastTimeRef.current = 0;
    let frame: number;
    const loop = (now: number) => {
      const t = (now - start) / 1000;
      lastTimeRef.current = t;
      setFinaleTime(t);
      if (t < T.dollyEnd + 2) {
        frame = requestAnimationFrame(loop);
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [complete, palette.hue]);

  useEffect(() => {
    if (!skyCanvasRef.current || !effectsCanvasRef.current) return;
    const effCvs = effectsCanvasRef.current;
    const skyCvs = skyCanvasRef.current;
    
    // We base dimensions on the effects canvas (viewport size)
    const w = effCvs.clientWidth;
    const h = effCvs.clientHeight;
    
    if (effCvs.width !== w || effCvs.height !== h) {
      effCvs.width = w;
      effCvs.height = h;
      
      const skyH = h * SKY.heightVh;
      skyCvs.width = w;
      skyCvs.height = skyH;
      
      // Pre-render sky once
      skyLayerRef.current = generateSky(w, skyH);
      // Blit to the actual sky canvas element
      const sctx = skyCvs.getContext('2d');
      if (sctx) sctx.drawImage(skyLayerRef.current.canvas, 0, 0);
      
      const targets = generateConstellation(w, skyH);
      const pPoints = samplePhrase(PHRASE_POOL[0], w, h);
      
      swarmsRef.current = {
        arrival: new ArrivalSwarm(targets, w, h),
        emergence: new EmergenceSwarm(COCOON_SLOTS, w, h, pPoints),
      };
    }
    
    const ctx = effCvs.getContext('2d');
    if (!ctx || !swarmsRef.current) return;
    
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
    
    // Draw constellation stars
    ctx.globalCompositeOperation = 'lighter';
    const formStart = T.formStart;
    const formEnd = T.formEnd;
    for (const target of swarmsRef.current.arrival.targets) {
      // @ts-expect-error StartX is added dynamically
      if (target.startX !== undefined) {
        // Formation interpolation
        // @ts-expect-error StartX is added dynamically
        const sx = target.startX;
        // @ts-expect-error StartY is added dynamically
        const sy = target.startY;
        
        let tForm = 0;
        if (finaleTime > formStart) {
          tForm = Math.min(1, (finaleTime - formStart) / (formEnd - formStart));
        }
        
        // Spring + swirl
        const eased = smoothstep(0, 1, tForm);
        const swirlAngle = (1 - eased) * Math.PI * 2;
        const swirlRadius = (1 - eased) * 100;
        const cx = sx + (target.x - sx) * eased + Math.cos(swirlAngle) * swirlRadius;
        const cy = sy + (target.y - sy) * eased + Math.sin(swirlAngle) * swirlRadius;

        ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + 0.5 * eased})`;
        ctx.beginPath();
        ctx.arc(cx, cy, target.isProminent ? 2 : 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // Draw phrase particles
    if (finaleTime > T.writeStart) {
       // Mock drawing phrase
       const phraseOpacity = smoothstep(T.writeStart, T.writeEnd, finaleTime);
       ctx.fillStyle = `rgba(255, 255, 255, ${phraseOpacity})`;
       ctx.font = 'bold 32px serif';
       ctx.textAlign = 'center';
       ctx.textBaseline = 'middle';
       ctx.fillText(PHRASE_POOL[0], 0, h * 0.32 - h/2); // adjusted for translate center
    }
    
    // Draw butterflies
    swarmsRef.current.arrival.update(finaleTime, 1 / 60);
    swarmsRef.current.emergence.update(finaleTime, 1 / 60);
    
    if (rendererRef.current && rendererRef.current.ready) {
      const arrRigs = swarmsRef.current.arrival.getRenderData(finaleTime);
      for (const rig of arrRigs) {
        rendererRef.current.draw(ctx, rig);
      }
      
      const emRigs = swarmsRef.current.emergence.getRenderData(finaleTime);
      for (const rig of emRigs) {
        rendererRef.current.draw(ctx, rig);
      }
    }
    
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
  
  const handleSkip = () => {
    if (complete && finaleTime < T.dollyEnd) {
      setFinaleTime(T.dollyEnd);
    }
  };

  return (
    <div className="absolute inset-0 z-0 bg-[#090b0a] overflow-hidden" aria-hidden="true" onClick={handleSkip}>
      {/* 1. Generated Sky Layer (behind everything, panning) */}
      <div 
        className="absolute inset-0 w-full h-full"
        style={{
          transform: `scale(${cam.zoom}) translateY(${panPx}px)`,
          transformOrigin: 'center center'
        }}
      >
        <canvas 
          ref={skyCanvasRef}
          className="absolute inset-x-0 w-full"
          style={{ bottom: '100%', height: `${SKY.heightVh * 100}vh` }}
        />
      </div>

      {/* 2 & 3. Garden Image + Cocoons (panning together with sky) */}
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

      {/* 4. Effects Canvas (butterflies, phrase, constellation stars) - full screen, static bounding box but handles camera pan internally or via CSS */}
      <canvas 
        ref={effectsCanvasRef}
        className="absolute inset-0 z-10 w-full h-full pointer-events-none"
      />
    </div>
  );
}