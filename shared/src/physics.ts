import { type Meeting, type Wall, meet, nearestBy, roadAt, roadUnder, wallFaces, wallMeet } from './collide.ts';
import { type Pose, type Track, nearestSample } from './track.ts';

/**
 * Our own physics, just what E-Cars need: boxes that only turn about the vertical axis, on the Track's road and between its
 * walls (`collide.ts`). Plain arithmetic, so it runs alike in Node and the browser and ports to Swift.
 *
 * A step: gravity; contacts found where the bodies are, each stopping its pair where they would meet (or bouncing them off
 * each other); then they move, and any overlap left (from turning, or a kinematic body moved into another) is pushed apart.
 */

export interface Vec3 { x: number; y: number; z: number }
export const DT = 1 / 60;
const GRAVITY = -20;
/** Passes of the solver over all contacts per step. */
const ITERATIONS = 4;
/** How bouncy E-Cars are against each other and the walls (not the road), when they meet faster than BOUNCE_FROM m/s. */
const BOUNCE = 0.3, BOUNCE_FROM = 1;
/** Bodies closer than this are touching. */
const TOUCH = 0.01;

const wrap = (a: number) => (a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a);
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/**
 * A box `half` in size that only turns about the vertical axis. A dynamic body is moved by the world; a kinematic one goes
 * where `moveTo` says and pushes without being pushed.
 */
export class RigidBody {
  x: number; y: number; z: number; yaw: number;
  vx = 0; vy = 0; vz = 0;
  /** Turning speed about the vertical axis in rad/s (positive turns left). */
  yawRate = 0;
  readonly invMass: number;
  readonly invInertia: number;
  /** The sample this body is over, so the road under it is found by a short search; -1 when not known. */
  idx = -1;
  /** Kinematic: where to be after the next step. */
  next: Pose | undefined;

  constructor(readonly half: Vec3, mass: number, readonly dynamic: boolean, pose: Pose) {
    this.x = pose.x; this.y = pose.y; this.z = pose.z; this.yaw = wrap(pose.yaw);
    this.invMass = dynamic ? 1 / mass : 0;
    this.invInertia = dynamic ? 3 / (mass * (half.x ** 2 + half.z ** 2)) : 0;
  }

  translation(): Vec3 { return { x: this.x, y: this.y, z: this.z }; }
  linvel(): Vec3 { return { x: this.vx, y: this.vy, z: this.vz }; }
  setLinvel(v: Vec3) { this.vx = v.x; this.vy = v.y; this.vz = v.z; }
  /** Puts the body at `pose` at once, without touching anything in between. */
  setPose(pose: Pose) { this.x = pose.x; this.y = pose.y; this.z = pose.z; this.yaw = wrap(pose.yaw); this.next = undefined; this.idx = -1; }
  /** Kinematic: moves to `pose` over the next step, at the speed that takes. */
  moveTo(pose: Pose) { this.next = pose; }
}

/** One contact for the solver; `a` is undefined for the road and the walls. `ka`, `kb`: how much turning moves it along n. */
interface Contact {
  a: RigidBody | undefined; b: RigidBody;
  nx: number; ny: number; nz: number; ka: number; kb: number;
  sep: number; mass: number; target: number; impulse: number;
}

/** Speed at which the contact's two sides are coming apart along its normal (negative: closing). */
function closing(c: Contact) {
  const { a, b } = c;
  const vb = b.vx * c.nx + b.vy * c.ny + b.vz * c.nz + b.yawRate * c.kb;
  return a ? vb - (a.vx * c.nx + a.vy * c.ny + a.vz * c.nz + a.yawRate * c.ka) : vb;
}

function applyImpulse(c: Contact, j: number) {
  const { a, b } = c;
  b.vx += j * c.nx * b.invMass; b.vy += j * c.ny * b.invMass; b.vz += j * c.nz * b.invMass; b.yawRate += j * c.kb * b.invInertia;
  if (a) { a.vx -= j * c.nx * a.invMass; a.vy -= j * c.ny * a.invMass; a.vz -= j * c.nz * a.invMass; a.yawRate -= j * c.ka * a.invInertia; }
}

function contact(a: RigidBody | undefined, b: RigidBody, m: Meeting, bouncy: boolean): Contact {
  // a contact point off a body's middle turns it: the lever arm across the normal
  const ka = a ? (m.pz - a.z) * m.nx - (m.px - a.x) * m.nz : 0, kb = (m.pz - b.z) * m.nx - (m.px - b.x) * m.nz;
  const inv = (a ? a.invMass + a.invInertia * ka * ka : 0) + b.invMass + b.invInertia * kb * kb;
  const c: Contact = { a, b, nx: m.nx, ny: m.ny, nz: m.nz, ka, kb, sep: m.sep, mass: inv > 0 ? 1 / inv : 0, target: 0, impulse: 0 };
  // closing the gap and no more; meeting this step at speed, they bounce off each other instead
  const v = closing(c), gap = Math.max(0, m.sep) / DT;
  c.target = bouncy && v < -BOUNCE_FROM && v < -gap ? -BOUNCE * v : -gap;
  return c;
}

/** The Track's road and walls, and the E-Cars on them. */
export class World {
  readonly bodies: RigidBody[] = [];
  private walls: Wall[][];
  /** Pairs of bodies in contact during the last step. */
  private touches: [RigidBody, RigidBody][] = [];

  constructor(readonly track: Track) {
    this.walls = wallFaces(track);
  }

  add(body: RigidBody) { this.bodies.push(body); return body; }
  remove(body: RigidBody) { this.bodies.splice(this.bodies.indexOf(body), 1); }

