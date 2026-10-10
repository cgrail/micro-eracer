import { bathtub } from './tracks/bathtub.ts';
import { desk } from './tracks/desk.ts';
import { garden } from './tracks/garden.ts';
import { kitchen } from './tracks/kitchen.ts';

export type Theme = 'kitchen' | 'garden' | 'desk' | 'bathtub';

/** A Track as authored: pieces laid like a turtle walk on a grid of TILE-sized tiles. */
export interface TrackDef {
  id: string;
  name: string;
  /** Sets the scenery around the Track. */
  theme: Theme;
  /**
   * S = straight, L/R = 90° turn, U/D = straight ramp up/down by RISE, J = straight with a kicker that ends in a drop (a jump);
   * a trailing `*` gives the piece walls. Must start and end with two straights (start grid) and end at the height it started.
   * The Track may cross itself where one part runs over the other (a bridge).
   */
  pieces: string;
  /** Indexes of the pieces with a Puddle in their middle. */
  puddles: number[];
  /** Indexes of the pieces with a row of Item Boxes across their middle. */
  items: number[];
}

/** `y` is the road surface; `kick` marks the ramp of a jump. */
export interface Sample { x: number; y: number; z: number; dx: number; dz: number; walls: boolean; turn: boolean; kick: boolean }
export interface Circle { x: number; y: number; z: number; r: number }
export interface Pose { x: number; y: number; z: number; yaw: number }
export interface WallSegment { x: number; y: number; z: number; yaw: number; pitch: number; length: number }
type Point = { x: number; y: number; z: number };

export interface Track {
  def: TrackDef;
  /** Centreline points ~1 m apart; index 0 is the finish line. */
  samples: Sample[];
  n: number;
  /** Sample index where each piece starts — the Checkpoints, in order. */
  checkpoints: number[];
  walls: WallSegment[];
  /** Centre of every tile the road runs through, so scenery can avoid them. */
  tiles: { x: number; z: number }[];
  puddles: Circle[];
  itemBoxes: Pose[];
}

export const TRACKS: TrackDef[] = [kitchen, garden, desk, bathtub];
export const TILE = 16;
export const HALF_WIDTH = 4.5;
/** Below the road under it by this much, an E-Car has fallen off (also off a bridge onto the road below). */
export const FALL_Y = -2.5;
/** Height of a ramp, so a bridge clears the road it crosses. */
export const RISE = 3.5;
const KICK = 1.2, KICK_LEN = 10, WINDOW = 25;
/** Whether two heights are on the same part of a Track that crosses itself. */
export const sameLevel = (a: number, b: number) => Math.abs(a - b) < RISE * 0.7;

export const right = (dx: number, dz: number) => ({ x: -dz, z: dx });
export const yawOf = (dx: number, dz: number) => Math.atan2(dx, dz);

