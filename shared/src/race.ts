import type RAPIER from '@dimforge/rapier3d-compat';
import {
  BODIES, type Car, type BodyKind, type Input, MAX_ENERGY, NO_INPUT, createCar, createTrackWorld, driveCar, limpScale, setKinematicPose,
  teleport, yawOfBody,
} from './car.ts';
import { Combat, type HitKind, type ItemKind } from './combat.ts';
import {
  type Pose, type Progress, type Track, FALL_Y, HALF_WIDTH, TRACKS, buildTrack, gridPose, inPuddle, lapOf, lateralOf, nearestSample,
  poseAt, resetToCheckpoint, right, startProgress, updateProgress,
} from './track.ts';

export const SEATS = 8;
export const LAPS = 3;
export const FIRST_GRID_TIME = 3;
export const GRID_TIME = 5;
export const FINISH_TIME = 10;
/** Out of Energy: first stranded on the spot, then the drone carries the E-Car to the back. */
export const STRANDED_TIME = 1.6;
export const AIRLIFT_TIME = 1.6;
const RESPAWN_LOCK = 1;
/** A full Roadster battery lasts this many Laps of driving, on every Track. */
const TANK_LAPS = 2.2;
export const BATTERY_CHARGE = 30;
const BATTERY_EVERY = 1.4, MAX_BATTERIES = 7, BATTERY_LIFE = 25, PICKUP_RADIUS = 2.4;
const RAM_MIN_SPEED = 3, RAM_ENERGY_PER_MS = 3, RAM_MAX = 25, RAM_COOLDOWN = 1;

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
  energy: number;
  item: ItemKind | '';
  shield: boolean;
  nextShotAt: number;
  lockedUntil: number;
  strandedUntil: number;
  airliftUntil: number;
  /** Bumped whenever the E-Car is moved by the race itself, so its driver knows to jump there. */
  spawn: number;
  vx: number;
  vz: number;
  lastX: number;
  lastZ: number;
}

export interface Battery { id: number; x: number; z: number; idx: number; until: number }
export interface PoseReport extends Pose { vx: number; vz: number; spawn: number }

/** Things that happened this tick, for sounds and effects in the browsers. `s` is a Seat index. */
export type RaceEvent =
  | { t: 'ram'; a: number; b: number; n: number }
  | { t: 'hit'; s: number; by: number; kind: HitKind; ix: number; iz: number; hop: number; spin: number }
  | { t: 'boom'; x: number; z: number }
  | { t: 'block' | 'battery' | 'shot' | 'stranded' | 'airlift'; s: number }
  | { t: 'box' | 'item'; s: number; item: ItemKind };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const botName = (i: number) => `Bot ${i + 1}`;

/** One Race and everything the server owns in it. Kept free of networking so an Offline Race can run it too. */
export class RaceSim {
  track!: Track;
  world!: RAPIER.World;
  seats: Seat[] = [];
  batteries: Battery[] = [];
  phase: Phase = 'grid';
  timer = FIRST_GRID_TIME;
  time = 0;
  /** When the current Race left the grid; Bots hold off attacking for a moment after the start. */
  startedAt = Infinity;
  results: string[] = [];
  combat!: Combat;
  events: RaceEvent[] = [];
  /** Counters for tests and tuning. */
  stats = { airlifts: 0, leaderAirlifts: 0, pickups: 0, rams: 0, hits: 0 };
  /** Multiplies the Energy drain; only for trying out running dry. */
  drainScale = 1;
  private nextBatteryAt = 0;
  private batteryId = 0;
  private ramCooldown = new Map<number, number>();

  constructor(trackId?: string) {
    this.newRace(FIRST_GRID_TIME, trackId);
  }

