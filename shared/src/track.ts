import { bathtub } from './tracks/bathtub.ts';
import { desk } from './tracks/desk.ts';
import { garden } from './tracks/garden.ts';
import { kitchen } from './tracks/kitchen.ts';
import { googleBallpit } from './tracks/google-ballpit.ts';
import { googleSlide } from './tracks/google-slide.ts';
import { googleJump } from './tracks/google-jump.ts';
import { sapRing } from './tracks/sap-ring.ts';
import { sapCorridor } from './tracks/sap-corridor.ts';
import { facebookLane } from './tracks/facebook-lane.ts';
import { facebookHacker } from './tracks/facebook-hacker.ts';
import { anthropicBridge } from './tracks/anthropic-bridge.ts';
import { anthropicReading } from './tracks/anthropic-reading.ts';
import { lanCables } from './tracks/lan-cables.ts';
import { lanRespawn } from './tracks/lan-respawn.ts';
import { golfFairway } from './tracks/golf-fairway.ts';
import { golfBunker } from './tracks/golf-bunker.ts';
import { soccerTouchline } from './tracks/soccer-touchline.ts';
import { soccerLongball } from './tracks/soccer-longball.ts';
import { londonPiccadilly } from './tracks/london-piccadilly.ts';
import { londonTowerbridge } from './tracks/london-towerbridge.ts';
import { londonBigben } from './tracks/london-bigben.ts';
import { newyorkBroadway } from './tracks/newyork-broadway.ts';
import { newyorkBrooklyn } from './tracks/newyork-brooklyn.ts';
import { newyorkTimessquare } from './tracks/newyork-timessquare.ts';
import { parisChamps } from './tracks/paris-champs.ts';
import { parisSeine } from './tracks/paris-seine.ts';
import { parisEiffel } from './tracks/paris-eiffel.ts';
import { vegasStrip } from './tracks/vegas-strip.ts';
import { vegasJackpot } from './tracks/vegas-jackpot.ts';
import { vegasHighroller } from './tracks/vegas-highroller.ts';
import { berlinDoner } from './tracks/berlin-doner.ts';
import { berlinKreuzberg } from './tracks/berlin-kreuzberg.ts';
import { berlinSpaeti } from './tracks/berlin-spaeti.ts';
import { heidelbergOldbridge } from './tracks/heidelberg-oldbridge.ts';
import { heidelbergCastle } from './tracks/heidelberg-castle.ts';
import { heidelbergHauptstrasse } from './tracks/heidelberg-hauptstrasse.ts';
import { heidelbergPhilosophers } from './tracks/heidelberg-philosophers.ts';
import { indiaCurry } from './tracks/india-curry.ts';
import { indiaThali } from './tracks/india-thali.ts';
import { indiaChai } from './tracks/india-chai.ts';
import { hollywoodMulholland } from './tracks/hollywood-mulholland.ts';
import { hollywoodStunt } from './tracks/hollywood-stunt.ts';
import { sanfranciscoLombard } from './tracks/sanfrancisco-lombard.ts';
import { sanfranciscoNobhill } from './tracks/sanfrancisco-nobhill.ts';
import { sanfranciscoGoldengate } from './tracks/sanfrancisco-goldengate.ts';
import { zuzenhausenTraining } from './tracks/zuzenhausen-training.ts';
import { zuzenhausenElsenz } from './tracks/zuzenhausen-elsenz.ts';
import { sinsheimMuseum } from './tracks/sinsheim-museum.ts';
import { sinsheimConcorde } from './tracks/sinsheim-concorde.ts';

/** Sets the scenery around a Track: the first four are at home, the rest around the world. */
export type Theme =
  | 'kitchen' | 'garden' | 'desk' | 'bathtub'
  | 'google' | 'sap' | 'facebook' | 'anthropic' | 'lan' | 'golf' | 'soccer' | 'london' | 'newyork' | 'paris' | 'vegas' | 'berlin'
  | 'heidelberg' | 'india' | 'hollywood' | 'sanfrancisco' | 'zuzenhausen' | 'sinsheim';

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

/** `y` is the road surface; `kick` marks the ramp of a jump; `bay` is how far the Charging Station widens the road on the right. */
export interface Sample { x: number; y: number; z: number; dx: number; dz: number; walls: boolean; turn: boolean; kick: boolean; bay: number }
export interface Circle { x: number; y: number; z: number; r: number }
export interface Pose { x: number; y: number; z: number; yaw: number }
/** `idx`: the sample the wall starts at. */
export interface WallSegment { x: number; y: number; z: number; yaw: number; pitch: number; length: number; idx: number }
type Point = { x: number; y: number; z: number };

