import { yawOfBody } from './car.ts';
import type { RaceSim, Seat } from './race.ts';
import { right } from './track.ts';

export type ItemKind = 'missile' | 'mine' | 'shield';
export const ITEMS: ItemKind[] = ['missile', 'mine', 'shield'];
export type HitKind = 'shot' | 'missile' | 'mine';

export interface Bolt { id: number; kind: 'shot' | 'missile'; owner: number; x: number; z: number; vx: number; vz: number; until: number; target: number }
export interface Mine { id: number; owner: number; x: number; z: number; armedAt: number; until: number }

export const SHOT_COST = 5;
const SHOT_EVERY = 1 / 3, SHOT_SPEED = 45, SHOT_LIFE = 1.1;
const MISSILE_SPEED = 30, MISSILE_TURN = 3.5, MISSILE_LIFE = 4;
const MINE_LIFE = 40, MINE_ARM = 0.8, HIT_RADIUS = 1.8, BOX_RADIUS = 2.2, BOX_RESPAWN = 4;
/** What a Hit does: Energy drained, spin-out (rad/s), sideways shove and hop (m/s). */
export const HITS: Record<HitKind, { drain: number; spin: number; shove: number; hop: number }> = {
  shot: { drain: 5, spin: 1.5, shove: 3, hop: 0 },
  missile: { drain: 20, spin: 7, shove: 3, hop: 4 },
  mine: { drain: 15, spin: 6, shove: 2, hop: 5 },
};

/** Shots, Item Boxes, Missiles, Mines and Shields of one Race. */
export class Combat {
  bolts: Bolt[] = [];
  mines: Mine[] = [];
  /** Per Item Box: the time it is back after being taken (0 = there). */
  boxes: number[];
  private id = 0;

  constructor(private sim: RaceSim) {
    this.boxes = sim.track.itemBoxes.map(() => 0);
  }

  private pose(s: Seat) {
    const t = s.car.rb.translation(), yaw = yawOfBody(s.car.rb);
    return { x: t.x, z: t.z, fx: Math.sin(yaw), fz: Math.cos(yaw) };
  }

  /** The weapon built into every E-Car: costs the shooter Energy, at most three per second. */
  shoot(s: Seat) {
    const { sim } = this;
    if (!sim.canAct(s) || sim.time < s.nextShotAt || s.energy <= SHOT_COST) return;
    s.energy -= SHOT_COST;
    s.nextShotAt = sim.time + SHOT_EVERY;
    const { x, z, fx, fz } = this.pose(s);
    this.bolts.push({ id: ++this.id, kind: 'shot', owner: s.index, x: x + fx * 2.4, z: z + fz * 2.4, vx: fx * SHOT_SPEED + s.vx, vz: fz * SHOT_SPEED + s.vz, until: sim.time + SHOT_LIFE, target: -1 });
    sim.emit({ t: 'shot', s: s.index });
  }

  useItem(s: Seat) {
    const { sim } = this;
    if (!s.item || !sim.canAct(s)) return;
    const { x, z, fx, fz } = this.pose(s);
    if (s.item === 'missile') {
      // homes in on the Racer one Position ahead
      const target = sim.seats.find((o) => o.position === s.position - 1);
      this.bolts.push({ id: ++this.id, kind: 'missile', owner: s.index, x: x + fx * 2.6, z: z + fz * 2.6, vx: fx * MISSILE_SPEED, vz: fz * MISSILE_SPEED, until: sim.time + MISSILE_LIFE, target: target?.index ?? -1 });
    } else if (s.item === 'mine') {
      this.mines.push({ id: ++this.id, owner: s.index, x: x - fx * 3, z: z - fz * 3, armedAt: sim.time + MINE_ARM, until: sim.time + MINE_LIFE });
    } else s.shield = true;
    sim.emit({ t: 'item', s: s.index, item: s.item });
    s.item = '';
  }

