import { yawOfBody } from './car.ts';
import type { RaceSim, Seat } from './race.ts';

/** A Seat as the browsers see it, in the room state and in an Offline Race alike. `mode`: 0 driving, 1 Stranded, 2 Airlifted. */
export function seatState(sim: RaceSim, s: Seat) {
  const p = s.car.rb.translation();
  return {
    name: s.name, body: s.kind, owner: s.owner, x: p.x, y: p.y, z: p.z, yaw: yawOfBody(s.car.rb), vx: s.vx, vz: s.vz,
    lap: sim.lap(s), position: s.position, finished: s.finished, spawn: s.spawn,
    energy: Math.ceil(s.energy), mode: sim.isStranded(s) ? 1 : sim.isAirlifted(s) ? 2 : 0, item: s.item, shield: s.shield,
  };
}