export interface Track {
  def: TrackDef;
  /** Centreline points ~1 m apart; index 0 is the finish line. */
  samples: Sample[];
  n: number;
  /** Sample index where each piece starts — the Checkpoints, in order. */
  checkpoints: number[];
  walls: WallSegment[];
  /** Centre of every tile the road (or the Charging Station beside it) uses, so scenery can avoid them. */
  tiles: { x: number; z: number }[];
  puddles: Circle[];
  /** `idx`: the sample the box stands at. */
  itemBoxes: (Pose & { idx: number })[];
}

/** Every Track, in the order the start screen offers them: the first four at home, then the world. */
export const TRACKS: TrackDef[] = [
  kitchen, garden, desk, bathtub,
  googleBallpit, googleSlide, googleJump, sapRing, sapCorridor, facebookLane, facebookHacker, anthropicBridge, anthropicReading,
  lanCables, lanRespawn, golfFairway, golfBunker, soccerTouchline, soccerLongball, londonPiccadilly, londonTowerbridge,
  londonBigben, newyorkBroadway, newyorkBrooklyn, newyorkTimessquare, parisChamps, parisSeine, parisEiffel, vegasStrip,
  vegasJackpot, vegasHighroller, berlinDoner, berlinKreuzberg, berlinSpaeti, heidelbergOldbridge, heidelbergCastle,
  heidelbergHauptstrasse, heidelbergPhilosophers, indiaCurry, indiaThali, indiaChai, hollywoodMulholland, hollywoodStunt,
  sanfranciscoLombard, sanfranciscoNobhill, sanfranciscoGoldengate, zuzenhausenTraining, zuzenhausenElsenz, sinsheimMuseum,
  sinsheimConcorde,
];
/** The Tracks apps from before the Track picker know: their `race` room only ever races these. */
export const CLASSIC_TRACKS = ['kitchen', 'garden', 'desk', 'bathtub'];
export const TILE = 16;
export const HALF_WIDTH = 4.5;
/** Below the road under it by this much, an E-Car has fallen off (also off a bridge onto the road below). */
export const FALL_Y = -2.5;
/** Height of a ramp, so a bridge clears the road it crosses. */
export const RISE = 3.5;
const KICK = 1.8, KICK_LEN = 10, WINDOW = 25;
/** How far apart two E-Cars' middles must be for a reset not to land one on the other (the Semi is 4.8 m long). */
const CLEAR = 5;
/** The Charging Station: a bay this wide on the right of the last straights, from BAY_FROM to BAY_TO samples before the finish line. */
export const BAY_WIDTH = 5;
/** Speed limit in the Charging Station, times the top speed: charging there costs time, so it's a detour. */
export const PIT_SPEED = 0.45;
const BAY_FROM = 30, BAY_TO = 5, BAY_TAPER = 4;
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
        samples.push({ x: px + dx * i, y, z: pz + dz * i, dx, dz, walls, turn, kick, bay: 0 });
      }
      px += dx * TILE; pz += dz * TILE; h += rise;
    } else {
      const r = TILE / 2;
      const side = kind === 'R' ? right(dx, dz) : { x: dz, z: -dx };
      const cx = px + side.x * r, cz = pz + side.z * r;
      const steps = Math.round((Math.PI / 2) * r);
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * (Math.PI / 2), c = Math.cos(a), s = Math.sin(a);
        samples.push({ x: cx - side.x * r * c + dx * r * s, y: h, z: cz - side.z * r * c + dz * r * s, dx: dx * c + side.x * s, dz: dz * c + side.z * s, walls, turn, kick: false, bay: 0 });
      }
      px = cx + dx * r; pz = cz + dz * r; dx = side.x; dz = side.z;
    }
  }
  if (Math.hypot(px, pz) > 1e-6 || Math.abs(dz - 1) > 1e-6 || h !== 0) throw new Error(`Track ${def.id} does not close`);
  const n = samples.length;
  // the bay eases in and out at its ends, so E-Cars can drive in and out anywhere along it
  for (let i = n - BAY_FROM; i <= n - BAY_TO; i++) samples[i].bay = BAY_WIDTH * Math.min(1, (i - (n - BAY_FROM)) / BAY_TAPER, (n - BAY_TO - i) / BAY_TAPER);
  for (const piece of [tiles.length - 2, tiles.length - 1]) {
    const s = samples[checkpoints[piece]], r = right(s.dx, s.dz);
    tiles.push({ x: tiles[piece].x + r.x * TILE, z: tiles[piece].z + r.z * TILE });
  }
  // where the Track meets itself it must pass over, never through: a crossing on one level would be a shortcut
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = samples[i], b = samples[j];
    if (Math.min(j - i, n - j + i) > 2 * WINDOW && (a.x - b.x) ** 2 + (a.z - b.z) ** 2 < (2 * HALF_WIDTH + 1) ** 2 && sameLevel(a.y, b.y)) {
      throw new Error(`Track ${def.id} runs into itself at samples ${i} and ${j}`);
    }
  }
  for (let i = n - BAY_FROM; i <= n - BAY_TO; i++) {
    const s = samples[i], r = right(s.dx, s.dz), bx = s.x + r.x * (HALF_WIDTH + BAY_WIDTH), bz = s.z + r.z * (HALF_WIDTH + BAY_WIDTH);
    if (samples.some((o, j) => Math.min(Math.abs(i - j), n - Math.abs(i - j)) > 2 * WINDOW && (o.x - bx) ** 2 + (o.z - bz) ** 2 < (HALF_WIDTH + 1) ** 2 && sameLevel(o.y, s.y))) {
      throw new Error(`Track ${def.id} has no room for the Charging Station at sample ${i}`);
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
      walls.push({ x: (ax + bx) / 2, y: (a.y + b.y) / 2, z: (az + bz) / 2, yaw: yawOf(bx - ax, bz - az), pitch: -Math.atan2(b.y - a.y, flat), length: Math.hypot(flat, b.y - a.y), idx: i });
    }
  }
  const middle = (piece: number) => Math.floor((checkpoints[piece] + (checkpoints[piece + 1] ?? n)) / 2);
  const puddles = def.puddles.map((piece) => { const { x, y, z } = samples[middle(piece)]; return { x, y, z, r: 3.2 }; });
  const track: Track = { def, samples, n, checkpoints, walls, tiles, puddles, itemBoxes: [] };
  track.itemBoxes = def.items.flatMap((piece) => [-2.8, 0, 2.8].map((lateral) => ({ ...poseAt(track, middle(piece), lateral), idx: middle(piece) })));
  return track;
}

