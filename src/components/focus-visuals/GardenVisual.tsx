import type { FocusVisualProps } from './types';
import { COCOON_SLOTS, COCOON_PHASES } from './garden/cocoonSlots';
import { ASSETS, COCOON, GARDEN_PLACEMENT } from './garden/config';
import { resolveSessionPalette } from './garden/palette';

export default function GardenVisual({ progress, running = false }: FocusVisualProps) {
  const palette = resolveSessionPalette();
  const value = Math.max(0, Math.min(1, progress));
  
  // Cocoon glow response
  const isEndWindow = value > 0.9;
  const baseGlow = running 
    ? COCOON.minGlow + value * (COCOON.maxGlow - COCOON.minGlow)
    : COCOON.pausedGlow;
  const targetGlow = running && isEndWindow ? COCOON.brightGlow : baseGlow;
  const period = isEndWindow ? COCOON.breathPeriodEndS : COCOON.breathPeriodS;

  return (
    <div className="absolute inset-0 z-0 bg-[#090b0a] overflow-hidden" aria-hidden="true">
      {/* Base garden art */}
      <img
        src={ASSETS.garden}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-cover"
        style={{ transform: `translate(${GARDEN_PLACEMENT.positionX}%, ${GARDEN_PLACEMENT.positionY}%) scale(${GARDEN_PLACEMENT.scale})` }}
      />
      
      {/* 30 Individual Cocoons */}
      {COCOON_SLOTS.map((slot, i) => (
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
              animation: running ? `garden-breathe ${period}s ease-in-out infinite alternate` : 'none',
              animationDelay: `-${COCOON_PHASES[i]}s`
            }}
          />
        </div>
      ))}
    </div>
  );
}