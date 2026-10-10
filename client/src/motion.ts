import type * as THREE from 'three';
import { BODIES, type BodyKind, type Car, HALF } from '../../shared/src/car.ts';
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
  wet: boolean;
}

export const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Rise of the road per metre along the Track at sample `i`. */
const gradeAt = (track: Track, i: number) => {
  const a = track.samples[(i - 1 + track.n) % track.n], b = track.samples[(i + 1) % track.n];
  return (b.y - a.y) / Math.hypot(b.x - a.x, b.z - a.z);
};

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
 * Puts the model where the E-Car is drawn. The bodies stay level, so on a ramp the model is tilted along it and set down onto
 * the road; eased, as the road's slope only changes from one sample to the next. `i` is the sample the E-Car is on.
 */
export function place(v: CarView, track: Track, i: number, p: { x: number; y: number; z: number }, yaw: number, dt: number) {
  const s = track.samples[i];
  v.roadY = s.y;
  const along = p.y - s.y < HALF.y + 0.8 ? clamp(gradeAt(track, i), -0.4, 0.4) * (Math.sin(yaw) * s.dx + Math.cos(yaw) * s.dz) : 0;
  v.tilt += (along - v.tilt) * (1 - Math.exp(-dt * 12));
  v.mesh.position.set(p.x, p.y - Math.abs(v.tilt) * BODIES[v.kind].length, p.z);
  v.mesh.rotation.set(-Math.atan(v.tilt), yaw, 0, 'YXZ');
}
