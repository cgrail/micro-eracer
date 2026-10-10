import type RAPIER from '@dimforge/rapier3d-compat';
import {
  BODIES, BODY_KINDS, type Car, type BodyKind, MAX_ENERGY, NO_INPUT, createCar, createTrackWorld, driveCar, haltInput, limpScale, setKinematicPose,
  teleport, yawOfBody,
} from './car.ts';
import { botInput } from './bots.ts';
import { Combat, type HitKind, type ItemKind } from './combat.ts';
import {
  type Pose, type Progress, type Track, FALL_Y, HALF_WIDTH, PIT_SPEED, TRACKS, buildTrack, gridPose, inPuddle, inStation, lapOf, nearestSample,
  sameLevel, poseAt, resetToCheckpoint, startProgress, updateProgress,
} from './track.ts';

export const SEATS = 8;
export const LAPS = 3;
export const FIRST_GRID_TIME = 3;
export const GRID_TIME = 5;
/** The next Race's grid comes this long after the first Racer finishes. */
export const FINISH_TIME = 7;
/** Out of Energy: first Stranded on the spot while a drone flies in, then Recharged by it where it stands. */
export const STRANDED_TIME = 1.6;
export const RECHARGE_TIME = 1.6;
const RESPAWN_LOCK = 1;
/** A full Roadster battery lasts this many Laps of driving, on every Track. */
const TANK_LAPS = 2.2;
export const BATTERY_CHARGE = 30;
/** Energy per second in the Charging Station. */
const STATION_RATE = 35;
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
  rechargeUntil: number;
  /** Bumped whenever the E-Car is moved by the race itself, so its driver knows to jump there. */
  spawn: number;
  vx: number;
  vz: number;
  lastX: number;
  lastZ: number;
}

export interface Battery { id: number; x: number; y: number; z: number; idx: number; until: number }
export interface PoseReport extends Pose { vx: number; vz: number; spawn: number }

/** Things that happened this tick, for sounds and effects in the browsers. `s` is a Seat index. */
export type RaceEvent =
  | { t: 'ram'; a: number; b: number; n: number }
  | { t: 'hit'; s: number; by: number; kind: HitKind; ix: number; iz: number; hop: number; spin: number }
  | { t: 'boom'; x: number; z: number }
  | { t: 'block' | 'battery' | 'shot' | 'stranded' | 'recharge'; s: number }
  | { t: 'box' | 'item'; s: number; item: ItemKind }
  /** A Player took over a Bot's Seat (`join`), or a Bot took over from a Player who left (`leave`); `was` is who had it. */
  | { t: 'join' | 'leave'; s: number; name: string; was: string };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** A Bot's name always starts with the robot, so nobody takes one for a Player. */
