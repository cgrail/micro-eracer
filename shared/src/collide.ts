import { type Track, HALF_WIDTH, right } from './track.ts';

/**
 * Where bodies touch the Track and each other, for `physics.ts`. A body is a box that only turns about the vertical axis; the
 * road is a ribbon along the Track's samples, flat across, and the walls stand along its edges.
 */

/** A body as the collision tests see it; `idx` is the sample it is over. */
export interface Box { x: number; y: number; z: number; yaw: number; half: { x: number; y: number; z: number }; idx: number }

/** The road under a point: its height, and its slope `grade` along the Track's direction (`dx`, `dz`) there. */
export interface Road { y: number; grade: number; dx: number; dz: number }

/** How two things meet: `sep` apart (negative: overlapping) along `n`, which points from the first to the second; `p` is where. */
export interface Meeting { sep: number; nx: number; ny: number; nz: number; px: number; pz: number }

/**
 * A stretch of a wall's face towards the road: from (x, z) `half` either way along (ux, uz), facing the road along (nx, nz).
 * The road under its middle is at `y`, rising by `slope` per metre along it.
 */
export interface Wall { x: number; y: number; z: number; ux: number; uz: number; nx: number; nz: number; half: number; slope: number }

/** Road this far above a body's underside is road it is under, not on (the far side of a jump's drop, say). */
const UNDER = 0.9;
/** A wall's height, and half its thickness. */
const WALL_HEIGHT = 1, WALL_HALF = 0.2;
/** Where under a body the road can hold it up, in halves of its length and width. */
const FEET = [-1, -0.5, 0, 0.5, 1].flatMap((a) => [-1, 0, 1].map((l) => ({ a, l })));

/** Nearest sample to (x, z) within `reach` of sample `near`: never one on another level, which is always further along. */
export function nearestBy(track: Track, near: number, x: number, z: number, reach: number) {
  let best = near, bestD = Infinity;
  for (let k = -reach; k <= reach; k++) {
    const i = (near + k + track.n) % track.n, s = track.samples[i], d = (s.x - x) ** 2 + (s.z - z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** The road at (x, z) near sample `near`, or undefined if (x, z) is off it. */
export function roadAt(track: Track, near: number, x: number, z: number): Road | undefined {
  const { samples, n } = track, best = nearestBy(track, near, x, z, 6);
  const s = samples[best], r = right(s.dx, s.dz), lateral = (x - s.x) * r.x + (z - s.z) * r.z;
  if (lateral < -HALF_WIDTH || lateral > HALF_WIDTH + s.bay) return undefined;
  // between this sample and the next one along, or the one before
  const along = (x - s.x) * s.dx + (z - s.z) * s.dz, o = samples[(best + (along >= 0 ? 1 : n - 1)) % n];
  const grade = (along >= 0 ? o.y - s.y : s.y - o.y) / (Math.hypot(o.x - s.x, o.z - s.z) || 1);
  return { y: s.y + grade * along, grade, dx: s.dx, dz: s.dz };
}

/**
 * The highest road under a body's underside, that it rests on or will land on; undefined with no road under it. A body stays
 * level, so on a ramp it rests on its uphill edge.
 */
export function roadUnder(track: Track, b: Box): Road | undefined {
  const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), r = right(fx, fz), bottom = b.y - b.half.y;
  let best: Road | undefined;
  for (const { a, l } of FEET) {
    const road = roadAt(track, b.idx, b.x + fx * a * b.half.z + r.x * l * b.half.x, b.z + fz * a * b.half.z + r.z * l * b.half.x);
    if (road && road.y - bottom < UNDER && (!best || road.y > best.y)) best = road;
  }
  return best;
}

/** A body's corners in the ground plane. */
function corners(b: Box) {
  const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), sx = -fz, sz = fx;
  return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([f, s]) => ({
    x: b.x + fx * f * b.half.z + sx * s * b.half.x, z: b.z + fz * f * b.half.z + sz * s * b.half.x,
  }));
}

