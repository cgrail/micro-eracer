import type { RaceSim, Seat } from './race.ts';
import type { TrackDef } from './track.ts';

/** The Race running online, as the start screens see it (`GET /race`): only the first Player picks a Track, and everyone
 * after them sees this one and joins it. `players`: the names of the Players in it, without its Bots. */
export interface RunningRace {
  track: TrackDef;
  players: string[];
}

/** A Seat as the browsers see it, in the room state and in an Offline Race alike. `mode`: 0 driving, 1 Stranded, 2 Recharging. */
export function seatState(sim: RaceSim, s: Seat) {
  const p = s.car.rb.translation();
  return {
    name: s.name, body: s.kind, owner: s.owner, x: p.x, y: p.y, z: p.z, yaw: s.car.rb.yaw, vx: s.vx, vz: s.vz,
    lap: sim.lap(s), position: s.position, finished: s.finished, spawn: s.spawn,
    energy: Math.ceil(s.energy), mode: sim.isStranded(s) ? 1 : sim.isRecharging(s) ? 2 : 0, item: s.item, ammo: s.ammo, shield: s.shield, pace: Math.round(s.pace * 100),
  };
}
