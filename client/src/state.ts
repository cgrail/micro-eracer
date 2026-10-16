import type { BodyKind } from '../../shared/src/car.ts';
import type { Phase, RaceEvent } from '../../shared/src/race.ts';
import { type Theme, type TrackDef, TRACKS } from '../../shared/src/track.ts';

/** Mirrors server/src/RaceRoom.ts. */
export interface CarState {
  name: string; body: BodyKind; owner: string; x: number; y: number; z: number; yaw: number; vx: number; vz: number;
  lap: number; position: number; finished: boolean; spawn: number; energy: number; mode: number; item: string; ammo: number; shield: boolean; pace: number;
}
export interface Spot { id: number; x: number; y: number; z: number }
export interface BoltState extends Spot { kind: string; vx: number; vz: number }
export interface List<T> { length: number; forEach(cb: (item: T, i: number) => void): void }
/** The Race's Track as the room sends it (`TrackDef`); empty from a server from before it sent one. */
export interface TrackState { id: string; name: string; theme: string; pieces: string; puddles: List<number>; items: List<number> }
export interface RaceState {
  phase: Phase; timer: number; trackId: string; cars: List<CarState>; results: List<string>; finishers: number;
  batteries: List<Spot>; bolts: List<BoltState>; mines: List<Spot>; boxes: List<boolean>; track?: TrackState;
}

const listOf = <T>(list: List<T>) => { const all: T[] = []; list.forEach((v) => all.push(v)); return all; };
/** The Track the Race is on: the one the room sent, so it is the server's even where it isn't one this game came with. */
export function trackDefOf(s: RaceState): TrackDef {
  const t = s.track;
  if (t?.pieces && t.id === s.trackId) return { id: t.id, name: t.name, theme: t.theme as Theme, pieces: t.pieces, puddles: listOf(t.puddles), items: listOf(t.items) };
  return TRACKS.find((d) => d.id === s.trackId) ?? TRACKS[0];
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
  send(type: 'pose' | 'item', msg?: unknown): void;
}
