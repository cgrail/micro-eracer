import type RAPIER from '@dimforge/rapier3d-compat';
import {
  type Car, type BodyKind, type Input, NO_INPUT, createCar, createTrackWorld, driveCar, setKinematicPose, teleport, yawOfBody,
} from './car.ts';
import {
  type Pose, type Progress, type Track, FALL_Y, TRACKS, buildTrack, gridPose, lapOf, nearestSample, poseAt, resetToCheckpoint,
  right, startProgress, updateProgress,
} from './track.ts';

export const SEATS = 8;
export const LAPS = 3;
export const FIRST_GRID_TIME = 3;
export const GRID_TIME = 5;
export const FINISH_TIME = 10;
const RESPAWN_LOCK = 1;

/** grid: E-Cars wait on the start grid; finishing: someone has won and the Race ends soon. */
export type Phase = 'grid' | 'racing' | 'finishing';

export interface Seat {
  index: number;
  name: string;
  kind: BodyKind;
  /** Player session id, '' while a Bot holds the Seat. */
  owner: string;
  car: Car;
  progress: Progress;
  position: number;
  finished: boolean;
  finishTime: number;
  lockedUntil: number;
  /** Bumped whenever the E-Car is moved by the race itself, so its driver knows to jump there. */
  spawn: number;
  vx: number;
  vz: number;
}

export interface PoseReport extends Pose { vx: number; vz: number; spawn: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const botName = (i: number) => `Bot ${i + 1}`;

/** One Race and everything the server owns in it. Kept free of networking so an Offline Race can run it too. */
export class RaceSim {
  track!: Track;
  world!: RAPIER.World;
  seats: Seat[] = [];
  phase: Phase = 'grid';
  timer = FIRST_GRID_TIME;
  time = 0;
  results: string[] = [];

  constructor() {
    this.newRace(FIRST_GRID_TIME);
  }

  newRace(gridTime: number) {
    const others = TRACKS.filter((t) => t.id !== this.track?.def.id);
    const def = others.length ? others[Math.floor(Math.random() * others.length)] : TRACKS[0];
    this.world?.free();
    this.track = buildTrack(def);
    this.world = createTrackWorld(this.track);
    const slots = [...Array(SEATS).keys()].sort(() => Math.random() - 0.5);
    this.seats = slots.map((slot, i) => {
      const prev = this.seats[i];
      const kind = prev?.kind ?? (Math.random() < 0.5 ? 'microbus' : 'roadster');
      const owner = prev?.owner ?? '';
      const pose = gridPose(this.track, slot);
      return {
        index: i, name: prev?.name ?? botName(i), kind, owner,
        car: createCar(this.world, kind, pose, !owner),
        progress: startProgress(this.track, nearestSample(this.track, pose.x, pose.z)),
        position: i + 1, finished: false, finishTime: 0, lockedUntil: 0, spawn: (prev?.spawn ?? 0) + 1, vx: 0, vz: 0,
      };
    });
    this.phase = 'grid';
    this.timer = gridTime;
  }

  /** A joining Player takes over the last-Position Bot's E-Car where it is. Returns null when every Seat has a Player. */
  join(owner: string, name: string, kind: BodyKind): Seat | null {
    const bots = this.seats.filter((s) => !s.owner);
    if (!bots.length) return null;
    const seat = bots.reduce((a, b) => (b.position > a.position ? b : a));
    const v = seat.car.rb.linvel();
    Object.assign(seat, { owner, name, kind, vx: v.x, vz: v.z });
    this.replaceCar(seat, false);
    return seat;
  }

  /** A Bot takes over the E-Car of a Player who leaves. */
  leave(owner: string) {
    const seat = this.seats.find((s) => s.owner === owner);
    if (!seat) return;
    Object.assign(seat, { owner: '', name: botName(seat.index) });
    this.replaceCar(seat, true);
  }

