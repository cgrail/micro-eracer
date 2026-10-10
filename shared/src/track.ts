import { kitchen } from './tracks/kitchen.ts';

/** A Track as authored: pieces laid like a turtle walk on a grid of TILE-sized tiles. */
export interface TrackDef {
  id: string;
  name: string;
  /** S = straight, L/R = 90° turn; a trailing `*` gives the piece walls. Must start and end with two straights (start grid). */
  pieces: string;
  props: { kind: 'plate' | 'mug' | 'toaster'; x: number; z: number }[];
}

export interface Sample { x: number; z: number; dx: number; dz: number; walls: boolean }
export interface Pose { x: number; y: number; z: number; yaw: number }
export interface WallSegment { x: number; z: number; yaw: number; length: number }

export interface Track {
  def: TrackDef;
  /** Centreline points ~1 m apart; index 0 is the finish line. */
  samples: Sample[];
  n: number;
  /** Sample index where each piece starts — the Checkpoints, in order. */
  checkpoints: number[];
  walls: WallSegment[];
}

export const TRACKS: TrackDef[] = [kitchen];
export const TILE = 16;
export const HALF_WIDTH = 4.5;
export const ROAD_Y = 0;
export const FALL_Y = -2.5;
const WINDOW = 25;

export const right = (dx: number, dz: number) => ({ x: -dz, z: dx });
export const yawOf = (dx: number, dz: number) => Math.atan2(dx, dz);

export function buildTrack(def: TrackDef): Track {
  const samples: Sample[] = [];
  const checkpoints: number[] = [];
  let px = 0, pz = 0, dx = 0, dz = 1;
  for (const [, kind, star] of def.pieces.matchAll(/([SLR])(\*?)/g)) {
    checkpoints.push(samples.length);
    const walls = star === '*';
    if (kind === 'S') {
      for (let i = 0; i < TILE; i++) samples.push({ x: px + dx * i, z: pz + dz * i, dx, dz, walls });
      px += dx * TILE; pz += dz * TILE;
    } else {
      const r = TILE / 2;
      const side = kind === 'R' ? right(dx, dz) : { x: dz, z: -dx };
      const cx = px + side.x * r, cz = pz + side.z * r;
      const steps = Math.round((Math.PI / 2) * r);
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * (Math.PI / 2), c = Math.cos(a), s = Math.sin(a);
        samples.push({ x: cx - side.x * r * c + dx * r * s, z: cz - side.z * r * c + dz * r * s, dx: dx * c + side.x * s, dz: dz * c + side.z * s, walls });
      }
      px = cx + dx * r; pz = cz + dz * r; dx = side.x; dz = side.z;
    }
  }
  if (Math.hypot(px, pz) > 1e-6 || Math.abs(dz - 1) > 1e-6) throw new Error(`Track ${def.id} does not close`);

  const walls: WallSegment[] = [];
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    if (!samples[i].walls) continue;
    const a = samples[i], b = samples[(i + 1) % n];
    for (const sign of [-1, 1]) {
      const off = sign * (HALF_WIDTH + 0.2);
      const ra = right(a.dx, a.dz), rb = right(b.dx, b.dz);
      const ax = a.x + ra.x * off, az = a.z + ra.z * off, bx = b.x + rb.x * off, bz = b.z + rb.z * off;
      walls.push({ x: (ax + bx) / 2, z: (az + bz) / 2, yaw: yawOf(bx - ax, bz - az), length: Math.hypot(bx - ax, bz - az) });
    }
  }
  return { def, samples, n, checkpoints, walls };
}

/** Pose on the centreline at sample `i`, shifted sideways by `lateral` metres (positive = right). */
export function poseAt(track: Track, i: number, lateral = 0): Pose {
  const s = track.samples[((i % track.n) + track.n) % track.n];
  const r = right(s.dx, s.dz);
  return { x: s.x + r.x * lateral, y: ROAD_Y + 0.6, z: s.z + r.z * lateral, yaw: yawOf(s.dx, s.dz) };
}

/** Start grid: two columns, rows 5 m apart, all behind the finish line. */
export function gridPose(track: Track, slot: number): Pose {
  const row = Math.floor(slot / 2), col = slot % 2;
  return poseAt(track, track.n - (3 + row * 5 + col * 2), col ? 2.2 : -2.2);
}

/**
 * How far an E-Car has come along the Track. `u` counts samples since the finish line and only
 * moves by local steps, so the Laps only count when every Checkpoint is passed in order.
 */
export interface Progress { idx: number; u: number }

export const startProgress = (track: Track, idx: number): Progress => ({ idx, u: idx - track.n });
export const lapOf = (track: Track, p: Progress) => Math.floor(p.u / track.n) + 1;

/** Returns false (and keeps progress) when the E-Car is off the road, e.g. falling or cutting across. */
export function updateProgress(track: Track, p: Progress, x: number, z: number): boolean {
  let best = p.idx, bestD = Infinity;
  for (let k = -WINDOW; k <= WINDOW; k++) {
    const i = (p.idx + k + track.n) % track.n;
    const d = (track.samples[i].x - x) ** 2 + (track.samples[i].z - z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  if (bestD > (HALF_WIDTH + 1.5) ** 2) return false;
  let delta = best - p.idx;
  if (delta > track.n / 2) delta -= track.n;
  if (delta < -track.n / 2) delta += track.n;
  p.u += delta;
  p.idx = best;
  return true;
}

/** Moves progress back to the last Checkpoint passed and returns the pose to put the E-Car at. */
export function resetToCheckpoint(track: Track, p: Progress): Pose {
  let cp = track.checkpoints[0];
  for (const c of track.checkpoints) if (c <= p.idx) cp = c;
  p.u -= p.idx - cp;
  p.idx = cp;
  return poseAt(track, cp);
}

export function nearestSample(track: Track, x: number, z: number): number {
  let best = 0, bestD = Infinity;
  track.samples.forEach((s, i) => {
    const d = (s.x - x) ** 2 + (s.z - z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}
