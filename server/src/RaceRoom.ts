import { Room, type Client } from '@colyseus/core';
import { schema, t, type SchemaType } from '@colyseus/schema';
import { BODY_KINDS, DT, type BodyKind, yawOfBody } from '../../shared/src/car.ts';
import { type PoseReport, RaceSim, SEATS } from '../../shared/src/race.ts';

const CarState = schema({
  name: t.string(), body: t.string(), owner: t.string(),
  x: t.float32(), y: t.float32(), z: t.float32(), yaw: t.float32(), vx: t.float32(), vz: t.float32(),
  lap: t.uint8(), position: t.uint8(), finished: t.boolean(), spawn: t.uint32(),
}, 'CarState');

const RaceState = schema({
  phase: t.string(), timer: t.float32(), trackId: t.string(),
  cars: t.array(CarState), results: t.array('string'),
}, 'RaceState');
type RaceState = SchemaType<typeof RaceState>;

const LIMIT = 1e4;
const isPose = (m: any): m is PoseReport =>
  m != null && ['x', 'y', 'z', 'yaw', 'vx', 'vz', 'spawn'].every((k) => typeof m[k] === 'number' && Number.isFinite(m[k]) && Math.abs(m[k]) < LIMIT);

export class RaceRoom extends Room<{ state: RaceState }> {
  maxClients = SEATS;
  maxMessagesPerSecond = 60;
  private sim = new RaceSim();

  onCreate() {
    const state = new RaceState();
    for (let i = 0; i < SEATS; i++) state.cars.push(new CarState());
    this.setState(state);
    // fill the state before the first tick: the creating client receives it on join
    this.sync();
    this.onMessage('pose', (client, msg) => { if (isPose(msg)) this.sim.setPose(client.sessionId, msg); });
    this.setSimulationInterval(() => { this.sim.step(DT); this.sync(); }, DT * 1000);
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
    sim.seats.forEach((s, i) => {
      const c = state.cars[i], p = s.car.rb.translation();
      Object.assign(c, {
        name: s.name, body: s.kind, owner: s.owner, x: p.x, y: p.y, z: p.z, yaw: yawOfBody(s.car.rb), vx: s.vx, vz: s.vz,
        lap: sim.lap(s), position: s.position, finished: s.finished, spawn: s.spawn,
      });
    });
  }
}
