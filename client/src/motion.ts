import type * as THREE from 'three';
import { BODIES, type BodyKind, type Car, HALF } from '../../shared/src/car.ts';
import { RAM_MIN_SPEED, ramResponse } from '../../shared/src/contact.ts';
import { STRANDED_TIME } from '../../shared/src/race.ts';
import { roadAt } from '../../shared/src/collide.ts';
import type { World } from '../../shared/src/physics.ts';
import type { Particles } from './effects.ts';
import { RECHARGE, STRANDED } from './state.ts';
import type { Pose, Track } from '../../shared/src/track.ts';

/** How the browser shows one E-Car: its model, its physics body here, and where it is drawn. */
export interface CarView {
  mesh: THREE.Group; tag: THREE.Sprite; drone: THREE.Group; name: string; kind: BodyKind; mine: boolean; car: Car;
  target: Pose & { vx: number; vz: number; at: number };
  shown: Pose;
  energy: number;
  mode: number;
  prevMode: number;
  modeSince: number;
  lastY: number;
  /** Height of the road under the E-Car. */
  roadY: number;
  /** The model's eased slope along a ramp. */
  tilt: number;
  /** When we last shoved it ourselves (`ourRams`), so the server's word on that Ram isn't applied twice. */
  kickedAt: number;
  wet: boolean;
}

export const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (k: number) => k * k * (3 - 2 * k);


/**
 * The other E-Cars glide on at their reported speed every frame and are only nudged towards where the server says they
 * are, so a late or early update shows as a little drift rather than a jump. Far off (a reset, a new Race) they snap.
 */
export function glide(views: CarView[], dt: number) {
  const now = performance.now(), pull = 1 - Math.exp(-dt * 5), quick = 1 - Math.exp(-dt * 12);
  for (const v of views) {
    if (v.mine) continue;
    const age = Math.min((now - v.target.at) / 1000, 0.3);
    const x = v.target.x + v.target.vx * age, z = v.target.z + v.target.vz * age;
    if (Math.hypot(x - v.shown.x, z - v.shown.z) > 6) { Object.assign(v.shown, { x, y: v.target.y, z, yaw: v.target.yaw }); continue; }
    v.shown.x += v.target.vx * dt + (x - v.shown.x) * pull;
    v.shown.z += v.target.vz * dt + (z - v.shown.z) * pull;
    v.shown.y += (v.target.y - v.shown.y) * quick;
    v.shown.yaw += angleDiff(v.shown.yaw, v.target.yaw) * quick;
  }
}

/**
 * Puts the model where the E-Car is drawn. The bodies stay level, so on a ramp the model is tilted along the road from its tail
 * to its nose (eased) and set down as low as it goes with no part of its underside in the road: where the slope changes
 * under it (the top of a climb, the foot of a descent) it rests on its middle, not sunk in at one end. In the air it
 * levels out and follows the body. `i` is the sample the E-Car is on.
 */
export function place(v: CarView, track: Track, i: number, p: { x: number; y: number; z: number }, yaw: number, dt: number) {
  v.roadY = track.samples[i].y;
  const fx = Math.sin(yaw), fz = Math.cos(yaw), length = BODIES[v.kind].length;
  const roads = (x: number, z: number) => [-1, -0.5, 0, 0.5, 1].flatMap((k) => {
    const a = k * length, road = roadAt(track, i, x + fx * a, z + fz * a);
    return road ? [{ a, y: road.y }] : [];
  });
  const under = roads(p.x, p.z), highest = (rs: { y: number }[]) => Math.max(...rs.map((r) => r.y));
  // the body rests on the highest road under it; well above that it is in the air
  const top = highest(under), first = under[0], last = under[under.length - 1];
  // the others' height eases in late, which would sink them into a ramp while climbing it: while the server has one on
  // the road, it rides the road here (`p` is its `shown` pose)
  if (!v.mine && under.length && v.target.y - HALF.y - highest(roads(v.target.x, v.target.z)) < 0.3) p.y = top + HALF.y;
  const slope = under.length > 1 && p.y - HALF.y - top < 0.3 ? (last.y - first.y) / (last.a - first.a) : 0;
  v.tilt += (clamp(slope, -0.4, 0.4) - v.tilt) * (1 - Math.exp(-dt * 12));
  const drop = under.length ? Math.max(...under.map((r) => r.y - v.tilt * r.a)) - top : 0;
  v.mesh.position.set(p.x, p.y + drop, p.z);
  v.mesh.rotation.set(-Math.atan(v.tilt), yaw, 0, 'YXZ');
}

