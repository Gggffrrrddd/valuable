import type { CSSProperties, RefCallback } from 'react';
import type { ButterflyPoint } from './types';

interface ButterflySpriteProps {
  point: ButterflyPoint;
  slotRef: RefCallback<HTMLSpanElement>;
  flightRef: RefCallback<HTMLSpanElement>;
}

export default function ButterflySprite({ point, slotRef, flightRef }: ButterflySpriteProps) {
  const style = {
    '--butterfly-flap-speed': `${point.wingSpeed.toFixed(2)}s`,
    '--butterfly-flap-angle': `${point.wingAmplitude.toFixed(1)}deg`,
    '--butterfly-seed': point.id,
  } as CSSProperties;

  return (
    <span ref={slotRef} className="butterfly-slot" style={style} aria-hidden="true">
      <span ref={flightRef} className="butterfly-flight">
        <span className="butterfly-banker">
          <img className="butterfly-wing butterfly-wing--left" src="/visuals/butterfly-mosaic/wing-left.png" alt="" draggable={false} />
          <img className="butterfly-wing butterfly-wing--right" src="/visuals/butterfly-mosaic/wing-right.png" alt="" draggable={false} />
          <img className="butterfly-body" src="/visuals/butterfly-mosaic/body.png" alt="" draggable={false} />
        </span>
      </span>
    </span>
  );
}
