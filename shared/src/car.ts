import { DT, RigidBody, World } from './physics.ts';
import { type Pose, type Track, PIT_SPEED, right } from './track.ts';

export type BodyKind = 'roadster' | 'suv' | 'microbus' | 'pickup' | 'semi';
export const BODY_KINDS: BodyKind[] = ['roadster', 'suv', 'microbus', 'pickup', 'semi'];

/**
 * How each Body drives, from the quick Roadster to the slow Semi. The bigger ones pay their speed back: `mass` wins Rams and
 * softens Hits, `grip` keeps them on the Track, and `tank` (battery size, times the Roadster's) means fewer Recharges.
 * `length` is half the body's length; the start grid's rows are 5 m apart, so two of them must stay under 5.
 */
export const BODIES: Record<BodyKind, { maxSpeed: number; accel: number; steer: number; mass: number; grip: number; tank: number; length: number }> = {
  roadster: { maxSpeed: 22, accel: 26, steer: 2.7, mass: 1, grip: 8, tank: 1, length: 1.8 },
  suv: { maxSpeed: 20.7, accel: 21, steer: 2.5, mass: 1.5, grip: 10, tank: 1.1, length: 1.9 },
  microbus: { maxSpeed: 19.3, accel: 16, steer: 2.1, mass: 2.2, grip: 12, tank: 1.3, length: 1.8 },
  // a big electric pickup: heavy, but with all that torque it pulls away hard
  pickup: { maxSpeed: 19.2, accel: 20, steer: 2.1, mass: 2.4, grip: 10, tank: 1.35, length: 2.1 },
  // a truck with its trailer: the heaviest, slowest and biggest battery of all
  semi: { maxSpeed: 19, accel: 14, steer: 1.9, mass: 3.4, grip: 13, tank: 1.7, length: 2.4 },
};

export { DT };
/** Half width and height of every body; the length is per Body. */
export const HALF = { x: 0.9, y: 0.45 };
const BRAKE = 30, REVERSE_MAX = 6, DRIFT_IN = 4, DRIFT_OUT = 2.5;
/** How hard the Charging Station holds an E-Car over its limit back to it, harder than the brakes: it is glue. */
const GLUE = 40;

/** `hold`: brake to a halt and then stay put, even on a ramp (Stranded or being Recharged). */
export interface Input { throttle: number; steer: number; hold?: boolean }
export const NO_INPUT: Input = { throttle: 0, steer: 0 };
/**
 * `spin`: yaw rate (rad/s) of a spin-out after a Hit or Ram, fading away; the driver has no control meanwhile.
 * `slide`: seconds left of a skid after being Rammed, with little grip, so the E-Car slides away sideways.
 */
export interface Car { rb: RigidBody; kind: BodyKind; drifting: boolean; spin: number; slide: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How an E-Car out of Energy stops where it ran dry: hard braking, then held still. */
export const HALT: Input = { throttle: 0, steer: 0, hold: true };

export const createTrackWorld = (track: Track) => new World(track);

/** Dynamic for the E-Car this side simulates, kinematic for E-Cars driven elsewhere (the server still sees those touch, for Rams). */
export function createCar(world: World, kind: BodyKind, pose: Pose, dynamic: boolean): Car {
  const rb = world.add(new RigidBody({ x: HALF.x, y: HALF.y, z: BODIES[kind].length }, BODIES[kind].mass, dynamic, pose));
  return { rb, kind, drifting: false, spin: 0, slide: 0 };
}

export function teleport(car: Car, pose: Pose, vx = 0, vz = 0) {
  car.rb.setPose(pose);
  car.rb.setLinvel({ x: vx, y: 0, z: vz });
  car.rb.yawRate = 0;
}

/** Moves a kinematic E-Car; big jumps (Fall-off reset, new Race) teleport so they don't smash anything in between. */
export function setKinematicPose(car: Car, pose: Pose) {
  const { rb } = car;
  if (Math.hypot(rb.x - pose.x, rb.y - pose.y, rb.z - pose.z) > 5) rb.setPose(pose);
  else rb.moveTo(pose);
}

export const MAX_ENERGY = 100;
const LIMP_BELOW = 25;
/** Limp Mode: below a quarter of the Energy, top speed falls gradually to half at empty. */
export const limpScale = (energy: number) => (energy >= LIMP_BELOW ? 1 : 0.5 + (0.5 * Math.max(0, energy)) / LIMP_BELOW);

/** Arcade driving: we own the velocity in the car's plane; the physics does gravity and collisions. `wet` = in a Puddle. */
export function driveCar(world: World, car: Car, input: Input, speedScale = 1, wet = false, pit = false) {
  // the body stays level, so on a ramp it rides on one edge, higher above the road under its middle
  // only the road counts as ground: on another E-Car's roof it can't drive, and gets put down beside it (`unstack`)
  if (!world.onRoad(car.rb, HALF.y + 0.9)) return;
  handleCar(car, input, speedScale, wet, pit);
}

/** How the E-Car handles on the ground: speed, grip, Drifts and spins. The Practice Ground, flat everywhere, needs only this. */
export function handleCar(car: Car, input: Input, speedScale = 1, wet = false, pit = false) {
  const { rb } = car;
  const p = BODIES[car.kind], maxSpeed = p.maxSpeed * speedScale * (pit ? PIT_SPEED : 1);
  const yaw = rb.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), r = right(fx, fz);
  const v = rb.linvel();
  let fs = v.x * fx + v.z * fz, ls = v.x * r.x + v.z * r.z;

  // held: brake either way until nearly stopped, then stand still (gravity would roll it off a slope)
  if (input.hold) { fs = Math.abs(fs) < 1 ? 0 : fs - Math.sign(fs) * BRAKE * DT; ls = Math.abs(ls) < 1 ? 0 : ls; }
  else if (input.throttle > 0) { if (fs < maxSpeed) fs += p.accel * input.throttle * DT; }
  else if (input.throttle < 0) fs += (fs > 0.5 ? BRAKE : p.accel * 0.5) * input.throttle * DT;
  else fs *= 1 - 0.8 * DT;
  if (wet) fs *= 1 - 1.2 * DT;
  // over its limit an E-Car coasts down to it; in the Charging Station it is stuck to it at once
  fs = clamp(fs, -REVERSE_MAX, Math.max(maxSpeed, fs - (pit ? GLUE : 10) * DT));

  car.drifting = Math.abs(ls) > (car.drifting ? DRIFT_OUT : DRIFT_IN);
  const spinning = Math.abs(car.spin) > 0.3;
  car.slide = Math.max(0, car.slide - DT);
  ls *= Math.max(0, 1 - p.grip * (car.slide > 0 ? 0.25 : car.drifting || spinning ? 0.5 : 1) * (wet ? 0.5 : 1) * DT);
  // a Drift rotates the car faster: that is the tighter line through the corner. Pushing on the throttle it turns a little
  // even standing still, so an E-Car stuck nose-first on a wall can get free (touch has no reverse)
  const turning = input.throttle > 0 ? Math.max(0.3, clamp(fs / 8, -1, 1)) : clamp(fs / 8, -1, 1);
  let yawRate = -input.steer * p.steer * (car.drifting ? 1.3 : 1) * turning;
  if (spinning) { yawRate = car.spin; car.spin *= 1 - 1.8 * DT; fs *= 1 - 1.5 * DT; } else car.spin = 0;

  rb.setLinvel({ x: fx * fs + r.x * ls, y: v.y, z: fz * fs + r.z * ls });
  rb.yawRate = yawRate;
}
