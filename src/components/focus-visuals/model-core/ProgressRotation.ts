import { smoothstep } from './canvasUtils';

/**
 * Shared progress-driven rotation / spin-decay / topple behavior.
 *
 * Any spinning-model visual configures a `SpinBehaviorController` once and
 * then calls `update(delta, input)` inside its `useFrame` — the controller
 * owns all the spin/wobble/topple/orbit math and returns the pose to apply.
 * The beyblade uses this today; future spinning visuals just pass their own
 * config values.
 */

export interface SpinBehaviorConfig {
  /** Spin speed (rad/s) while the session is running. */
  spinSpeed: number;
  /** Spin speed used when the user prefers reduced motion. */
  reducedSpinSpeed?: number;
  /** Progress range where pre-topple wobble ramps in. */
  wobbleRange?: [number, number];
  /** Progress where the model starts to topple. */
  toppleStart?: number;
  /** Timing of the completion finale ramp (seconds to full finale). */
  finaleRampSeconds?: number;
  /** Peak extra spin during the finale before braking. */
  finaleSpin?: number;
  /** Finale progress range over which the finale spin decays. */
  finaleSpinDecayRange?: [number, number];
  /** Finale progress range over which the main spin brakes to a stop. */
  spinBrakeRange?: [number, number];
  /** Orbit behavior during the finale (disabled when omitted). */
  orbit?: { speed: number; radius: number; rampRange: [number, number]; collapseRange: [number, number] };
  /** Vertical rise during the finale (0 disables). */
  riseRange?: [number, number];
  riseHeight?: number;
  /** Sinking offset once toppling (0 disables). */
  toppleDrop?: number;
}

export interface SpinBehaviorInput {
  progress: number;
  running: boolean;
  finaleActive: boolean;
  complete: boolean;
  reducedMotion?: boolean;
}

export interface SpinPose {
  /** Angle (rad) to apply to the spin group around Y. */
  spinAngle: number;
  topple: number;
  wobble: number;
  finaleMix: number;
  /** Lateral orbit offsets for the pose group. */
  orbitX: number;
  orbitZ: number;
  /** Vertical rise from the finale (before topple drop is applied). */
  rise: number;
  /** Composed vertical offset: finale rise minus topple drop. */
  y: number;
  /** Continuous clock driving wobble oscillation. */
  elapsed: number;
}

export interface SpinBehaviorController {
  update: (delta: number, input: SpinBehaviorInput) => SpinPose;
  reset: () => void;
}

export function createSpinBehaviorController(config: SpinBehaviorConfig): SpinBehaviorController {
  const {
    spinSpeed,
    reducedSpinSpeed = 1.15,
    wobbleRange = [0.62, 0.96],
    toppleStart = 0.94,
    finaleRampSeconds = 5,
    finaleSpin = 18,
    finaleSpinDecayRange = [0.34, 0.82],
    spinBrakeRange = [0.58, 0.88],
    orbit,
    riseRange = [0.28, 0.84],
    riseHeight = 1.05,
    toppleDrop = 0.34,
  } = config;

  let spinAngle = 0;
  let orbitAngle = 0;
  let finaleClock = 0;
  let elapsed = 0;

  function update(delta: number, input: SpinBehaviorInput): SpinPose {
    const reducedMotion = !!input.reducedMotion;
    elapsed += delta;

    if (input.complete) finaleClock = 1;
    else if (!input.finaleActive) finaleClock = 0;
    else if (input.running && !reducedMotion) finaleClock = Math.min(1, finaleClock + delta / finaleRampSeconds);
    const finaleMix = reducedMotion ? 0 : finaleClock;

    const topple = reducedMotion ? 0 : smoothstep(toppleStart, 1, input.progress) * (1 - finaleMix);
    const wobble = reducedMotion ? 0 : smoothstep(wobbleRange[0], wobbleRange[1], input.progress) * (1 - topple) * (1 - finaleMix);

    const baseSpeed = reducedMotion ? reducedSpinSpeed : spinSpeed;
    const finaleSpinNow = finaleSpin * (1 - smoothstep(finaleSpinDecayRange[0], finaleSpinDecayRange[1], finaleMix));
    const spinBrake = 1 - smoothstep(spinBrakeRange[0], spinBrakeRange[1], finaleMix);
    const effectiveSpeed = finaleMix > 0 ? Math.max(baseSpeed, finaleSpinNow) * spinBrake : baseSpeed;
    if (input.running || reducedMotion) spinAngle += delta * effectiveSpeed;

    let orbitX = 0;
    let orbitZ = 0;
    if (orbit && input.running && finaleMix > 0 && finaleMix < 0.92) {
      orbitAngle += delta * orbit.speed;
      const orbitRamp = smoothstep(orbit.rampRange[0], orbit.rampRange[1], finaleMix);
      const orbitCollapse = smoothstep(orbit.collapseRange[0], orbit.collapseRange[1], finaleMix);
      const orbitRadius = orbit.radius * orbitRamp * (1 - orbitCollapse);
      orbitX = Math.cos(orbitAngle) * orbitRadius;
      orbitZ = Math.sin(orbitAngle) * orbitRadius;
    }

    const rise = smoothstep(riseRange[0], riseRange[1], finaleMix) * riseHeight;
    const y = rise - topple * toppleDrop;

    return { spinAngle, topple, wobble, finaleMix, orbitX, orbitZ, rise, y, elapsed };
  }

  function reset() {
    spinAngle = 0;
    orbitAngle = 0;
    finaleClock = 0;
    elapsed = 0;
  }

  return { update, reset };
}

/** Drop-in config matching the beyblade's tuned behavior. */
export const BLADE_SPIN_CONFIG: SpinBehaviorConfig = {
  spinSpeed: 25, // Consistent 25 rad/s throughout session
  reducedSpinSpeed: 1.15,
  wobbleRange: [0.62, 0.96],
  toppleStart: 0.94,
  finaleRampSeconds: 5,
  finaleSpin: 18,
  finaleSpinDecayRange: [0.34, 0.82],
  spinBrakeRange: [0.58, 0.88],
  orbit: { speed: 16, radius: 0.78, rampRange: [0, 0.16], collapseRange: [0.62, 0.9] },
  riseRange: [0.28, 0.84],
  riseHeight: 1.05,
  toppleDrop: 0.34,
};
