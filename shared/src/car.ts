import RAPIER from '@dimforge/rapier3d-compat';
import { type Pose, type Track, HALF_WIDTH, ROAD_Y, right } from './track.ts';

export type BodyKind = 'microbus' | 'roadster';
export const BODY_KINDS: BodyKind[] = ['microbus', 'roadster'];

// shortcut: placeholder handling; real tuning (the Microbus must still be able to win) is build step 4
export const BODIES: Record<BodyKind, { maxSpeed: number; accel: number; steer: number; mass: number }> = {
  microbus: { maxSpeed: 20, accel: 20, steer: 2.3, mass: 1.6 },
  roadster: { maxSpeed: 21.5, accel: 24, steer: 2.6, mass: 1.0 },
};

export const DT = 1 / 60;
export const HALF = { x: 0.9, y: 0.45, z: 1.8 };
const BRAKE = 30, REVERSE_MAX = 6, GRIP = 9, DRIFT_GRIP = 4.5, DRIFT_IN = 4, DRIFT_OUT = 2.5;

export interface Input { throttle: number; steer: number }
export const NO_INPUT: Input = { throttle: 0, steer: 0 };
export interface Car { rb: RAPIER.RigidBody; kind: BodyKind; drifting: boolean }

export const initPhysics = () => RAPIER.init();
export const yawQuat = (yaw: number) => ({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
// valid because E-Cars only rotate around the vertical axis
export const yawOfBody = (rb: RAPIER.RigidBody) => { const q = rb.rotation(); return 2 * Math.atan2(q.y, q.w); };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function createTrackWorld(track: Track): RAPIER.World {
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  world.timestep = DT;
  const verts = new Float32Array(track.n * 6), idx = new Uint32Array(track.n * 6);
  track.samples.forEach((s, i) => {
    const r = right(s.dx, s.dz);
    verts.set([s.x - r.x * HALF_WIDTH, ROAD_Y, s.z - r.z * HALF_WIDTH, s.x + r.x * HALF_WIDTH, ROAD_Y, s.z + r.z * HALF_WIDTH], i * 6);
    const j = (i + 1) % track.n;
    idx.set([2 * i, 2 * i + 1, 2 * j, 2 * i + 1, 2 * j + 1, 2 * j], i * 6);
  });
  world.createCollider(RAPIER.ColliderDesc.trimesh(verts, idx, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(0));
  for (const w of track.walls) {
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.5, w.length / 2 + 0.05)
      .setTranslation(w.x, ROAD_Y + 0.5, w.z).setRotation(yawQuat(w.yaw)).setFriction(0).setRestitution(0.3));
  }
  return world;
}

/** Dynamic for the E-Car this side simulates, kinematic for E-Cars driven elsewhere. */
export function createCar(world: RAPIER.World, kind: BodyKind, pose: Pose, dynamic: boolean): Car {
  const desc = dynamic ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.kinematicPositionBased();
  const rb = world.createRigidBody(desc.setTranslation(pose.x, pose.y, pose.z).setRotation(yawQuat(pose.yaw)).enabledRotations(false, true, false));
  const r = 0.15;
  world.createCollider(RAPIER.ColliderDesc.roundCuboid(HALF.x - r, HALF.y - r, HALF.z - r, r)
    .setMass(BODIES[kind].mass).setFriction(0).setRestitution(0.3)
    // Players' E-Cars are kinematic on the server; their contacts are still needed to judge Rams
    .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.DEFAULT | RAPIER.ActiveCollisionTypes.KINEMATIC_KINEMATIC), rb);
  return { rb, kind, drifting: false };
}

export function teleport(car: Car, pose: Pose, vx = 0, vz = 0) {
  car.rb.setTranslation(pose, true);
  car.rb.setRotation(yawQuat(pose.yaw), true);
  car.rb.setLinvel({ x: vx, y: 0, z: vz }, true);
  car.rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

/** Moves a kinematic E-Car; big jumps (Fall-off reset, new Race) teleport so they don't smash anything in between. */
export function setKinematicPose(car: Car, pose: Pose) {
  const t = car.rb.translation();
  if (Math.hypot(t.x - pose.x, t.y - pose.y, t.z - pose.z) > 5) { car.rb.setTranslation(pose, true); car.rb.setRotation(yawQuat(pose.yaw), true); }
  else { car.rb.setNextKinematicTranslation(pose); car.rb.setNextKinematicRotation(yawQuat(pose.yaw)); }
}

export const MAX_ENERGY = 100;
const LIMP_BELOW = 25;
/** Limp Mode: below a quarter of the Energy, top speed falls gradually to half at empty. */
export const limpScale = (energy: number) => (energy >= LIMP_BELOW ? 1 : 0.5 + (0.5 * Math.max(0, energy)) / LIMP_BELOW);

/** Arcade driving: we own the velocity in the car's plane; Rapier does gravity and collisions. `wet` = in a Puddle. */
export function driveCar(world: RAPIER.World, car: Car, input: Input, speedScale = 1, wet = false) {
  const { rb } = car;
  const t = rb.translation();
  const grounded = world.castRay(new RAPIER.Ray(t, { x: 0, y: -1, z: 0 }), HALF.y + 0.3, true, undefined, undefined, undefined, rb);
  if (!grounded) return;
  const p = BODIES[car.kind], maxSpeed = p.maxSpeed * speedScale;
  const yaw = yawOfBody(rb), fx = Math.sin(yaw), fz = Math.cos(yaw), r = right(fx, fz);
  const v = rb.linvel();
  let fs = v.x * fx + v.z * fz, ls = v.x * r.x + v.z * r.z;

  if (input.throttle > 0) { if (fs < maxSpeed) fs += p.accel * input.throttle * DT; }
  else if (input.throttle < 0) fs += (fs > 0.5 ? BRAKE : p.accel * 0.5) * input.throttle * DT;
  else fs *= 1 - 0.8 * DT;
  if (wet) fs *= 1 - 1.2 * DT;
  fs = clamp(fs, -REVERSE_MAX, Math.max(maxSpeed, fs - 10 * DT));

  car.drifting = Math.abs(ls) > (car.drifting ? DRIFT_OUT : DRIFT_IN);
  ls *= Math.max(0, 1 - (car.drifting ? DRIFT_GRIP : GRIP) * (wet ? 0.5 : 1) * DT);
  // a Drift rotates the car faster: that is the tighter line through the corner
  const yawRate = -input.steer * p.steer * (car.drifting ? 1.3 : 1) * clamp(fs / 8, -1, 1);

  rb.setLinvel({ x: fx * fs + r.x * ls, y: v.y, z: fz * fs + r.z * ls }, true);
  rb.setAngvel({ x: 0, y: yawRate, z: 0 }, true);
}