  setPose(owner: string, report: PoseReport) {
    const seat = this.seats.find((s) => s.owner === owner);
    // poses sent before the driver saw the latest jump are stale
    if (!seat || report.spawn !== seat.spawn) return;
    setKinematicPose(seat.car, report);
    seat.vx = report.vx;
    seat.vz = report.vz;
  }

  step(dt: number) {
    this.time += dt;
    const live = this.phase !== 'grid';
    for (const s of this.seats) {
      if (s.owner) continue;
      const input = live && this.time >= s.lockedUntil ? botInput(this.track, s) : NO_INPUT;
      driveCar(this.world, s.car, input, live ? this.catchUp(s) : 1);
    }
    this.world.step();

    for (const s of this.seats) {
      const t = s.car.rb.translation();
      if (!s.owner) {
        const v = s.car.rb.linvel();
        s.vx = v.x; s.vz = v.z;
        if (t.y < FALL_Y) {
          teleport(s.car, resetToCheckpoint(this.track, s.progress));
          s.lockedUntil = this.time + RESPAWN_LOCK;
          continue;
        }
      }
      updateProgress(this.track, s.progress, t.x, t.z);
      if (live && !s.finished && s.progress.u >= LAPS * this.track.n) {
        s.finished = true;
        s.finishTime = this.time;
        if (this.phase === 'racing') { this.phase = 'finishing'; this.timer = FINISH_TIME; }
      }
    }

    const ranked = [...this.seats].sort((a, b) =>
      a.finished !== b.finished ? (a.finished ? -1 : 1) : a.finished ? a.finishTime - b.finishTime : b.progress.u - a.progress.u);
    ranked.forEach((s, i) => (s.position = i + 1));

    if (this.phase === 'racing') return;
    this.timer -= dt;
    if (this.timer > 0) return;
    if (this.phase === 'grid') this.phase = 'racing';
    else { this.results = ranked.map((s) => s.name); this.newRace(GRID_TIME); }
  }

  lap = (s: Seat) => clamp(lapOf(this.track, s.progress), 1, LAPS);

  /** Bots stay close to the Players: faster when far behind the nearest one, slower when far ahead. */
  private catchUp(bot: Seat) {
    let gap = Infinity;
    for (const p of this.seats) if (p.owner && Math.abs(bot.progress.u - p.progress.u) < Math.abs(gap)) gap = bot.progress.u - p.progress.u;
    return gap === Infinity ? 1 : clamp(1 - gap / 80, 0.7, 1.3);
  }

  private replaceCar(seat: Seat, dynamic: boolean) {
    const t = seat.car.rb.translation();
    const pose = { x: t.x, y: t.y, z: t.z, yaw: yawOfBody(seat.car.rb) };
    this.world.removeRigidBody(seat.car.rb);
    seat.car = createCar(this.world, seat.kind, pose, dynamic);
    if (dynamic) teleport(seat.car, pose, seat.vx, seat.vz);
    seat.spawn++;
  }
}

/** Follow the centreline in a per-Seat lane, braking for tight corners. */
export function botInput(track: Track, s: Seat): Input {
  const { rb } = s.car;
  const t = rb.translation(), v = rb.linvel();
  const yaw = yawOfBody(rb), fx = Math.sin(yaw), fz = Math.cos(yaw), r = right(fx, fz);
  const speed = Math.hypot(v.x, v.z);
  const lane = ((s.index % 3) - 1) * 1.6;
  const look = Math.round(4 + speed * 0.4);
  const target = poseAt(track, s.progress.idx + look, lane);
  const tx = target.x - t.x, tz = target.z - t.z;
  const angle = Math.atan2(tx * r.x + tz * r.z, tx * fx + tz * fz);
  const far = track.samples[(s.progress.idx + look * 2) % track.n];
  const bend = Math.acos(clamp(far.dx * fx + far.dz * fz, -1, 1));
  return { throttle: bend > 0.9 && speed > 13 ? -0.4 : 1, steer: clamp(angle * 2.2, -1, 1) };
}
