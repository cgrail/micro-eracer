import type { Input } from './car.ts';
import type { RaceSim, Seat } from './race.ts';
import { BAY_WIDTH, HALF_WIDTH, inStation, lateralOf, poseAt, right } from './track.ts';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Follow the centreline in a per-Seat lane; low on Energy, pull into the Charging Station and stay until charged;
 * otherwise swerve for a Battery just ahead, else try to Ram the Racer just ahead.
 */
export function botInput(sim: RaceSim, s: Seat): Input {
  const { track } = sim, { rb } = s.car;
  const t = rb.translation(), v = rb.linvel();
  const yaw = rb.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), r = right(fx, fz);
  const speed = Math.hypot(v.x, v.z);
  const look = Math.round(4 + speed * 0.4);
  const ahead = (idx: number) => (idx - s.progress.idx + track.n) % track.n;
  const bay = track.samples[(s.progress.idx + look) % track.n].bay, bayAhead = track.samples[(s.progress.idx + 2 * look) % track.n].bay;

  let lane = ((s.index % 3) - 1) * 1.6;
  // seen early enough to get across from the far lane before the bay opens
  const charging = Math.max(bay, bayAhead) > 1 && (s.energy < 35 || (inStation(track, s.progress.idx, t) && s.energy < 90));
  const battery = sim.batteries.filter((b) => ahead(b.idx) > 4 && ahead(b.idx) < 30).sort((a, b) => ahead(a.idx) - ahead(b.idx))[0];
  const prey = !sim.botsAttack() ? undefined : sim.seats
    .filter((o) => o !== s && o.progress.u - s.progress.u > 3 && o.progress.u - s.progress.u < 14)
    .sort((a, b) => Number(!!b.owner) - Number(!!a.owner))[0];
  if (charging) lane = HALF_WIDTH + BAY_WIDTH / 2;
  else if (battery) lane = lateralOf(track, battery.idx, battery.x, battery.z);
  else if (prey) { const p = prey.car.rb.translation(); lane = lateralOf(track, prey.progress.idx, p.x, p.z); }

  const target = poseAt(track, s.progress.idx + look, clamp(lane, -HALF_WIDTH + 1, HALF_WIDTH - 1 + bay));
  const tx = target.x - t.x, tz = target.z - t.z;
  const angle = Math.atan2(tx * r.x + tz * r.z, tx * fx + tz * fz);
  const far = track.samples[(s.progress.idx + look * 2) % track.n];
  const bend = Math.acos(clamp(far.dx * fx + far.dz * fz, -1, 1));
  return { throttle: bend > 0.9 && speed > 13 ? -0.4 : 1, steer: clamp(angle * 2.2, -1, 1) };
}
