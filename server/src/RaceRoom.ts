import { Room, ServerError, type Client } from '@colyseus/core';
import { schema, t, type SchemaType } from '@colyseus/schema';
import { BODY_KINDS, DT, type BodyKind } from '../../shared/src/car.ts';
import { type PoseReport, RaceSim, SEATS } from '../../shared/src/race.ts';
import { seatState } from '../../shared/src/snapshot.ts';
import { CLASSIC_TRACKS, TRACKS } from '../../shared/src/track.ts';
import { OUTDATED, compatible, protocolOf } from '../../shared/src/version.ts';

const CarState = schema({
  name: t.string(), body: t.string(), owner: t.string(),
  x: t.float32(), y: t.float32(), z: t.float32(), yaw: t.float32(), vx: t.float32(), vz: t.float32(),
  lap: t.uint8(), position: t.uint8(), finished: t.boolean(), spawn: t.uint32(), energy: t.uint8(),
  /** 0 driving, 1 Stranded (out of Energy), 2 being Recharged by the drone */
  mode: t.uint8(), item: t.string(), ammo: t.uint8(), shield: t.boolean(),
  /** Percent of top speed: a Leader far ahead is slowed so the others can catch up */
  pace: t.uint8(),
}, 'CarState');

const BatteryState = schema({ id: t.uint32(), x: t.float32(), y: t.float32(), z: t.float32() }, 'BatteryState');
const BoltState = schema({ id: t.uint32(), kind: t.string(), x: t.float32(), y: t.float32(), z: t.float32(), vx: t.float32(), vz: t.float32() }, 'BoltState');
const MineState = schema({ id: t.uint32(), x: t.float32(), y: t.float32(), z: t.float32() }, 'MineState');

/** The Race's Track as `TrackDef` has it, so a client builds the very Track the server races, even one it doesn't know. */
const TrackState = schema({
  id: t.string(), name: t.string(), theme: t.string(), pieces: t.string(), puddles: t.array('uint16'), items: t.array('uint16'),
}, 'TrackState');

const RaceState = schema({
  phase: t.string(), timer: t.float32(), trackId: t.string(),
  cars: t.array(CarState), results: t.array('string'), batteries: t.array(BatteryState),
  bolts: t.array(BoltState), mines: t.array(MineState), boxes: t.array('boolean'),
  track: t.ref(TrackState),
}, 'RaceState');
type RaceState = SchemaType<typeof RaceState>;

const LIMIT = 1e4;
const isPose = (m: any): m is PoseReport =>
  m != null && ['x', 'y', 'z', 'yaw', 'vx', 'vz', 'spawn'].every((k) => typeof m[k] === 'number' && Number.isFinite(m[k]) && Math.abs(m[k]) < LIMIT);

export class RaceRoom extends Room<{ state: RaceState }> {
  maxClients = SEATS;
  maxMessagesPerSecond = 80;
  private sim!: RaceSim;

  /** Before a Seat is found: a client too old to race here (`protocol` below MIN_PROTOCOL, or none) is refused, and plays offline. */
  static async onAuth(_token: string, options: { protocol?: unknown }) {
    if (!compatible(protocolOf(options?.protocol))) throw new ServerError(OUTDATED, 'update');
    return true;
  }

  /** `track`: the one Track the first Player picked, raced again and again; `classic`: only the Tracks apps from before the
   * picker know. */
  onCreate(options: { track?: unknown; classic?: boolean }) {
    const picked = TRACKS.find((t) => t.id === options?.track)?.id;
    const pool = picked ? [picked] : options?.classic ? CLASSIC_TRACKS : TRACKS.map((t) => t.id);
    // TRACK=garden picks the first Race's Track, handy while working on one
    this.sim = new RaceSim(picked ?? (pool.includes(process.env.TRACK ?? '') ? process.env.TRACK : undefined), pool);
    // DRAIN_SCALE=10 makes batteries run dry fast, for trying out Stranded and the Recharge
    this.sim.drainScale = Number(process.env.DRAIN_SCALE) || 1;
    // 30 updates a second (the default is 20), so the other E-Cars need less guessing between them
    this.setPatchRate(1000 / 30);
    const state = new RaceState();
    for (let i = 0; i < SEATS; i++) state.cars.push(new CarState());
    this.setState(state);
    // fill the state before the first tick: the creating client receives it on join
    this.sync();
    this.onMessage('pose', (client, msg) => { if (isPose(msg)) this.sim.setPose(client.sessionId, msg); });
    const seatOf = (client: Client) => this.sim.seats.find((s) => s.owner === client.sessionId);
    this.onMessage('item', (client) => { const s = seatOf(client); if (s) this.sim.combat.useItem(s); });
    this.setSimulationInterval(() => {
      this.sim.step(DT);
      if (this.sim.events.length) { this.broadcast('events', this.sim.events); this.sim.events = []; }
      this.sync();
    }, DT * 1000);
  }

  onJoin(client: Client, options: { name?: unknown; body?: unknown }) {
    const name = String(options?.name ?? '').trim().slice(0, 16) || 'Player';
    const body = BODY_KINDS.includes(options?.body as BodyKind) ? (options.body as BodyKind) : 'roadster';
    if (!this.sim.join(client.sessionId, name, body)) throw new Error('Race is full');
    this.sync();
    this.list();
  }

  onDrop(client: Client) {
    this.allowReconnection(client, 5);
  }

  onLeave(client: Client) {
    this.sim.leave(client.sessionId);
    this.list();
  }

  /** What the start screens see of this Race (`GET /race` in api.ts): its Track, and the Players in it. */
  private list() {
    void this.setMetadata({ track: this.sim.track.def.id, players: this.sim.seats.filter((s) => s.owner).map((s) => s.name) });
  }

  private sync() {
    const { sim, state } = this;
    state.phase = sim.phase;
    state.timer = Math.max(0, sim.timer);
    if (state.trackId !== sim.track.def.id) {
      const { id, name, theme, pieces, puddles, items } = sim.track.def;
      Object.assign(state.track, { id, name, theme, pieces });
      state.track.puddles.clear(); state.track.puddles.push(...puddles);
      state.track.items.clear(); state.track.items.push(...items);
      state.trackId = id;
      this.list();
    }
    if (state.results.join() !== sim.results.join()) { state.results.clear(); state.results.push(...sim.results); }
    if (state.batteries.map((b) => b.id).join() !== sim.batteries.map((b) => b.id).join()) {
      state.batteries.clear();
      state.batteries.push(...sim.batteries.map(({ id, x, y, z }) => Object.assign(new BatteryState(), { id, x, y, z })));
    }
    const { combat } = sim;
    if (state.bolts.length !== combat.bolts.length || combat.bolts.some((b, i) => state.bolts[i].id !== b.id)) {
      state.bolts.clear();
      state.bolts.push(...combat.bolts.map(() => new BoltState()));
    }
    // missiles turn, so their position and heading go out every patch
    combat.bolts.forEach(({ id, kind, x, y, z, vx, vz }, i) => Object.assign(state.bolts[i], { id, kind, x, y, z, vx, vz }));
    if (state.mines.map((m) => m.id).join() !== combat.mines.map((m) => m.id).join()) {
      state.mines.clear();
      state.mines.push(...combat.mines.map(({ id, x, y, z }) => Object.assign(new MineState(), { id, x, y, z })));
    }
    if (state.boxes.join() !== combat.out.join()) { state.boxes.clear(); state.boxes.push(...combat.out); }
    sim.seats.forEach((s, i) => Object.assign(state.cars[i], seatState(sim, s)));
  }
}