/** The middle of the corners that reach deepest by `depth`, and how deep that is. */
function deepest(cs: { x: number; z: number }[], depth: (c: { x: number; z: number }) => number) {
  const least = Math.min(...cs.map(depth)), deep = cs.filter((c) => depth(c) < least + 0.05);
  return { least, x: deep.reduce((t, c) => t + c.x, 0) / deep.length, z: deep.reduce((t, c) => t + c.z, 0) / deep.length };
}

/** Separating axis test of two bodies on their sides and the vertical: the axis they are furthest apart on (or overlap least). */
export function meet(a: Box, b: Box): Meeting {
  const radius = (o: Box, x: number, z: number) =>
    o.half.z * Math.abs(Math.sin(o.yaw) * x + Math.cos(o.yaw) * z) + o.half.x * Math.abs(-Math.cos(o.yaw) * x + Math.sin(o.yaw) * z);
  const dx = b.x - a.x, dz = b.z - a.z, dy = b.y - a.y;
  let sep = Math.abs(dy) - a.half.y - b.half.y, nx = 0, ny = dy < 0 ? -1 : 1, nz = 0, ref: Box | undefined;
  for (const o of [a, b]) for (const [x, z] of [[Math.sin(o.yaw), Math.cos(o.yaw)], [-Math.cos(o.yaw), Math.sin(o.yaw)]]) {
    const d = dx * x + dz * z, s = Math.abs(d) - radius(a, x, z) - radius(b, x, z);
    if (s > sep) { sep = s; ref = o; nx = d < 0 ? -x : x; ny = 0; nz = d < 0 ? -z : z; }
  }
  if (!ref) return { sep, nx, ny, nz, px: (a.x + b.x) / 2, pz: (a.z + b.z) / 2 };
  // a side of `ref` against the corners of the other body that reach furthest towards it, kept within that side
  const sign = ref === a ? 1 : -1, p = deepest(corners(ref === a ? b : a), (c) => sign * ((c.x - ref.x) * nx + (c.z - ref.z) * nz));
  const tx = -nz, tz = nx, along = (p.x - ref.x) * tx + (p.z - ref.z) * tz, room = radius(ref, tx, tz);
  const over = along - Math.max(-room, Math.min(room, along));
  return { sep, nx, ny, nz, px: p.x - tx * over, pz: p.z - tz * over };
}

/** The faces of the Track's walls, by the sample they start at. */
export function wallFaces(track: Track): Wall[][] {
  const faces: Wall[][] = track.samples.map(() => []);
  for (const w of track.walls) {
    const s = track.samples[w.idx], r = right(s.dx, s.dz), ux = Math.sin(w.yaw), uz = Math.cos(w.yaw), u = right(ux, uz);
    // facing away from the side of the road it stands on
    const side = (w.x - s.x) * r.x + (w.z - s.z) * r.z > 0 ? -1 : 1, nx = side * u.x, nz = side * u.z;
    faces[w.idx].push({
      x: w.x + nx * WALL_HALF, y: w.y, z: w.z + nz * WALL_HALF, ux, uz, nx, nz, half: (Math.cos(w.pitch) * w.length) / 2 + 0.05, slope: -Math.tan(w.pitch),
    });
  }
  return faces;
}

/**
 * How far a body's corners are in front of a wall (negative: into it); undefined when none is level with the wall. A wall only
 * ever pushes straight out from its face, so a body sliding along a wall made of many stretches can't catch on their ends.
 */
export function wallMeet(w: Wall, b: Box): Meeting | undefined {
  const near = corners(b).filter((c) => {
    const along = (c.x - w.x) * w.ux + (c.z - w.z) * w.uz, road = w.y + w.slope * along;
    // a corner a metre behind the face is beyond the wall, not in it
    return Math.abs(along) <= w.half && b.y - b.half.y < road + WALL_HEIGHT && b.y + b.half.y > road && (c.x - w.x) * w.nx + (c.z - w.z) * w.nz > -1;
  });
  if (!near.length) return undefined;
  const p = deepest(near, (c) => (c.x - w.x) * w.nx + (c.z - w.z) * w.nz);
  return { sep: p.least, nx: w.nx, ny: 0, nz: w.nz, px: p.x, pz: p.z };
}
