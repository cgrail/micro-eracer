import { MAX_ENERGY } from './car.ts';
import type { RaceSim, Seat } from './race.ts';
import { HALF_WIDTH, poseAt, sameLevel } from './track.ts';

export const BATTERY_CHARGE = 30;
const BATTERY_EVERY = 1.4, MAX_BATTERIES = 7, BATTERY_LIFE = 25, PICKUP_RADIUS = 2.4;
/** For each Position (1st first), how likely the next Battery is to appear just ahead of that Racer. */
const BATTERY_ODDS = [0.03, 0.06, 0.1, 0.12, 0.17, 0.17, 0.17, 0.18];
/** The shortest Recharge, and the longest. */
export const RECHARGE_TIME = 1.6;
const RECHARGE_MAX = 9;
/** How many Racers must be able to get past a Stranded E-Car in the top three before its Recharge is done (three for the Leader). */
const MUST_PASS = [3, 2, 1];
/** A Leader more than LEAD_FREE samples clear is slowed, down to LEAD_SLOWEST of top speed at LEAD_FULL clear. */
const LEAD_FREE = 25, LEAD_FULL = 80, LEAD_SLOWEST = 0.85;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function updateBatteries(sim: RaceSim, ranked: Seat[]) {
  sim.batteries = sim.batteries.filter((b) => b.until > sim.time);
  if (sim.time >= sim.nextBatteryAt && sim.batteries.length < MAX_BATTERIES) {
    // a Battery appears just ahead of one Racer, picked by Position: plenty at the back, fought over in the middle,
    // scarce at the front, where the Charging Station is the way to keep going
    let roll = Math.random(), k = 0;
    while (k < ranked.length - 1 && (roll -= BATTERY_ODDS[k]) > 0) k++;
    const s = ranked[k];
    if (!s.finished) {
      // between that Racer and the one in front: further ahead, someone in front would get to it first
      const gap = k ? ranked[k - 1].progress.u - s.progress.u : Infinity, reach = Math.max(6, Math.min(30, gap - 4));
      const idx = (s.progress.idx + 6 + Math.floor(Math.random() * (reach - 5))) % sim.track.n;
      const pose = poseAt(sim.track, idx, (Math.random() * 2 - 1) * (HALF_WIDTH - 1.2));
      // never inside an Item Box; the next spawn tries elsewhere
      if (!sim.track.itemBoxes.some((b) => (b.x - pose.x) ** 2 + (b.z - pose.z) ** 2 < 3 ** 2)) sim.batteries.push({ id: ++sim.batteryId, x: pose.x, y: sim.track.samples[idx].y, z: pose.z, idx, until: sim.time + BATTERY_LIFE });
    }
    sim.nextBatteryAt = sim.time + BATTERY_EVERY;
  }
  for (const s of sim.seats) {
    if (sim.isRecharging(s)) continue;
    const t = s.car.rb.translation();
    const hit = sim.batteries.find((b) => (b.x - t.x) ** 2 + (b.z - t.z) ** 2 < PICKUP_RADIUS ** 2 && sameLevel(b.y, t.y));
    if (!hit) continue;
    s.energy = Math.min(MAX_ENERGY, s.energy + BATTERY_CHARGE);
    sim.batteries = sim.batteries.filter((b) => b !== hit);
    sim.stats.pickups++;
    sim.emit({ t: 'battery', s: s.index });
  }
}

/**
 * How long the drone takes to fill a Stranded E-Car. At the back, RECHARGE_TIME; near the front, until enough Racers behind
 * could drive past (`MUST_PASS`), going by how far back they are and how fast they come, at most RECHARGE_MAX.
 */
export function rechargeLength(s: Seat, ranked: Seat[]) {
  const behind = ranked.filter((o) => o.position > s.position && !o.finished);
  const chaser = behind[Math.min(MUST_PASS[s.position - 1] ?? 0, behind.length) - 1];
  if (!chaser) return RECHARGE_TIME;
  // a second more, so it is past and not alongside
  const gap = s.progress.u - chaser.progress.u, speed = Math.max(10, Math.hypot(chaser.vx, chaser.vz));
  return clamp(gap / speed + 1, RECHARGE_TIME, RECHARGE_MAX);
}

/** Slows a Leader who is far ahead, so the others can catch up; everyone else drives at full pace. */
export function leadPace(ranked: Seat[]) {
  for (const s of ranked) s.pace = 1;
  const [first, second] = ranked;
  if (!second || first.finished) return;
  first.pace = 1 - (1 - LEAD_SLOWEST) * clamp((first.progress.u - second.progress.u - LEAD_FREE) / (LEAD_FULL - LEAD_FREE), 0, 1);
}