export const inPuddle = (track: Track, t: Point) => track.puddles.some((p) => (p.x - t.x) ** 2 + (p.z - t.z) ** 2 < p.r ** 2 && sameLevel(p.y, t.y));

/** Whether an E-Car at sample `idx` (its progress) is in the Charging Station's bay. */
export const inStation = (track: Track, idx: number, t: Point) => track.samples[idx].bay > 1 && lateralOf(track, idx, t.x, t.z) > HALF_WIDTH - 0.5;

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

/** Start grid: two columns, rows 5 m apart, all behind the finish line, and only on level road: in a big field the back rows
 * would reach the piece before the last straights, and a row on a ramp moves on back past it. */
export function gridPose(track: Track, slot: number): Pose {
  const row = Math.floor(slot / 2), col = slot % 2, y = (i: number) => track.samples[(i + track.n) % track.n].y;
  let back = 3;
  for (let r = 0; back < track.n; back += 5) {
    const i = track.n - back;
    if ([-6, -3, 3].every((k) => Math.abs(y(i + k) - y(i)) < 0.05) && r++ === row) break;
  }
  return poseAt(track, track.n - (back + col * 2), col ? 2.2 : -2.2);
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
  if (bestD > (HALF_WIDTH + 1.5 + track.samples[best].bay) ** 2) return false;
  let delta = best - p.idx;
  if (delta > track.n / 2) delta -= track.n;
  if (delta < -track.n / 2) delta += track.n;
  p.u += delta;
  p.idx = best;
  return true;
}

/** Moves progress back to the last Checkpoint passed and returns the pose to put the E-Car at. */
export function resetToCheckpoint(track: Track, p: Progress, others: Point[] = []): Pose {
  let cp = track.checkpoints[0];
  for (const c of track.checkpoints) if (c <= p.idx) cp = c;
  p.u -= p.idx - cp;
  p.idx = cp;
  // never onto another E-Car: across the road, or a little further back (it has to drive past the Checkpoint again)
  const spot = freeSpot(track, [cp, cp - 6, cp - 12], others);
  if (!spot) return poseAt(track, cp);
  p.u -= cp - spot.idx;
  p.idx = (spot.idx + track.n) % track.n;
  return spot.pose;
}

/** The first spot clear of `others` at the given samples, trying the middle of the road and then either side. */
export function freeSpot(track: Track, idxs: number[], others: Point[]): { pose: Pose; idx: number } | undefined {
  for (const idx of idxs) for (const lateral of [0, -2.6, 2.6]) {
    const pose = poseAt(track, idx, lateral);
    if (others.every((o) => (o.x - pose.x) ** 2 + (o.z - pose.z) ** 2 > CLEAR ** 2 || !sameLevel(o.y, pose.y))) return { pose, idx };
  }
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
