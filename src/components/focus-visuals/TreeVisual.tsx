import type { CSSProperties } from 'react';
import type { FocusVisualProps } from './types';

interface TreeVisualProps extends FocusVisualProps {
  duration: number;
  running: boolean;
}

interface LeafConfig {
  canopyX: number;
  canopyY: number;
  landingX: number;
  landingY: number;
  rotation: number;
  landedRotation: number;
  scale: number;
  hue: number;
  brightness: number;
  swayOne: number;
  swayTwo: number;
}

type LeafStyle = CSSProperties & Record<`--${string}`, string | number>;

const TREE_SCENE_URL = '/visuals/tree/tree-scene.png';
const LEAF_URL = '/visuals/tree/leaf-01.png';
const LEAF_COUNT = 28;
const FALL_DURATION_SECONDS = 2.7;

const CANOPY_POSITIONS = [
  [32, 25], [40, 19], [48, 16], [56, 18], [64, 24], [71, 31], [26, 33],
  [36, 31], [45, 27], [54, 29], [63, 33], [76, 39], [22, 42], [31, 42],
  [41, 38], [50, 36], [59, 40], [69, 43], [79, 47], [28, 50], [38, 48],
  [47, 46], [57, 49], [66, 51], [74, 55], [34, 56], [49, 54], [60, 57],
] as const;

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

const leaves: LeafConfig[] = CANOPY_POSITIONS.map(([canopyX, canopyY], index) => {
  const random = (offset: number) => seededRandom(index * 17 + offset);
  return {
    canopyX,
    canopyY,
    landingX: 24 + random(1) * 55,
    landingY: 81 + random(2) * 5,
    rotation: -30 + random(3) * 60,
    landedRotation: -75 + random(4) * 150,
    scale: 0.8 + random(5) * 0.3,
    hue: -15 + random(6) * 30,
    brightness: 0.9 + random(7) * 0.2,
    swayOne: -5 + random(8) * 10,
    swayTwo: -7 + random(9) * 14,
  };
});

export default function TreeVisual({ progress, duration, running }: TreeVisualProps) {
  const value = Math.max(0, Math.min(1, progress));
  const elapsedSeconds = value * duration;
  const hasTimeline = duration > 0;
  const shedInterval = hasTimeline ? duration / LEAF_COUNT : 0;
  const complete = value >= 1;

  return (
    <div
      className={`tree-scene focus-visual ${complete ? 'visual-complete' : ''} ${running ? 'tree-scene--running' : 'tree-scene--paused'}`}
      role="img"
      aria-label={`Tree ${Math.round(value * 100)} percent complete`}
    >
      <img className="tree-scene__background" src={TREE_SCENE_URL} alt="" aria-hidden="true" />
      <div className="tree-scene__completion-glow visual-finish-glow" aria-hidden="true" />

      {leaves.map((leaf, index) => {
        const fallStart = index * shedInterval;
        const falling = hasTimeline && !complete && elapsedSeconds >= fallStart && elapsedSeconds < fallStart + FALL_DURATION_SECONDS;
        const landed = complete || (hasTimeline && elapsedSeconds >= fallStart + FALL_DURATION_SECONDS);
        const fallX = leaf.landingX - leaf.canopyX;
        const fallY = leaf.landingY - leaf.canopyY;
        const fallRotation = leaf.landedRotation - leaf.rotation + 360 + (index % 2) * 360;
        const wrapperStyle: LeafStyle = {
          left: `${landed ? leaf.landingX : leaf.canopyX}%`,
          top: `${landed ? leaf.landingY : leaf.canopyY}%`,
          '--fall-x': `${fallX}cqw`,
          '--fall-y': `${fallY}cqh`,
          '--fall-y-17': `${fallY * 0.17}cqh`,
          '--fall-y-40': `${fallY * 0.4}cqh`,
          '--fall-y-67': `${fallY * 0.67}cqh`,
          '--fall-y-94': `${fallY * 0.94}cqh`,
          '--bounce-y': `${fallY - 0.7}cqh`,
          '--sway-one': `${fallX * 0.28 + leaf.swayOne}cqw`,
          '--sway-two': `${fallX * 0.58 + leaf.swayTwo}cqw`,
          '--sway-three': `${fallX * 0.82 - leaf.swayOne * 0.45}cqw`,
          '--fall-rotation': `${fallRotation}deg`,
          '--rotation-18': `${fallRotation * 0.18}deg`,
          '--rotation-42': `${fallRotation * 0.42}deg`,
          '--rotation-70': `${fallRotation * 0.7}deg`,
          '--bounce-rotation': `${fallRotation - 8}deg`,
          '--landed-rotation': `${leaf.landedRotation}deg`,
          '--landed-scale': leaf.scale * 0.92,
        };
        const imageStyle: CSSProperties = {
          filter: `hue-rotate(${leaf.hue}deg) brightness(${leaf.brightness})`,
          transform: `translate(-50%, -50%) rotate(${landed ? leaf.landedRotation : leaf.rotation}deg) scale(${landed ? leaf.scale * 0.92 : leaf.scale})`,
        };

        return (
          <span
            className={`tree-leaf ${falling ? 'tree-leaf--falling' : landed ? 'tree-leaf--landed' : 'tree-leaf--canopy'}`}
            style={wrapperStyle}
            key={index}
            aria-hidden="true"
          >
            <img src={LEAF_URL} alt="" draggable={false} style={imageStyle} />
          </span>
        );
      })}
    </div>
  );
}