  newRace(gridTime: number, trackId?: string) {
    const others = TRACKS.filter((t) => t.id !== this.track?.def.id);
    const def = TRACKS.find((t) => t.id === trackId) ?? (others.length ? others[Math.floor(Math.random() * others.length)] : TRACKS[0]);
    this.world?.free();
    this.track = buildTrack(def);
    this.world = createTrackWorld(this.track);
    this.combat = new Combat(this);
    this.batteries = [];
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
        position: i + 1, finished: false, finishTime: 0, energy: MAX_ENERGY, item: '' as const, shield: false, nextShotAt: 0,
        lockedUntil: 0, strandedUntil: 0, airliftUntil: 0,
        spawn: (prev?.spawn ?? 0) + 1, vx: 0, vz: 0, lastX: pose.x, lastZ: pose.z,
      };
    });
    this.phase = 'grid';
    this.timer = gridTime;
    this.startedAt = Infinity;
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

  isAirlifted = (s: Seat) => this.time < s.airliftUntil;
  isStranded = (s: Seat) => this.time < s.strandedUntil;
  canAct = (s: Seat) => this.phase !== 'grid' && !this.isAirlifted(s) && !this.isStranded(s);
  botsAttack = () => this.time > this.startedAt + 4;
  emit = (e: RaceEvent) => { this.events.push(e); };

  step(dt: number) {
    this.time += dt;
    const live = this.phase !== 'grid';
    for (const s of this.seats) {
      if (s.owner) continue;
      const t = s.car.rb.translation();
      const locked = !live || this.time < s.lockedUntil || this.isAirlifted(s);
      const input = this.isStranded(s) ? { throttle: -0.6, steer: 0 } : locked ? NO_INPUT : botInput(this, s);
      driveCar(this.world, s.car, input, live ? this.catchUp(s) * limpScale(s.energy) : 1, inPuddle(this.track, t.x, t.z));
      if (!locked && this.canAct(s)) this.combat.botTurn(s);
    }
    this.world.step();
    // uses the velocities from before this step, i.e. how the E-Cars came into the contact
    if (live) { this.judgeRams(); this.combat.step(dt); }

    for (const s of this.seats) {
      const t = s.car.rb.translation();
      if (!s.owner) {
        const v = s.car.rb.linvel();
        s.vx = v.x; s.vz = v.z;
        if (t.y < FALL_Y) {
          teleport(s.car, resetToCheckpoint(this.track, s.progress));
          s.lockedUntil = this.time + RESPAWN_LOCK;
          s.lastX = s.car.rb.translation().x; s.lastZ = s.car.rb.translation().z;
          continue;
        }
      }
      const moved = Math.hypot(t.x - s.lastX, t.z - s.lastZ);
      // jumps (Fall-off resets) are not driving
      if (live && !s.finished && moved < 2) s.energy = Math.max(0, s.energy - (moved * MAX_ENERGY * this.drainScale) / (TANK_LAPS * BODIES[s.kind].tank * this.track.n));
      s.lastX = t.x; s.lastZ = t.z;
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
    if (live) {
      this.updateBatteries(ranked);
      for (const s of this.seats) {
        if (s.strandedUntil && !this.isStranded(s)) { s.strandedUntil = 0; this.airlift(s, ranked); }
        else if (s.energy <= 0 && !s.finished && !s.strandedUntil && !this.isAirlifted(s)) {
          s.strandedUntil = this.time + STRANDED_TIME;
          if (s.position === 1) this.stats.leaderAirlifts++;
          this.emit({ t: 'stranded', s: s.index });
        }
      }
    }

    if (this.phase === 'racing') return;
    this.timer -= dt;
    if (this.timer > 0) return;
    if (this.phase === 'grid') { this.phase = 'racing'; this.startedAt = this.time; }
    else { this.results = ranked.map((s) => s.name); this.newRace(GRID_TIME); }
  }

  lap = (s: Seat) => clamp(lapOf(this.track, s.progress), 1, LAPS);

  /** Out of Energy: a drone sets the E-Car down just behind the last Racer, on that Racer's Lap, with full Energy. */
  airlift(s: Seat, ranked: Seat[]) {
    this.stats.airlifts++;
    s.energy = MAX_ENERGY;
    s.airliftUntil = this.time + AIRLIFT_TIME;
    this.emit({ t: 'airlift', s: s.index });
    const last = ranked[ranked.length - 1];
    if (last === s || last.finished) return;
    const idx = last.progress.idx - 6;
    const pose = poseAt(this.track, idx);
    s.progress = { idx: ((idx % this.track.n) + this.track.n) % this.track.n, u: last.progress.u - 6 };
    s.lastX = pose.x; s.lastZ = pose.z;
    s.vx = s.vz = 0;
    teleport(s.car, pose);
    // a Player's driver jumps there when it sees the new spawn
    if (s.owner) s.spawn++;
  }

  private updateBatteries(ranked: Seat[]) {
    this.batteries = this.batteries.filter((b) => b.until > this.time);
    if (this.time >= this.nextBatteryAt && this.batteries.length < MAX_BATTERIES) {
      // Batteries mostly appear just ahead of the trailing Racers, so Energy is easier to get the further back you are;
      // one in three appears further ahead of the front half, so the Leader has a hard but fair chance
      const front = Math.random() < 1 / 3;
      const pool = (front ? ranked.slice(0, SEATS / 2) : ranked.slice(SEATS / 2)).filter((s) => !s.finished);
      const s = pool[Math.floor(Math.random() * pool.length)];
      if (s) {
        const idx = (s.progress.idx + (front ? 35 : 15) + Math.floor(Math.random() * 20)) % this.track.n;
        const pose = poseAt(this.track, idx, (Math.random() * 2 - 1) * (HALF_WIDTH - 1.2));
        this.batteries.push({ id: ++this.batteryId, x: pose.x, z: pose.z, idx, until: this.time + BATTERY_LIFE });
      }
      this.nextBatteryAt = this.time + BATTERY_EVERY;
    }
    for (const s of this.seats) {
      if (this.isAirlifted(s)) continue;
      const t = s.car.rb.translation();
      const hit = this.batteries.find((b) => (b.x - t.x) ** 2 + (b.z - t.z) ** 2 < PICKUP_RADIUS ** 2);
      if (!hit) continue;
      s.energy = Math.min(MAX_ENERGY, s.energy + BATTERY_CHARGE);
      this.batteries = this.batteries.filter((b) => b !== hit);
      this.stats.pickups++;
      this.emit({ t: 'battery', s: s.index });
    }
  }

  /** A Ram moves Energy from the hit E-Car to the one that drove into the contact harder (speed times weight). */
  private judgeRams() {
    for (let i = 0; i < SEATS; i++) for (let j = i + 1; j < SEATS; j++) {
      const a = this.seats[i], b = this.seats[j], key = i * SEATS + j;
      if (this.isAirlifted(a) || this.isAirlifted(b) || this.time < (this.ramCooldown.get(key) ?? 0)) continue;
      let touching = false;
      this.world.contactPair(a.car.rb.collider(0), b.car.rb.collider(0), (m) => { if (m.numContacts() > 0) touching = true; });
      if (!touching) continue;
      const pa = a.car.rb.translation(), pb = b.car.rb.translation();
      const d = Math.hypot(pb.x - pa.x, pb.z - pa.z) || 1, nx = (pb.x - pa.x) / d, nz = (pb.z - pa.z) / d;
      const sa = a.vx * nx + a.vz * nz, sb = -(b.vx * nx + b.vz * nz);
      if (sa + sb < RAM_MIN_SPEED) continue;
      const [rammer, victim] = sa * BODIES[a.kind].mass >= sb * BODIES[b.kind].mass ? [a, b] : [b, a];
      this.ramCooldown.set(key, this.time + RAM_COOLDOWN);
      if (victim.shield) { victim.shield = false; this.emit({ t: 'block', s: victim.index }); continue; }
      const amount = Math.min(RAM_MAX, 5 + (sa + sb - RAM_MIN_SPEED) * RAM_ENERGY_PER_MS, victim.energy);
      victim.energy -= amount;
      rammer.energy = Math.min(MAX_ENERGY, rammer.energy + amount);
      this.stats.rams++;
      this.emit({ t: 'ram', a: rammer.index, b: victim.index, n: Math.round(amount) });
    }
  }

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

/** Follow the centreline in a per-Seat lane, swerve for a Battery just ahead, else try to Ram the Racer just ahead. */
export function botInput(sim: RaceSim, s: Seat): Input {
  const { track } = sim, { rb } = s.car;
  const t = rb.translation(), v = rb.linvel();
  const yaw = yawOfBody(rb), fx = Math.sin(yaw), fz = Math.cos(yaw), r = right(fx, fz);
  const speed = Math.hypot(v.x, v.z);
  const look = Math.round(4 + speed * 0.4);
  const ahead = (idx: number) => (idx - s.progress.idx + track.n) % track.n;

  let lane = ((s.index % 3) - 1) * 1.6;
  const battery = sim.batteries.filter((b) => ahead(b.idx) > 4 && ahead(b.idx) < 30).sort((a, b) => ahead(a.idx) - ahead(b.idx))[0];
  const prey = !sim.botsAttack() ? undefined : sim.seats
    .filter((o) => o !== s && o.progress.u - s.progress.u > 3 && o.progress.u - s.progress.u < 14)
    .sort((a, b) => Number(!!b.owner) - Number(!!a.owner))[0];
  if (battery) lane = lateralOf(track, battery.idx, battery.x, battery.z);
  else if (prey) { const p = prey.car.rb.translation(); lane = lateralOf(track, prey.progress.idx, p.x, p.z); }

  const target = poseAt(track, s.progress.idx + look, clamp(lane, -HALF_WIDTH + 1, HALF_WIDTH - 1));
  const tx = target.x - t.x, tz = target.z - t.z;
  const angle = Math.atan2(tx * r.x + tz * r.z, tx * fx + tz * fz);
  const far = track.samples[(s.progress.idx + look * 2) % track.n];
  const bend = Math.acos(clamp(far.dx * fx + far.dz * fz, -1, 1));
  return { throttle: bend > 0.9 && speed > 13 ? -0.4 : 1, steer: clamp(angle * 2.2, -1, 1) };
}