const BOT_NAMES = ['Sparky', 'Volty', 'Amp Champ', 'Ohmigosh', 'Zappy', 'Coily', 'Fuse Box', 'Watt-Ever', 'Plugsy', 'Lithia'];
const BOT = '🤖';
const botName = (i: number) => `${BOT} ${BOT_NAMES[i % BOT_NAMES.length]}`;

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
  stats = { recharges: 0, leaderRecharges: 0, pickups: 0, rams: 0, hits: 0 };
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
      const kind = prev?.kind ?? BODY_KINDS[Math.floor(Math.random() * BODY_KINDS.length)];
      const owner = prev?.owner ?? '';
      const pose = gridPose(this.track, slot);
      return {
        index: i, name: prev?.name ?? botName(i), kind, owner,
        car: createCar(this.world, kind, pose, !owner),
        progress: startProgress(this.track, nearestSample(this.track, pose.x, pose.y, pose.z)),
        position: i + 1, finished: false, finishTime: 0, energy: MAX_ENERGY, item: '' as const, shield: false, nextShotAt: 0,
        lockedUntil: 0, strandedUntil: 0, rechargeUntil: 0,
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
    // only Bots wear the robot
    name = name.replaceAll(BOT, '').trim() || 'Player';
    this.emit({ t: 'join', s: seat.index, name, was: seat.name });
    Object.assign(seat, { owner, name, kind, vx: v.x, vz: v.z });
    this.replaceCar(seat, false);
    return seat;
  }

  /** A Bot takes over the E-Car of a Player who leaves. */
  leave(owner: string) {
    const seat = this.seats.find((s) => s.owner === owner);
    if (!seat) return;
    this.emit({ t: 'leave', s: seat.index, name: botName(seat.index), was: seat.name });
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

  isRecharging = (s: Seat) => this.time < s.rechargeUntil;
  isStranded = (s: Seat) => this.time < s.strandedUntil;
  canAct = (s: Seat) => this.phase !== 'grid' && !this.isRecharging(s) && !this.isStranded(s);
  botsAttack = () => this.time > this.startedAt + 4;
  emit = (e: RaceEvent) => { this.events.push(e); };

  step(dt: number) {
    this.time += dt;
    const live = this.phase !== 'grid';
    for (const s of this.seats) {
      if (s.owner) continue;
      const t = s.car.rb.translation();
      const locked = !live || this.time < s.lockedUntil || this.isRecharging(s);
      const input = this.isStranded(s) ? haltInput(s.car) : locked ? NO_INPUT : botInput(this, s);
      const pit = inStation(this.track, s.progress.idx, t) ? PIT_SPEED : 1;
      driveCar(this.world, s.car, input, live ? this.catchUp(s) * limpScale(s.energy) * pit : 1, inPuddle(this.track, t));
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
        if (t.y < this.track.samples[s.progress.idx].y + FALL_Y) {
          teleport(s.car, resetToCheckpoint(this.track, s.progress));
          s.lockedUntil = this.time + RESPAWN_LOCK;
          s.lastX = s.car.rb.translation().x; s.lastZ = s.car.rb.translation().z;
          continue;
        }
      }
      const moved = Math.hypot(t.x - s.lastX, t.z - s.lastZ);
      // jumps (Fall-off resets) are not driving
      if (live && !s.finished && moved < 2) s.energy = Math.max(0, s.energy - (moved * MAX_ENERGY * this.drainScale) / (TANK_LAPS * BODIES[s.kind].tank * this.track.n));
      if (live && inStation(this.track, s.progress.idx, t)) s.energy = Math.min(MAX_ENERGY, s.energy + STATION_RATE * dt);
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
        if (s.strandedUntil && !this.isStranded(s)) {
          s.strandedUntil = 0;
          s.rechargeUntil = this.time + RECHARGE_TIME;
          this.stats.recharges++;
          this.emit({ t: 'recharge', s: s.index });
        }
        // the drone fills the battery up over the Recharge, so the Energy bar can be seen filling
        if (this.isRecharging(s)) s.energy = MAX_ENERGY * (1 - (s.rechargeUntil - this.time) / RECHARGE_TIME);
        else if (s.energy <= 0 && !s.finished && !s.strandedUntil && !this.isRecharging(s)) {
          s.strandedUntil = this.time + STRANDED_TIME;
          if (s.position === 1) this.stats.leaderRecharges++;
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
        // never inside an Item Box; the next spawn tries elsewhere
        if (!this.track.itemBoxes.some((b) => (b.x - pose.x) ** 2 + (b.z - pose.z) ** 2 < 3 ** 2)) this.batteries.push({ id: ++this.batteryId, x: pose.x, y: this.track.samples[idx].y, z: pose.z, idx, until: this.time + BATTERY_LIFE });
      }
      this.nextBatteryAt = this.time + BATTERY_EVERY;
    }
    for (const s of this.seats) {
      if (this.isRecharging(s)) continue;
      const t = s.car.rb.translation();
      const hit = this.batteries.find((b) => (b.x - t.x) ** 2 + (b.z - t.z) ** 2 < PICKUP_RADIUS ** 2 && sameLevel(b.y, t.y));
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
      if (this.isRecharging(a) || this.isRecharging(b) || this.time < (this.ramCooldown.get(key) ?? 0)) continue;
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