/**
 * Our own Rams. Here the other E-Cars can't be pushed (they go where the server says), so they'd stop us like a wall: when
 * we drive into one, we shove it at once and keep the way the collision leaves us, as the server works out too.
 * `before` is our velocity going into this physics step.
 */
export function ourRams(world: World, own: CarView, views: CarView[], before: { x: number; z: number }) {
  const rb = own.car.rb, t = rb.translation(), now = performance.now();
  for (const v of views) {
    if (v.mine || now - v.kickedAt < 500) continue;
    if (!world.touching(rb, v.car.rb)) continue;
    const o = v.car.rb.translation(), d = Math.hypot(o.x - t.x, o.z - t.z) || 1, n = { x: (o.x - t.x) / d, z: (o.z - t.z) / d };
    const ours = before.x * n.x + before.z * n.z, theirs = -(v.target.vx * n.x + v.target.vz * n.z);
    // only when we drove into them; when they drive into us, the server's Ram shoves us
    if (ours + theirs < RAM_MIN_SPEED || ours * BODIES[own.kind].mass < theirs * BODIES[v.kind].mass) continue;
    const { kick, keep } = ramResponse(own.car, v.car, n, ours + theirs);
    v.target.vx += n.x * kick;
    v.target.vz += n.z * kick;
    v.kickedAt = now;
    const after = rb.linvel(), along = after.x * n.x + after.z * n.z, want = -theirs + keep;
    rb.setLinvel({ x: after.x + n.x * (want - along), y: after.y, z: after.z + n.z * (want - along) });
  }
}

/**
 * Out of energy: Stranded and jerking on the spot while a drone flies in, then the drone hovers
 * over the E-Car sending charge down into it (the Recharge), and flies off once it's full.
 */
export function dronePose(v: CarView, time: number, { soot, sparks }: { soot: Particles; sparks: Particles }) {
  const since = (performance.now() - v.modeSince) / 1000;
  let droneY = -1, jerk = 0;
  if (v.mode === STRANDED) {
    jerk = Math.max(0, 1 - since / (STRANDED_TIME - 0.4));
    if (since > 0.6) droneY = 14 - smooth(Math.min(1, (since - 0.6) / 0.6)) * 11.4;
  } else if (v.mode === RECHARGE) {
    droneY = 2.6 + Math.sin(time * 5) * 0.15;
    const p = v.mesh.position;
    if (Math.random() < 0.6) sparks.emit(p.x + (Math.random() - 0.5) * 0.6, p.y + 2.2, p.z + (Math.random() - 0.5) * 0.6, 0, -6, 0, 0.3, 0.35);
  } else if (v.prevMode === RECHARGE && since < 0.6) droneY = 2.6 + since ** 2 * 40;
  const p = v.mesh.position;
  p.y += Math.abs(Math.sin(time * 23)) * 0.15 * jerk;
  v.mesh.rotation.z = Math.sin(time * 31) * 0.1 * jerk;
  v.mesh.rotation.x += Math.sin(time * 19) * 0.06 * jerk;
  if (jerk > 0 && Math.random() < 0.3) soot.emit(p.x, p.y + 0.3, p.z, Math.random() - 0.5, 1.5, Math.random() - 0.5, 0.8, 0.9);
  v.drone.visible = droneY >= 0;
  if (v.drone.visible) {
    v.drone.position.set(p.x, p.y + droneY, p.z);
    v.drone.rotation.y = v.mesh.rotation.y;
    for (const rotor of v.drone.userData.rotors as THREE.Object3D[]) rotor.rotation.y += 0.9;
  }
  return v.drone.visible;
}