  /** Whether `a` and `b` touched in the last step. */
  touching = (a: RigidBody, b: RigidBody) => this.touches.some(([p, q]) => (p === a && q === b) || (p === b && q === a));

  /** Whether the road is under the body's middle, at most `reach` below it (another E-Car's roof doesn't count). */
  onRoad(body: RigidBody, reach: number) {
    this.locate(body);
    const road = roadAt(this.track, body.idx, body.x, body.z);
    return !!road && body.y - road.y > -0.1 && body.y - road.y < reach;
  }

  step() {
    const dynamic = this.bodies.filter((b) => b.dynamic), contacts: Contact[] = [];
    for (const b of this.bodies) {
      if (b.dynamic) { b.vy += GRAVITY * DT; this.locate(b); }
      else if (b.next) {
        b.vx = (b.next.x - b.x) / DT; b.vy = (b.next.y - b.y) / DT; b.vz = (b.next.z - b.z) / DT;
        b.yawRate = angleDiff(b.yaw, b.next.yaw) / DT;
      } else b.vx = b.vy = b.vz = b.yawRate = 0;
    }
    for (const b of dynamic) {
      const road = roadUnder(this.track, b);
      if (road) {
        // the road pushes along its normal, so on a ramp it lifts an E-Car, and gravity pulls it back down the slope
        const g = Math.hypot(1, road.grade), sep = (b.y - b.half.y - road.y) / g;
        if (sep < Math.max(0, -b.vy) * DT + 0.05) {
          contacts.push(contact(undefined, b, { sep, nx: (-road.grade * road.dx) / g, ny: 1 / g, nz: (-road.grade * road.dz) / g, px: b.x, pz: b.z }, false));
        }
      }
      const margin = 0.1 + (Math.hypot(b.vx, b.vz) + Math.abs(b.yawRate) * Math.hypot(b.half.x, b.half.z)) * DT;
      for (const w of this.wallsNear(b)) {
        const m = wallMeet(w, b);
        if (m && m.sep < margin) contacts.push(contact(undefined, b, m, true));
      }
    }
    for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) this.pair(contacts, this.bodies[i], this.bodies[j]);

    for (let it = 0; it < ITERATIONS; it++) for (const c of contacts) {
      const total = Math.max(0, c.impulse + (c.target - closing(c)) * c.mass);
      applyImpulse(c, total - c.impulse);
      c.impulse = total;
    }
    this.touches = contacts.filter((c) => c.a && (c.impulse > 0 || c.sep <= TOUCH)).map((c) => [c.a!, c.b]);

    for (const b of this.bodies) {
      if (b.dynamic) { b.x += b.vx * DT; b.y += b.vy * DT; b.z += b.vz * DT; b.yaw = wrap(b.yaw + b.yawRate * DT); }
      else if (b.next) { b.x = b.next.x; b.y = b.next.y; b.z = b.next.z; b.yaw = wrap(b.next.yaw); b.next = undefined; }
    }
    // whatever still overlaps is pushed apart, the lighter body further; then out of the walls and back onto the road
    for (const c of contacts) {
      const { a, b } = c, share = (a?.invMass ?? 0) + b.invMass;
      if (!a || !share) continue;
      const m = meet(a, b);
      if (m.sep >= 0) continue;
      const da = (m.sep * a.invMass) / share, db = (-m.sep * b.invMass) / share;
      a.x += m.nx * da; a.y += m.ny * da; a.z += m.nz * da;
      b.x += m.nx * db; b.y += m.ny * db; b.z += m.nz * db;
    }
    for (const b of dynamic) {
      for (const w of this.wallsNear(b)) {
        const m = wallMeet(w, b);
        if (m && m.sep < 0) { b.x -= m.nx * m.sep; b.z -= m.nz * m.sep; }
      }
      // out of the road along its normal: on a slope it pushes back as well as up
      const road = roadUnder(this.track, b), sunk = road ? road.y - (b.y - b.half.y) : 0;
      if (road && sunk > 0) {
        const k = sunk / (1 + road.grade ** 2);
        b.x -= k * road.grade * road.dx; b.y += k; b.z -= k * road.grade * road.dz;
      }
    }
  }

  private *wallsNear(b: RigidBody) {
    for (let k = -5; k <= 5; k++) yield* this.walls[(b.idx + k + this.track.n) % this.track.n];
  }

  /** Keeps `idx` on the sample under the body: a short search as it drives, the whole Track after a jump. */
  private locate(b: RigidBody) {
    const s = this.track.samples[b.idx];
    if (!s || (s.x - b.x) ** 2 + (s.y - b.y) ** 2 + (s.z - b.z) ** 2 > 12 ** 2) b.idx = nearestSample(this.track, b.x, b.y, b.z);
    else b.idx = nearestBy(this.track, b.idx, b.x, b.z, 10);
  }

  private pair(contacts: Contact[], a: RigidBody, b: RigidBody) {
    // how far they could close in on each other this step, turning included
    const ra = Math.hypot(a.half.x, a.half.z), rb = Math.hypot(b.half.x, b.half.z);
    const margin = 0.1 + (Math.hypot(b.vx - a.vx, b.vy - a.vy, b.vz - a.vz) + Math.abs(a.yawRate) * ra + Math.abs(b.yawRate) * rb) * DT;
    if ((b.x - a.x) ** 2 + (b.z - a.z) ** 2 > (ra + rb + margin) ** 2 || Math.abs(b.y - a.y) > a.half.y + b.half.y + margin) return;
    const m = meet(a, b);
    if (m.sep < margin) contacts.push(contact(a, b, m, true));
  }
}