  step(dt: number) {
    const { sim } = this;
    const near = (s: Seat, x: number, z: number, r: number) => { const t = s.car.rb.translation(); return (t.x - x) ** 2 + (t.z - z) ** 2 < r * r; };

    sim.track.itemBoxes.forEach((box, i) => {
      if (this.boxes[i] > sim.time) return;
      // holding an Item already, driving through a box does nothing
      const s = sim.seats.find((o) => !o.item && sim.canAct(o) && near(o, box.x, box.z, BOX_RADIUS));
      if (!s) return;
      s.item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
      this.boxes[i] = sim.time + BOX_RESPAWN;
      sim.emit({ t: 'box', s: s.index, item: s.item });
    });

    this.bolts = this.bolts.filter((b) => {
      if (b.kind === 'missile' && b.target >= 0) {
        const t = sim.seats[b.target].car.rb.translation();
        const want = Math.atan2(t.x - b.x, t.z - b.z), have = Math.atan2(b.vx, b.vz);
        const turn = Math.max(-MISSILE_TURN * dt, Math.min(MISSILE_TURN * dt, Math.atan2(Math.sin(want - have), Math.cos(want - have))));
        b.vx = Math.sin(have + turn) * MISSILE_SPEED;
        b.vz = Math.cos(have + turn) * MISSILE_SPEED;
      }
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      const victim = sim.seats.find((o) => o.index !== b.owner && !sim.isAirlifted(o) && near(o, b.x, b.z, HIT_RADIUS));
      if (victim) {
        const speed = Math.hypot(b.vx, b.vz);
        this.hit(victim, b.kind, b.vx / speed, b.vz / speed, b.owner);
        return false;
      }
      return b.until > sim.time;
    });

    this.mines = this.mines.filter((m) => {
      if (m.until < sim.time) return false;
      if (m.armedAt > sim.time) return true;
      const victim = sim.seats.find((o) => !sim.isAirlifted(o) && near(o, m.x, m.z, HIT_RADIUS));
      if (!victim) return true;
      const v = Math.hypot(victim.vx, victim.vz) || 1;
      this.hit(victim, 'mine', victim.vx / v, victim.vz / v, m.owner);
      return false;
    });
  }

  /** A Shield blocks the Hit; otherwise it drains Energy and throws the E-Car around. */
  hit(victim: Seat, kind: HitKind, dx: number, dz: number, by: number) {
    const { sim } = this;
    const at = victim.car.rb.translation();
    if (kind !== 'shot') sim.emit({ t: 'boom', x: at.x, z: at.z });
    if (victim.shield) { victim.shield = false; sim.emit({ t: 'block', s: victim.index }); return; }
    const h = HITS[kind];
    victim.energy = Math.max(0, victim.energy - h.drain);
    const spin = (Math.random() < 0.5 ? -1 : 1) * h.spin;
    const ix = dx * h.shove, iz = dz * h.shove;
    if (!victim.owner) {
      const v = victim.car.rb.linvel();
      victim.car.rb.setLinvel({ x: v.x + ix, y: v.y + h.hop, z: v.z + iz }, true);
      victim.car.spin = spin;
    }
    // a Player's browser drives their E-Car, so it applies the same shove when it gets this
    sim.emit({ t: 'hit', s: victim.index, by, kind, ix, iz, hop: h.hop, spin });
    sim.stats.hits++;
  }

  /** Bots use Items right away when they make sense and shoot whoever is lined up ahead. */
  botTurn(s: Seat) {
    const { sim } = this;
    if (s.item === 'shield' || (s.item === 'missile' && s.position > 1)) this.useItem(s);
    if (s.item === 'mine' && sim.seats.some((o) => o !== s && s.progress.u - o.progress.u > 2 && s.progress.u - o.progress.u < 20)) this.useItem(s);
    if (!sim.botsAttack() || s.energy < 60 || sim.time < s.nextShotAt) return;
    const { x, z, fx, fz } = this.pose(s), r = right(fx, fz);
    const target = sim.seats.find((o) => {
      if (o === s) return false;
      const t = o.car.rb.translation(), ax = t.x - x, az = t.z - z;
      const ahead = ax * fx + az * fz, side = ax * r.x + az * r.z;
      return ahead > 3 && ahead < 25 && Math.abs(side) < 1.2;
    });
    // Bots save their Shots mostly for the Players, so the action happens around them
    if (!target || (!target.owner && Math.random() < 0.7)) { s.nextShotAt = sim.time + 0.5; return; }
    this.shoot(s);
    s.nextShotAt = sim.time + 5 + Math.random() * 4;
  }
}
