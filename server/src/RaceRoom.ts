import { Room, type Client } from '@colyseus/core';
import { schema, t, type SchemaType } from '@colyseus/schema';
import { BODY_KINDS, DT, type BodyKind } from '../../shared/src/car.ts';
import { type PoseReport, RaceSim, SEATS } from '../../shared/src/race.ts';
import { seatState } from '../../shared/src/snapshot.ts';

const CarState = schema({
  name: t.string(), body: t.string(), owner: t.string(),
  x: t.float32(), y: t.float32(), z: t.float32(), yaw: t.float32(), vx: t.float32(), vz: t.float32(),
  lap: t.uint8(), position: t.uint8(), finished: t.boolean(), spawn: t.uint32(), energy: t.uint8(),
  /** 0 driving, 1 Stranded (out of Energy), 2 being Recharged by the drone */
  mode: t.uint8(), item: t.string(), shield: t.boolean(),
}, 'CarState');

const BatteryState = schema({ id: t.uint32(), x: t.float32(), y: t.float32(), z: t.float32() }, 'BatteryState');
const BoltState = schema({ id: t.uint32(), kind: t.string(), x: t.float32(), y: t.float32(), z: t.float32(), vx: t.float32(), vz: t.float32() }, 'BoltState');
const MineState = schema({ id: t.uint32(), x: t.float32(), y: t.float32(), z: t.float32() }, 'MineState');

const RaceState = schema({
  phase: t.string(), timer: t.float32(), trackId: t.string(),
  cars: t.array(CarState), results: t.array('string'), batteries: t.array(BatteryState),
  bolts: t.array(BoltState), mines: t.array(MineState), boxes: t.array('boolean'),
}, 'RaceState');
type RaceState = SchemaType<typeof RaceState>;

const LIMIT = 1e4;
const isPose = (m: any): m is PoseReport =>
  m != null && ['x', 'y', 'z', 'yaw', 'vx', 'vz', 'spawn'].every((k) => typeof m[k] === 'number' && Number.isFinite(m[k]) && Math.abs(m[k]) < LIMIT);

export class RaceRoom extends Room<{ state: RaceState }> {
  maxClients = SEATS;
  maxMessagesPerSecond = 80;
  // TRACK=garden picks the first Race's Track, handy while working on one
  private sim = new RaceSim(process.env.TRACK);

  onCreate() {
    // DRAIN_SCALE=10 makes batteries run dry fast, for trying out Stranded and the Recharge
    this.sim.drainScale = Number(process.env.DRAIN_SCALE) || 1;
    const state = new RaceState();
    for (let i = 0; i < SEATS; i++) state.cars.push(new CarState());
    this.setState(state);
    // fill the state before the first tick: the creating client receives it on join
    this.sync();
    this.onMessage('pose', (client, msg) => { if (isPose(msg)) this.sim.setPose(client.sessionId, msg); });
    const seatOf = (client: Client) => this.sim.seats.find((s) => s.owner === client.sessionId);
    this.onMessage('shoot', (client) => { const s = seatOf(client); if (s) this.sim.combat.shoot(s); });
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
  }

  onDrop(client: Client) {
    this.allowReconnection(client, 5);
  }

  onLeave(client: Client) {
    this.sim.leave(client.sessionId);
  }

  private sync() {
    const { sim, state } = this;
    state.phase = sim.phase;
    state.timer = Math.max(0, sim.timer);
    state.trackId = sim.track.def.id;
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
    const boxes = combat.boxes.map((at) => at <= sim.time);
    if (state.boxes.join() !== boxes.join()) { state.boxes.clear(); state.boxes.push(...boxes); }
    sim.seats.forEach((s, i) => Object.assign(state.cars[i], seatState(sim, s)));
  }
}
