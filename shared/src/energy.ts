import { MAX_ENERGY } from './car.ts';
import type { RaceSim, Seat } from './race.ts';
import { HALF_WIDTH, poseAt, sameLevel } from './track.ts';

export const BATTERY_CHARGE = 30;
const BATTERY_EVERY = 1.4, MAX_BATTERIES = 7, BATTERY_LIFE = 25, PICKUP_RADIUS = 2.4;
/** For each Position from 2nd, how likely the next Battery is to appear just ahead of that Racer. The Leader gets none: */
// out in front, the Charging Station is the only way to keep going
const BATTERY_ODDS = [0.06, 0.1, 0.12, 0.17, 0.17, 0.17, 0.18];
/** The shortest Recharge, and the longest. */
export const RECHARGE_TIME = 1.6;
const RECHARGE_MAX = 9;
/** How many Racers must be able to get past a Stranded E-Car in the top three before its Recharge is done (three for the Leader). */
const MUST_PASS = [3, 2, 1];
/**
 * Keeping the front three fighting: the Leader is slowed once more than `free` metres clear of second, down to `slowest` of
 * top speed at `full` clear, so second is always in sight; second the same against third, but milder.
 */
const PACK = [{ free: 2, full: 20, slowest: 0.75 }, { free: 4, full: 25, slowest: 0.88 }];
/** Second and third get a tow, up to TOW of top speed, once the E-Car ahead is more than TOW_FROM metres away. */
const TOW = 1.06, TOW_FROM = 6, TOW_FULL = 25;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Which Racer, by Position from 0, a Battery appears ahead of: never the Leader, and behind them by BATTERY_ODDS, each share
 * spread over as many Racers in a field bigger than theirs. */
export function batteryRank(field: number) {
  let roll = Math.random(), k = 0;
  while (k < BATTERY_ODDS.length - 1 && (roll -= BATTERY_ODDS[k]) > 0) k++;
  const behind = field - 1;
  return 1 + (behind > BATTERY_ODDS.length ? Math.floor(((k + Math.random()) * behind) / BATTERY_ODDS.length) : k);
}

export function updateBatteries(sim: RaceSim, ranked: Seat[]) {
  sim.batteries = sim.batteries.filter((b) => b.until > sim.time);
  if (sim.time >= sim.nextBatteryAt && sim.batteries.length < MAX_BATTERIES) {
    // a Battery appears just ahead of one Racer, picked by Position: plenty at the back, fought over in the middle,
    // scarce at the front, where the Charging Station is the way to keep going
    const k = batteryRank(ranked.length), s = ranked[k];
    if (!s.finished) {
      // between that Racer and the one in front: further ahead, someone in front would get to it first
      const gap = ranked[k - 1].progress.u - s.progress.u, reach = Math.max(6, Math.min(30, gap - 4));
      const idx = (s.progress.idx + 6 + Math.floor(Math.random() * (reach - 5))) % sim.track.n;
      const pose = poseAt(sim.track, idx, (Math.random() * 2 - 1) * (HALF_WIDTH - 1.2));
      // never inside an Item Box; the next spawn tries elsewhere
      if (!sim.track.itemBoxes.some((b) => (b.x - pose.x) ** 2 + (b.z - pose.z) ** 2 < 3 ** 2)) sim.batteries.push({ id: ++sim.batteryId, x: pose.x, y: sim.track.samples[idx].y, z: pose.z, idx, until: sim.time + BATTERY_LIFE });
    }
    sim.nextBatteryAt = sim.time + BATTERY_EVERY;
  }
  for (const s of sim.seats) {
    // the Leader drives through one, as from Item Boxes the front gets nothing
    if (sim.isRecharging(s) || s.position === 1) continue;
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

/** Holds the front three together (`PACK`, `TOW`); everyone else drives at full pace. */
export function leadPace(ranked: Seat[]) {
  for (const s of ranked) s.pace = 1;
  const gap = (i: number) => ranked[i].progress.u - ranked[i + 1].progress.u;
  const racing = (i: number) => ranked[i + 1] && !ranked[i].finished && !ranked[i + 1].finished;
  PACK.forEach(({ free, full, slowest }, i) => {
    if (racing(i)) ranked[i].pace = 1 - (1 - slowest) * clamp((gap(i) - free) / (full - free), 0, 1);
  });
  for (const i of [0, 1]) if (racing(i)) ranked[i + 1].pace *= 1 + (TOW - 1) * clamp((gap(i) - TOW_FROM) / (TOW_FULL - TOW_FROM), 0, 1);
}
