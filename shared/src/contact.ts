import { BODIES, type BodyKind, type Car, MAX_ENERGY, teleport } from './car.ts';
import type { RaceSim } from './race.ts';
import { freeSpot, right } from './track.ts';

/** Contacts between E-Cars: Rams, and one ending up on another's roof. */

export const RAM_MIN_SPEED = 3;
const RAM_ENERGY_PER_MS = 3, RAM_MAX = 25, RAM_COOLDOWN = 1;
/** How bouncy a Ram is, how much it swings an E-Car hit off-centre (rad/s per m/s), and how long the victim skids. */
const RAM_BOUNCE = 0.3, RAM_SWING = 0.12, RAM_SKID = 0.6;

/**
 * How much of a Ram's shove, swing and skid the victim takes: all of it from an E-Car as heavy or heavier, and from a lighter
 * one only the square of their weights' ratio, so a Roadster barely moves a Semi (9%) and a Microbus (21%).
 */
export const give = (rammer: BodyKind, victim: BodyKind) => Math.min(1, BODIES[rammer].mass / BODIES[victim].mass) ** 2;

/**
 * What a Ram does, as a collision of the two weights: the speed along the contact the victim gets (`kick`, away from the
 * rammer) and the rammer keeps (`keep`), and the victim's swing. `n` points from rammer to victim, `closing` along it.
 */
export function ramResponse(rammer: Car, victim: Car, n: { x: number; z: number }, closing: number) {
  const mr = BODIES[rammer.kind].mass, mv = BODIES[victim.kind].mass, g = give(rammer.kind, victim.kind);
  const yaw = victim.rb.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), r = right(fx, fz);
  const rp = rammer.rb.translation(), vp = victim.rb.translation();
  // hit at the nose or tail rather than the middle, the victim swings round
  const along = (rp.x - vp.x) * fx + (rp.z - vp.z) * fz, side = n.x * r.x + n.z * r.z;
  return {
    kick: (g * closing * (1 + RAM_BOUNCE) * mr) / (mr + mv),
    keep: (closing * (mr - RAM_BOUNCE * mv)) / (mr + mv),
    spin: -g * Math.sign(along) * side * closing * RAM_SWING,
  };
}

/**
 * The victim's side of a Ram: shoved (`ix`, `iz`), skidding for as much of RAM_SKID as it `give`s, maybe swinging round. Each
 * side applies it to its own E-Cars.
 */
export function shove(car: Car, ix: number, iz: number, spin: number, give: number) {
  const v = car.rb.linvel();
  car.rb.setLinvel({ x: v.x + ix, y: v.y, z: v.z + iz });
  car.slide = Math.max(car.slide, RAM_SKID * give);
  if (Math.abs(spin) > Math.abs(car.spin)) car.spin = spin;
}
/** Resting on another E-Car this long (not just flying over it), an E-Car is put down beside it. */
const STACKED_FOR = 0.5;

/**
 * A Ram moves Energy from the hit E-Car to the one that drove into the contact harder (speed times weight), and shoves the
 * victim away: the arcade grip would otherwise soak a sideways push up at once.
 */
export function judgeRams(sim: RaceSim) {
  const n = sim.seats.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = sim.seats[i], b = sim.seats[j], key = i * n + j;
    if (sim.isRecharging(a) || sim.isRecharging(b) || sim.time < (sim.ramCooldown.get(key) ?? 0)) continue;
    if (!sim.world.touching(a.car.rb, b.car.rb)) continue;
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
    const away = rammer === a ? 1 : -1, dir = { x: nx * away, z: nz * away };
    const { kick, spin } = ramResponse(rammer.car, victim.car, dir, sa + sb), ix = dir.x * kick, iz = dir.z * kick;
    // between two Bots the physics has shared the momentum already; a Player's E-Car is moved by its poses here and
    // barely pushes, so a Bot it rams gets the shove from us
    if (!victim.owner) shove(victim.car, rammer.owner ? ix : 0, rammer.owner ? iz : 0, spin, give(rammer.car.kind, victim.car.kind));
    sim.stats.rams++;
    // a Player's browser drives their E-Car, so it applies the shove when it gets this, as for a Hit
    sim.emit({ t: 'ram', a: rammer.index, b: victim.index, n: Math.round(amount), ix, iz, spin });
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
