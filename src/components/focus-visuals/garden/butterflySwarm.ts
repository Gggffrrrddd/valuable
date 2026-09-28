import { T, OPEN } from './finaleTimeline';
import { ARRIVAL_COUNT, COCOON_COUNT, RIG, VARIATION } from './config';
import { smoothstep } from '../model-core/canvasUtils';
import type { StarTarget } from './constellation';
import type { ButterflyRig } from './butterflySprite';
import type { CocoonSlot } from './cocoonSlots';

// Simple deterministic random
function randRange(min: number, max: number, seed: number) {
  const x = Math.sin(seed * 9999.9999) * 10000;
  return min + (x - Math.floor(x)) * (max - min);
}

export class ArrivalSwarm {
  public butterflies: {
    id: number;
    t0: number;
    targetId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    scale: number;
    phaseOffset: number;
    flapHz: number;
    bank: number;
    flipTime: number;
    willFlip: boolean;
    dissolved: boolean;
  }[] = [];
  
  constructor(public targets: StarTarget[], private width: number, private height: number) {
    for (let i = 0; i < ARRIVAL_COUNT; i++) {
      // Pick a target
      const target = targets[i % targets.length];
      
      // Start position (bottom or sides)
      const isSide = randRange(0, 1, i + 1.1) > 0.5;
      const startX = isSide ? (randRange(0, 1, i + 2.2) > 0.5 ? -0.1 : 1.1) * width : randRange(0.2, 0.8, i + 3.3) * width;
      const startY = isSide ? randRange(0.6, 1.2, i + 4.4) * height : 1.1 * height;
      
      this.butterflies.push({
        id: i,
        t0: T.arrivalStart + randRange(0, T.arrivalEnd - T.arrivalStart, i + 5.5),
        targetId: target.id,
        startX,
        startY,
        x: startX,
        y: startY,
        vx: 0,
        vy: -height * randRange(0.1, 0.3, i + 6.6), // initial upward velocity
        scale: randRange(1 - VARIATION.size, 1 + VARIATION.size, i + 7.7) * RIG.minPx, // px size
        phaseOffset: randRange(0, Math.PI * 2, i + 8.8),
        flapHz: RIG.flapHz * randRange(1 - RIG.flapVariance, 1 + RIG.flapVariance, i + 9.9),
        bank: randRange(-RIG.bankDeg, RIG.bankDeg, i + 10.1) * Math.PI / 180,
        flipTime: randRange(T.arrivalStart, T.dissolveStart, i + 11.1),
        willFlip: randRange(0, 1, i + 12.2) < RIG.flipChance,
        dissolved: false
      });
    }
  }

  update(time: number, dt: number) {
    for (const b of this.butterflies) {
      if (time < b.t0 || b.dissolved) continue;
      
      // Dissolve
      if (time >= T.dissolveStart) {
        // Find individual dissolve time within the window based on ID
        const dTime = T.dissolveStart + (b.id / ARRIVAL_COUNT) * (T.dissolveEnd - T.dissolveStart);
        if (time >= dTime) {
          b.dissolved = true;
          continue;
        }
      }

      // Arriving
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      
      // Wander
      b.vx += Math.sin(time * 2 + b.phaseOffset) * 100 * dt;
      b.vy += Math.cos(time * 1.5 + b.phaseOffset) * 50 * dt;
      
      // Damping
      b.vx *= 0.98;
      b.vy *= 0.98;
    }
  }

  getRenderData(time: number): ButterflyRig[] {
    const rigs: ButterflyRig[] = [];
    for (const b of this.butterflies) {
      if (time < b.t0 || b.dissolved) continue;
      
      const isFlipping = b.willFlip && time > b.flipTime && time < b.flipTime + 0.6;
      
      rigs.push({
        x: b.x,
        y: b.y,
        scale: b.scale / RIG.maxPx,
        alpha: smoothstep(b.t0, b.t0 + 0.5, time),
        heading: Math.atan2(b.vy, b.vx) + Math.PI / 2, // head points along velocity
        flapPhase: time * b.flapHz * Math.PI * 2 + b.phaseOffset,
        bank: b.bank,
        isFlipped: isFlipping,
        glowAlpha: 0.5 + 0.5 * Math.cos(time * b.flapHz * Math.PI * 2 + b.phaseOffset)
      });
    }
    return rigs;
  }
}

export class EmergenceSwarm {
  public butterflies: {
    id: number;
    tOpen: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    scale: number;
    phaseOffset: number;
    flapHz: number;
    bank: number;
    dissolved: boolean;
  }[] = [];
  
  constructor(private cocoons: CocoonSlot[], private width: number, private height: number) {
    for (let i = 0; i < COCOON_COUNT; i++) {
      const c = cocoons[i];
      const startX = c.x * width;
      const startY = c.y * height;
      
      this.butterflies.push({
        id: i,
        tOpen: T.openStart + (i / COCOON_COUNT) * OPEN.stagger,
        startX,
        startY,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        scale: randRange(1 - VARIATION.size, 1 + VARIATION.size, i * 1.1) * RIG.maxPx,
        phaseOffset: randRange(0, Math.PI * 2, i * 2.2),
        flapHz: RIG.flapHz * randRange(1 - RIG.flapVariance, 1 + RIG.flapVariance, i * 3.3),
        bank: randRange(-RIG.bankDeg, RIG.bankDeg, i * 4.4) * Math.PI / 180,
        dissolved: false
      });
    }
  }

  update(time: number, dt: number) {
    for (const b of this.butterflies) {
      if (time < b.tOpen || b.dissolved) continue;

      if (time >= T.riseStart && time < T.riseEnd) {
        // Rise
        b.y -= 150 * dt;
        b.x += Math.sin(time * 2 + b.phaseOffset) * 50 * dt;
      }
      
      if (time >= T.writeEnd) {
        b.dissolved = true;
      }
    }
  }

  getRenderData(time: number): ButterflyRig[] {
    const rigs: ButterflyRig[] = [];
    for (const b of this.butterflies) {
      if (time < b.tOpen || b.dissolved) continue;
      
      const age = time - b.tOpen;
      const scaleProgress = smoothstep(0, OPEN.popS, age);
      
      rigs.push({
        x: b.x,
        y: b.y,
        scale: (b.scale / RIG.maxPx) * (0.2 + 0.8 * scaleProgress),
        alpha: smoothstep(0, 0.2, age),
        heading: 0, // emerging straight up
        flapPhase: time * b.flapHz * Math.PI * 2 + b.phaseOffset,
        bank: b.bank,
        isFlipped: false,
        glowAlpha: 0.8
      });
    }
    return rigs;
  }
}