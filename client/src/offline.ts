import { type BodyKind, DT } from '../../shared/src/car.ts';
import { type PoseReport, type RaceEvent, RaceSim } from '../../shared/src/race.ts';
import { seatState } from '../../shared/src/snapshot.ts';
import type { RaceLink, RaceState } from './state.ts';

const ME = 'offline';

/** An Offline Race: the server's RaceSim run in this browser, against Bots, behind the same interface as the online room. */
export function offlineRace(name: string, body: BodyKind, track?: string): RaceLink {
  // a picked Track first, then one at random each Race
  const sim = new RaceSim(track);
  sim.join(ME, name.slice(0, 16) || 'Player', body);
  const seat = () => sim.seats.find((s) => s.owner === ME)!;
  let onState: (s: RaceState) => void = () => {}, onEvents: (list: RaceEvent[]) => void = () => {};
  let last = performance.now(), acc = 0;
  setInterval(() => {
    const now = performance.now();
    // a background tab runs its timers rarely; the Race waits rather than racing ahead in a burst
    acc = Math.min(acc + (now - last) / 1000, DT * 6);
    last = now;
    for (; acc >= DT; acc -= DT) sim.step(DT);
    if (sim.events.length) { onEvents(sim.events); sim.events = []; }
    onState({
      phase: sim.phase, timer: Math.max(0, sim.timer), trackId: sim.track.def.id, results: sim.results,
      cars: sim.seats.map((s) => seatState(sim, s)), batteries: sim.batteries, bolts: sim.combat.bolts, mines: sim.combat.mines,
      boxes: sim.combat.out, track: sim.track.def,
    });
  }, 1000 * DT);
  return {
    sessionId: ME,
    onStateChange: (cb) => { onState = cb; },
    onMessage: (_type, cb) => { onEvents = cb; },
    // nothing to lose a connection to
    onDrop() {}, onReconnect() {}, onLeave() {},
    send: (type, msg) => {
      if (type === 'pose') sim.setPose(ME, msg as PoseReport);
      else if (type === 'item') sim.combat.useItem(seat());
    },
  };
}
