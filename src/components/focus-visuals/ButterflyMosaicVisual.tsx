import { useEffect, useRef, useState } from 'react';
import ButterflySprite from './butterfly/ButterflySprite';
import { projectPoint } from './butterfly/projection';
import { sampleLionSurface } from './butterfly/sampling';
import type { ButterflyNode, ButterflyPoint } from './butterfly/types';
import type { FocusVisualProps } from './types';

interface ButterflyMosaicProps extends FocusVisualProps {
  duration: number;
}

const DESKTOP_COUNT = 260;
const MOBILE_COUNT = 190;
const PREVIEW_COUNT = 72;
const MAX_FLYING = 8;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function finishFlight(node: ButterflyNode) {
  node.point.state = 'landed';
  node.point.arrivalProgress = 1;
  node.flight?.classList.remove('butterfly-flight--active');
  node.flight?.classList.add('butterfly-flight--landed');
}

export default function ButterflyMosaicVisual({ progress, duration }: ButterflyMosaicProps) {
  const [points, setPoints] = useState<ButterflyPoint[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<ButterflyNode[]>([]);
  const sessionSeedRef = useRef(Math.floor(Math.random() * 2_147_483_647));
  const progressRef = useRef(progress);
  const reducedMotion = useReducedMotion();
  const activeSession = duration > 0;
  const complete = progress >= 1;

  progressRef.current = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    let cancelled = false;
    const count = activeSession ? (window.innerWidth < 700 ? MOBILE_COUNT : DESKTOP_COUNT) : PREVIEW_COUNT;
    sampleLionSurface(count, sessionSeedRef.current).then((sampled) => {
      if (!cancelled) {
        nodesRef.current = sampled.map((point) => ({ slot: null, flight: null, point, startedAt: 0 }));
        setPoints(sampled);
      }
    }).catch(() => {
      if (!cancelled) setLoadFailed(true);
    });
    return () => { cancelled = true; };
  }, [activeSession]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || points.length === 0) return;
    let frame = 0;
    let previous = performance.now();
    let sceneAngle = -.18;
    let width = root.clientWidth;
    let height = root.clientHeight;
    const resizeObserver = new ResizeObserver(() => {
      width = root.clientWidth;
      height = root.clientHeight;
    });
    resizeObserver.observe(root);

    const animate = (now: number) => {
      const delta = Math.min(.05, (now - previous) / 1000);
      previous = now;
      const value = progressRef.current;
      const expected = value >= 1 ? points.length : Math.floor(value * points.length);
      if (!reducedMotion) sceneAngle += delta * Math.PI * 2 / 72;

      let flying = 0;
      for (const node of nodesRef.current) {
        if (node.point.state === 'flying') flying += 1;
      }

      for (const node of nodesRef.current) {
        const { point, slot, flight } = node;
        if (!slot || !flight) continue;
        const projected = projectPoint(point.position, point.normal, reducedMotion ? -.18 : sceneAngle);
        point.depth = projected.depth;
        point.frontFacing = projected.frontFacing;
        const depthScale = point.scale * projected.scale;
        const screenX = projected.x * width / 100;
        const screenY = projected.y * height / 100;
        slot.style.transform = `translate3d(${screenX.toFixed(2)}px,${screenY.toFixed(2)}px,0) translate(-50%,-50%) rotate(${(projected.rotation + point.rotation * .2).toFixed(2)}deg) scale3d(${depthScale.toFixed(3)},${depthScale.toFixed(3)},1)`;
        slot.style.zIndex = String(20 + Math.round((projected.depth + 1) * 40));
        slot.style.filter = projected.depth < -.1 ? `brightness(${(.66 + projected.depth * .08).toFixed(2)}) blur(.45px)` : `brightness(${(1 + projected.depth * .11).toFixed(2)})`;
        slot.classList.toggle('butterfly-slot--back', !projected.frontFacing);

        if (point.revealRank >= expected) continue;
        if (point.state === 'waiting') {
          if (reducedMotion || value >= 1) {
            finishFlight(node);
            slot.style.opacity = '1';
          } else if (flying < MAX_FLYING) {
            point.state = 'flying';
            node.startedAt = now;
            flying += 1;
            slot.style.opacity = '1';
            const fromX = (point.entryX - projected.x) * width / 100;
            const fromY = (point.entryY - projected.y) * height / 100;
            flight.style.transition = 'none';
            flight.style.transform = `translate3d(${fromX.toFixed(1)}px,${fromY.toFixed(1)}px,0) scale3d(.54,.54,1)`;
            flight.style.opacity = '0';
            void flight.offsetWidth;
            flight.classList.add('butterfly-flight--active');
            flight.style.transition = `transform ${4.8 + (point.id % 6) * .32}s cubic-bezier(.16,.82,.24,1), opacity 1.4s ease-out`;
            flight.style.transform = 'translate3d(0,0,0) scale3d(1,1,1)';
            flight.style.opacity = '1';
          }
        } else if (point.state === 'flying') {
          const durationMs = (4.8 + (point.id % 6) * .32) * 1000;
          point.arrivalProgress = Math.min(1, (now - node.startedAt) / durationMs);
          if (point.arrivalProgress >= 1) finishFlight(node);
        }
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [points, reducedMotion]);

  if (loadFailed) {
    return <div className="butterfly-mosaic butterfly-mosaic--error" role="img" aria-label="Butterfly mosaic unavailable" />;
  }

  return (
    <div ref={rootRef} className={`butterfly-mosaic focus-visual ${complete ? 'visual-complete' : ''}`} role="img" aria-label={`Butterfly lion mosaic ${Math.round(progress * 100)} percent complete`}>
      <div className="butterfly-mosaic__light" aria-hidden="true" />
      <div className="butterfly-mosaic__dust" aria-hidden="true" />
      <div className="butterfly-mosaic__halo visual-finish-glow" aria-hidden="true" />
      {points.length === 0 && <div className="butterfly-mosaic__loading" aria-hidden="true" />}
      <div className="butterfly-mosaic__scene">
        {points.map((point, index) => (
          <ButterflySprite
            key={point.id}
            point={point}
            slotRef={(element) => { if (nodesRef.current[index]) nodesRef.current[index].slot = element; }}
            flightRef={(element) => { if (nodesRef.current[index]) nodesRef.current[index].flight = element; }}
          />
        ))}
      </div>
    </div>
  );
}
