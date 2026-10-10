import type { BodyKind } from '../../shared/src/car.ts';
import type { Phase, RaceEvent } from '../../shared/src/race.ts';

/** Mirrors server/src/RaceRoom.ts. */
export interface CarState {
  name: string; body: BodyKind; owner: string; x: number; y: number; z: number; yaw: number; vx: number; vz: number;
  lap: number; position: number; finished: boolean; spawn: number; energy: number; mode: number; item: string; shield: boolean;
}
export interface Spot { id: number; x: number; y: number; z: number }
export interface BoltState extends Spot { kind: string; vx: number; vz: number }
export interface List<T> { forEach(cb: (item: T, i: number) => void): void }
export interface RaceState {
  phase: Phase; timer: number; trackId: string; cars: List<CarState>; results: List<string>;
  batteries: List<Spot>; bolts: List<BoltState>; mines: List<Spot>; boxes: List<boolean>;
}

/** `CarState.mode` */
export const DRIVING = 0, STRANDED = 1, RECHARGE = 2;

/** What the game needs of a Race: the online room, or an Offline Race in this browser (`offline.ts`). */
export interface RaceLink {
  sessionId: string;
  onStateChange(cb: (state: RaceState) => void): void;
  onMessage(type: 'events', cb: (list: RaceEvent[]) => void): void;
  onDrop(cb: () => void): void;
  onReconnect(cb: () => void): void;
  onLeave(cb: () => void): void;
  send(type: 'pose' | 'shoot' | 'item', msg?: unknown): void;
}
