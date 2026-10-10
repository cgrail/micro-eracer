import { BODIES, MAX_ENERGY, teleport } from './car.ts';
import type { RaceSim } from './race.ts';
import { freeSpot } from './track.ts';

/** Contacts between E-Cars: Rams, and one ending up on another's roof. */

const RAM_MIN_SPEED = 3, RAM_ENERGY_PER_MS = 3, RAM_MAX = 25, RAM_COOLDOWN = 1;
/** Resting on another E-Car this long (not just flying over it), an E-Car is put down beside it. */
const STACKED_FOR = 0.5;

/** A Ram moves Energy from the hit E-Car to the one that drove into the contact harder (speed times weight). */
export function judgeRams(sim: RaceSim) {
  const n = sim.seats.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = sim.seats[i], b = sim.seats[j], key = i * n + j;
    if (sim.isRecharging(a) || sim.isRecharging(b) || sim.time < (sim.ramCooldown.get(key) ?? 0)) continue;
    let touching = false;
    sim.world.contactPair(a.car.rb.collider(0), b.car.rb.collider(0), (m) => { if (m.numContacts() > 0) touching = true; });
    if (!touching) continue;
    const pa = a.car.rb.translation(), pb = b.car.rb.translation();
    const d = Math.hypot(pb.x - pa.x, pb.z - pa.z) || 1, nx = (pb.x - pa.x) / d, nz = (pb.z - pa.z) / d;
    const sa = a.vx * nx + a.vz * nz, sb = -(b.vx * nx + b.vz * nz);
    if (sa + sb < RAM_MIN_SPEED) continue;
    const [rammer, victim] = sa * BODIES[a.kind].mass >= sb * BODIES[b.kind].mass ? [a, b] : [b, a];
    sim.ramCooldown.set(key, sim.time + RAM_COOLDOWN);
    if (victim.shield) { victim.shield = false; sim.emit({ t: 'block', s: victim.index }); continue; }
    const amount = Math.min(RAM_MAX, 5 + (sa + sb - RAM_MIN_SPEED) * RAM_ENERGY_PER_MS, victim.energy);
    victim.energy -= amount;
    rammer.energy = Math.min(MAX_ENERGY, rammer.energy + amount);
    sim.stats.rams++;
    sim.emit({ t: 'ram', a: rammer.index, b: victim.index, n: Math.round(amount) });
  }
}

/** An E-Car on another's roof is put down next to it where there's room; a Player's browser follows the `spawn` jump. */
export function unstack(sim: RaceSim, dt: number) {
  for (const s of sim.seats) {
    const t = s.car.rb.translation();
    // above another's middle by more than half a car's height, but not on a bridge over it
    const onTop = sim.seats.some((o) => {
      const p = o.car.rb.translation(), dy = t.y - p.y;
      return o !== s && dy > 0.5 && dy < 2.5 && (t.x - p.x) ** 2 + (t.z - p.z) ** 2 < 3 ** 2;
    });
    s.stackedFor = onTop ? s.stackedFor + dt : 0;
    if (s.stackedFor < STACKED_FOR) continue;
    s.stackedFor = 0;
    const others = sim.seats.filter((o) => o !== s).map((o) => o.car.rb.translation());
    const spot = freeSpot(sim.track, [s.progress.idx, s.progress.idx + 5, s.progress.idx - 5], others);
    if (!spot) continue;
    teleport(s.car, spot.pose, s.vx, s.vz);
    // a jump, not driving, so it costs no Energy
    s.lastX = spot.pose.x;
    s.lastZ = spot.pose.z;
    if (s.owner) s.spawn++;
  }
}
