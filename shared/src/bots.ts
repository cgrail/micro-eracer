import type { Input } from './car.ts';
import type { RaceSim, Seat } from './race.ts';
import { BAY_WIDTH, HALF_WIDTH, inStation, lateralOf, poseAt, right } from './track.ts';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Bots stay close to the Players: faster when far behind the nearest one, slower when far ahead. */
export function catchUp(sim: RaceSim, bot: Seat) {
  let gap = Infinity;
  for (const p of sim.seats) if (p.owner && Math.abs(bot.progress.u - p.progress.u) < Math.abs(gap)) gap = bot.progress.u - p.progress.u;
  return gap === Infinity ? 1 : clamp(1 - gap / 80, 0.7, 1.3);
}

/** Whom the Bots go for, with Rams, Shots, Missiles and Mines: the Players, or anyone in a Race of Bots alone. */
export const isPrey = (sim: RaceSim, o: Seat) => !!o.owner || !sim.seats.some((p) => p.owner);

/**
 * Follow the centreline in a per-Seat lane; low on Energy, pull into the Charging Station and stay until charged;
 * otherwise swerve for a Battery just ahead, else try to Ram the prey just ahead; and go round a Bot in the way.
 */
export function botInput(sim: RaceSim, s: Seat): Input {
  const { track } = sim, { rb } = s.car;
  const t = rb.translation(), v = rb.linvel();
  const yaw = rb.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), r = right(fx, fz);
  const speed = Math.hypot(v.x, v.z);
  const look = Math.round(4 + speed * 0.4);
  const ahead = (idx: number) => (idx - s.progress.idx + track.n) % track.n;
  const bay = track.samples[(s.progress.idx + look) % track.n].bay, bayAhead = track.samples[(s.progress.idx + 2 * look) % track.n].bay;

  let lane = ((s.index % 3) - 1) * 2.4;
  // seen early enough to get across from the far lane before the bay opens
  const charging = Math.max(bay, bayAhead) > 1 && (s.energy < 35 || (inStation(track, s.progress.idx, t) && s.energy < 90));
  const battery = s.position === 1 ? undefined : sim.batteries.filter((b) => ahead(b.idx) > 4 && ahead(b.idx) < 30).sort((a, b) => ahead(a.idx) - ahead(b.idx))[0];
  // only the nearest Bot behind its prey goes for it; the others keep their lanes rather than all pile into one
  const prey = !sim.botsAttack() ? undefined : sim.seats.find((o) => o !== s && isPrey(sim, o) && o.progress.u - s.progress.u > 3 && o.progress.u - s.progress.u < 14
    && !sim.seats.some((b) => b !== s && b !== o && !b.owner && b.progress.u > s.progress.u && b.progress.u < o.progress.u));
  const lat = (o: Seat) => { const p = o.car.rb.translation(); return lateralOf(track, o.progress.idx, p.x, p.z); };
  if (charging) lane = HALF_WIDTH + BAY_WIDTH / 2;
  else if (battery) lane = lateralOf(track, battery.idx, battery.x, battery.z);
  else if (prey) lane = lat(prey);
  // a Bot alongside or just ahead where this one is heading: round it, not into it, so Bots closing on a Player don't pile up
  const inWay = charging ? undefined : sim.seats.find((o) => o !== s && !isPrey(sim, o) && o.progress.u - s.progress.u > -3 && o.progress.u - s.progress.u < 12 && Math.abs(lat(o) - lane) < 2.4);
  if (inWay) {
    const b = lat(inWay), side = lane >= b ? 1 : -1;
    lane = b + (Math.abs(b + side * 2.6) < HALF_WIDTH - 1 ? side : -side) * 2.6;
  }

  const target = poseAt(track, s.progress.idx + look, clamp(lane, -HALF_WIDTH + 1, HALF_WIDTH - 1 + bay));
  const tx = target.x - t.x, tz = target.z - t.z;
  const angle = Math.atan2(tx * r.x + tz * r.z, tx * fx + tz * fz);
  const far = track.samples[(s.progress.idx + look * 2) % track.n];
  const bend = Math.acos(clamp(far.dx * fx + far.dz * fz, -1, 1));
  // right behind a slower Bot still: lift rather than shunt it
  const tailing = sim.seats.some((o) => o !== s && !isPrey(sim, o) && o.progress.u - s.progress.u > 0 && o.progress.u - s.progress.u < 5 && Math.abs(lat(o) - lat(s)) < 2 && Math.hypot(o.vx, o.vz) < speed);
  return { throttle: bend > 0.9 && speed > 13 ? -0.4 : tailing ? 0 : 1, steer: clamp(angle * 2.2, -1, 1) };
}
