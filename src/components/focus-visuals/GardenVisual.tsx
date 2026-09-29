import { useEffect, useRef, useState, useMemo } from 'react';
import type { FocusVisualProps } from './types';
import { COCOON_SLOTS, COCOON_PHASES } from './garden/cocoonSlots';
import { ASSETS, COCOON, GARDEN_PLACEMENT, SKY, COCOON_COUNT, CONSTELLATION } from './garden/config';
import { CAMERA_KEYS, T, OPEN } from './garden/finaleTimeline';
import { resolveSessionPalette } from './garden/palette';
import { generateSky, type SkyLayer } from './garden/sky';
import { ButterflyRenderer } from './garden/butterflySprite';
import { generateConstellation } from './garden/constellation';
import { ArrivalSwarm, EmergenceSwarm } from './garden/butterflySwarm';
import { samplePhrase, resolveSessionPhrase } from './garden/phrases';
import { smoothstep } from './model-core/canvasUtils';
import { useReducedMotion } from './model-core/useReducedMotion';

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

export default function GardenVisual({ progress, running = false, onFinaleComplete }: FocusVisualProps) {
  // Dev tools
  const devTools = useMemo(() => {
    if (typeof window === 'undefined') return { speed: 1, startT: 0, palette: null, phrase: null };
    const params = new URLSearchParams(window.location.search);
    const isFinale = params.get('garden') === 'finale';
    if (!isFinale) return { speed: 1, startT: 0, palette: null, phrase: null };
    
    const act = params.get('act');
    let startT = Number(params.get('t')) || 0;
    if (act === '2') startT = Math.max(startT, T.viewStart);
    
    return {
      speed: Number(params.get('speed')) || 1,
      startT,
      palette: params.get('palette'),
      phrase: params.get('phrase'),
    };
  }, []);

  const palette = resolveSessionPalette(devTools.palette);
  const phrase = useMemo(() => resolveSessionPhrase(devTools.phrase), [devTools.phrase]);
  const value = Math.max(0, Math.min(1, progress));
  const complete = value >= 1;
  const skyCanvasRef = useRef<HTMLCanvasElement>(null);
  const effectsCanvasRef = useRef<HTMLCanvasElement>(null);
  const skyLayerRef = useRef<SkyLayer | null>(null);
  const rendererRef = useRef<ButterflyRenderer | null>(null);
  const swarmsRef = useRef<{ arrival: ArrivalSwarm; emergence: EmergenceSwarm } | null>(null);
  const lastTimeRef = useRef(0);
  const skippedRef = useRef(false);
  
  // Timer for finale
  const [finaleTime, setFinaleTime] = useState(0);
  const gardenContainerRef = useRef<HTMLDivElement>(null);
  const cocoonsContainerRef = useRef<HTMLDivElement>(null);
  
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!complete) return;
    
    if (reducedMotion) {
      setFinaleTime(T.dollyEnd);
      return;
    }
    
    // Initialize renderer and swarms if not ready
    if (!rendererRef.current) {
      rendererRef.current = new ButterflyRenderer(palette.hue);
    }
    
    const start = performance.now();
    lastTimeRef.current = devTools.startT;
    let frame: number;
    const loop = (now: number) => {
      let t = devTools.startT + ((now - start) / 1000) * devTools.speed;
      if (skippedRef.current) {
        t = Math.max(t, T.dollyEnd);
      }
      lastTimeRef.current = t;
      setFinaleTime(t);
      
      renderCanvasFrame(t);
      updateDomElements(t);
      
      if (t < T.dollyEnd + 2) {
        frame = requestAnimationFrame(loop);
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [complete, palette.hue, devTools, reducedMotion]);

  const updateDomElements = (t: number) => {
    const cam = interpolateCamera(t);
    const maxPanPx = typeof window !== 'undefined' ? window.innerHeight * SKY.heightVh - window.innerHeight : 0;
    const panPx = maxPanPx * cam.panY;
    
    if (skyCanvasRef.current && skyCanvasRef.current.parentElement) {
      skyCanvasRef.current.parentElement.style.transform = `scale(${cam.zoom}) translateY(${panPx}px)`;
    }
    if (gardenContainerRef.current) {
      gardenContainerRef.current.style.transform = `scale(${cam.zoom}) translateY(${panPx}px)`;
    }
    
    // Hide cocoons as they open
    if (cocoonsContainerRef.current && t >= T.openStart) {
      const children = cocoonsContainerRef.current.children;
      for (let i = 0; i < children.length; i++) {
        const isOpened = t >= (T.openStart + (i / COCOON_COUNT) * OPEN.stagger);
        if (isOpened) {
          (children[i] as HTMLElement).style.display = 'none';
        }
      }
    }
  };

  const renderCanvasFrame = (finaleTime: number) => {
    if (!skyCanvasRef.current || !effectsCanvasRef.current) return;
    const effCvs = effectsCanvasRef.current;
    const skyCvs = skyCanvasRef.current;
    
    const w = effCvs.clientWidth;
    const h = effCvs.clientHeight;
    
    if (effCvs.width !== w || effCvs.height !== h) {
      effCvs.width = w;
      effCvs.height = h;
      
      const skyH = h * SKY.heightVh;
      skyCvs.width = w;
      skyCvs.height = skyH;
      
      skyLayerRef.current = generateSky(w, skyH);
      const sctx = skyCvs.getContext('2d');
      if (sctx) sctx.drawImage(skyLayerRef.current.canvas, 0, 0);
      
      const targets = generateConstellation(w, skyH);
      const pPoints = samplePhrase(phrase, w, h);
      
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
    ctx.translate(w / 2, h / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-w / 2, -h / 2);
    
    const maxPanPx = h * SKY.heightVh - h;
    const panPx = maxPanPx * cam.panY;
    ctx.translate(0, panPx);
    
    // Draw lines between constellation stars
    if (CONSTELLATION.showLines && finaleTime > T.formEnd) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${CONSTELLATION.lineAlpha})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      // simplified nearest-neighbor drawing for demonstration
      const targets = swarmsRef.current.arrival.targets;
      for (let i = 0; i < targets.length; i++) {
        for (let j = i + 1; j < targets.length; j++) {
          const dx = targets[i].x - targets[j].x;
          const dy = targets[i].y - targets[j].y;
          if (dx*dx + dy*dy < 10000) {
            ctx.moveTo(targets[i].x, targets[i].y);
            ctx.lineTo(targets[j].x, targets[j].y);
          }
        }
      }
      ctx.stroke();
    }
    
    // Draw constellation stars
    ctx.globalCompositeOperation = 'lighter';
    const formStart = T.formStart;
    const formEnd = T.formEnd;
    for (const target of swarmsRef.current.arrival.targets) {
      // @ts-expect-error StartX is added dynamically
      if (target.startX !== undefined) {
        // @ts-expect-error StartX is added dynamically
        const sx = target.startX;
        // @ts-expect-error StartY is added dynamically
        const sy = target.startY;
        
        let tForm = 0;
        if (finaleTime > formStart) {
          tForm = Math.min(1, (finaleTime - formStart) / (formEnd - formStart));
        }
        
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
       const phraseOpacity = smoothstep(T.writeStart, T.writeEnd, finaleTime);
       ctx.fillStyle = `rgba(255, 255, 255, ${phraseOpacity})`;
       ctx.font = 'bold 32px serif';
       ctx.textAlign = 'center';
       ctx.textBaseline = 'middle';
       ctx.fillText(phrase, w / 2, h * 0.32 - panPx); // adjusted for translate center
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
  };
  
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
      skippedRef.current = true;
      setFinaleTime(T.dollyEnd);
    }
  };

  return (
    <div className="absolute inset-0 z-0 bg-[#090b0a] overflow-hidden" onClick={handleSkip}>
      {/* 1. Generated Sky Layer (behind everything, panning) */}
      <div 
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
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
        aria-hidden="true"
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

      {/* 4. Effects Canvas */}
      <canvas 
        ref={effectsCanvasRef}
        aria-hidden="true"
        className="absolute inset-0 z-10 w-full h-full pointer-events-none"
      />

      {/* Screen-reader only phrase announcement */}
      {complete && finaleTime >= T.writeStart && (
        <div aria-live="polite" className="sr-only">
          {phrase}
        </div>
      )}

      {/* Continue button at the very end */}
      {complete && finaleTime >= T.dollyEnd && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-end pb-24 pointer-events-none animate-fade-in">
          <button 
            onClick={onFinaleComplete}
            className="pointer-events-auto rounded-full bg-lime-300 px-8 py-3.5 font-display text-sm font-bold tracking-wide text-[#11130f] transition hover:bg-lime-200 hover:scale-105"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}