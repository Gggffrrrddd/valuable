import { forwardRef, type CSSProperties } from 'react';
import type { ButterflyPoint } from './types';

interface ButterflySpriteProps {
  point: ButterflyPoint;
}

const ButterflySprite = forwardRef<HTMLSpanElement, ButterflySpriteProps>(function ButterflySprite({ point }, ref) {
  const style = {
    '--butterfly-size': `${(20 + point.scale * 16).toFixed(1)}px`,
    '--butterfly-flap-speed': `${point.wingSpeed.toFixed(2)}s`,
    '--butterfly-flap-angle': `${point.wingAmplitude.toFixed(1)}deg`,
  } as CSSProperties;

  return (
    <span ref={ref} className="butterfly-slot" style={style} aria-hidden="true">
      <span className="butterfly-flight">
        <span className="butterfly-banker">
          <img className="butterfly-wing butterfly-wing--left" src="/visuals/butterfly-mosaic/wing-left.png" alt="" draggable={false} />
          <img className="butterfly-wing butterfly-wing--right" src="/visuals/butterfly-mosaic/wing-right.png" alt="" draggable={false} />
          <img className="butterfly-body" src="/visuals/butterfly-mosaic/body.png" alt="" draggable={false} />
        </span>
      </span>
    </span>
  );
});

export default ButterflySprite;