export function buildTrack(def: TrackDef): Track {
  const samples: Sample[] = [];
  const checkpoints: number[] = [];
  const tiles: { x: number; z: number }[] = [];
  let px = 0, pz = 0, dx = 0, dz = 1, h = 0;
  for (const [, kind, star] of def.pieces.matchAll(/([SLRUDJ])(\*?)/g)) {
    checkpoints.push(samples.length);
    tiles.push({ x: px + (dx * TILE) / 2, z: pz + (dz * TILE) / 2 });
    const walls = star === '*', turn = kind === 'L' || kind === 'R';
    if (!turn) {
      // ramps ease in and out so E-Cars don't scrape; a kicker steepens to its lip, then drops back to the road
      const rise = kind === 'U' ? RISE : kind === 'D' ? -RISE : 0;
      for (let i = 0; i < TILE; i++) {
        const kick = kind === 'J' && i < KICK_LEN;
        const y = h + (rise * (1 - Math.cos((Math.PI * i) / TILE))) / 2 + (kick ? KICK * (i / (KICK_LEN - 1)) ** 2 : 0);
        samples.push({ x: px + dx * i, y, z: pz + dz * i, dx, dz, walls, turn, kick });
      }
      px += dx * TILE; pz += dz * TILE; h += rise;
    } else {
      const r = TILE / 2;
      const side = kind === 'R' ? right(dx, dz) : { x: dz, z: -dx };
      const cx = px + side.x * r, cz = pz + side.z * r;
      const steps = Math.round((Math.PI / 2) * r);
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * (Math.PI / 2), c = Math.cos(a), s = Math.sin(a);
        samples.push({ x: cx - side.x * r * c + dx * r * s, y: h, z: cz - side.z * r * c + dz * r * s, dx: dx * c + side.x * s, dz: dz * c + side.z * s, walls, turn, kick: false });
      }
      px = cx + dx * r; pz = cz + dz * r; dx = side.x; dz = side.z;
    }
  }
  if (Math.hypot(px, pz) > 1e-6 || Math.abs(dz - 1) > 1e-6 || h !== 0) throw new Error(`Track ${def.id} does not close`);
  const n = samples.length;
  // where the Track meets itself it must pass over, never through: a crossing on one level would be a shortcut
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = samples[i], b = samples[j];
    if (Math.min(j - i, n - j + i) > 2 * WINDOW && (a.x - b.x) ** 2 + (a.z - b.z) ** 2 < (2 * HALF_WIDTH + 1) ** 2 && sameLevel(a.y, b.y)) {
      throw new Error(`Track ${def.id} runs into itself at samples ${i} and ${j}`);
    }
  }

  const walls: WallSegment[] = [];
  for (let i = 0; i < n; i++) {
    if (!samples[i].walls) continue;
    const a = samples[i], b = samples[(i + 1) % n];
    for (const sign of [-1, 1]) {
      const off = sign * (HALF_WIDTH + 0.2);
      const ra = right(a.dx, a.dz), rb = right(b.dx, b.dz);
      const ax = a.x + ra.x * off, az = a.z + ra.z * off, bx = b.x + rb.x * off, bz = b.z + rb.z * off;
      const flat = Math.hypot(bx - ax, bz - az);
      walls.push({ x: (ax + bx) / 2, y: (a.y + b.y) / 2, z: (az + bz) / 2, yaw: yawOf(bx - ax, bz - az), pitch: -Math.atan2(b.y - a.y, flat), length: Math.hypot(flat, b.y - a.y) });
    }
  }
  const middle = (piece: number) => Math.floor((checkpoints[piece] + (checkpoints[piece + 1] ?? n)) / 2);
  const puddles = def.puddles.map((piece) => { const { x, y, z } = samples[middle(piece)]; return { x, y, z, r: 3.2 }; });
  const track: Track = { def, samples, n, checkpoints, walls, tiles, puddles, itemBoxes: [] };
  track.itemBoxes = def.items.flatMap((piece) => [-2.8, 0, 2.8].map((lateral) => poseAt(track, middle(piece), lateral)));
  return track;
}

export const inPuddle = (track: Track, t: Point) => track.puddles.some((p) => (p.x - t.x) ** 2 + (p.z - t.z) ** 2 < p.r ** 2 && sameLevel(p.y, t.y));

/** Sideways distance of a point from the centreline at sample `idx` (positive = right). */
export function lateralOf(track: Track, idx: number, x: number, z: number) {
  const s = track.samples[((idx % track.n) + track.n) % track.n], r = right(s.dx, s.dz);
  return (x - s.x) * r.x + (z - s.z) * r.z;
}

/** Pose on the centreline at sample `i`, shifted sideways by `lateral` metres (positive = right). */
export function poseAt(track: Track, i: number, lateral = 0): Pose {
  const s = track.samples[((i % track.n) + track.n) % track.n];
  const r = right(s.dx, s.dz);
  return { x: s.x + r.x * lateral, y: s.y + 0.6, z: s.z + r.z * lateral, yaw: yawOf(s.dx, s.dz) };
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

/** Nearest sample in 3D, so on a bridge it is the bridge and under it the road below. */
export function nearestSample(track: Track, x: number, y: number, z: number): number {
  let best = 0, bestD = Infinity;
  track.samples.forEach((s, i) => {
    const d = (s.x - x) ** 2 + (s.y - y) ** 2 + (s.z - z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}
