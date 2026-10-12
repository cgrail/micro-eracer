import { HALF_WIDTH, TILE, type Track, right } from '../../../shared/src/track.ts';
import { type Part, type ThemeData, type Vec, ball, box, cone, cyl, dome, flat, grp, many, sign, sized, spin, torus, turn, wedge } from './kit.ts';

// Where a Track's set pieces go: the river under its best straight, the bridge that carries the road over it in the theme's
// style, a gate, piers and hills by the water, and every landmark. It is worked out here once, from the Track and the
// theme; the browsers build it (scene.ts) and the apps read the very same result from Themes.json (ThemeData.swift).

/** The ground under a data theme's Tracks (`groundY`). */
const GROUND = -3;

/** A landmark placed beside the road, facing it. */
export interface Placed { kind: string; x: number; z: number; yaw: number; scale?: number }

export interface Staging {
  /** The middles of the tiles small props must leave alone: the water's, the hills' and the landmarks'. */
  blocked: [number, number][];
  landmarks: Placed[];
  /** The river and its bridge, piers and hills, in the Track's own coordinates. */
  parts: Part[];
  /** The bridge over the water: its samples, whose walls are its railings and which stand on its own piers, not pillars. */
  bridge?: { from: number; to: number; rail: number };
  /** For the Track's picture: a point on the water's middle line, the line's direction and the water's width. */
  river?: { x: number; z: number; dx: number; dz: number; width: number; color: number };
}

/** A small seeded random in [0, 1): the same placement in every browser and, through the JSON, in the apps. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), h | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (v: number) => Math.round(v * 100) / 100;
/** Parts moved to (x, y, z), tilted by `pitch` (nose up for a positive one) and turned to face `yaw`. */
const place = (parts: Part[], x: number, y: number, z: number, yaw: number, pitch = 0): Part =>
  grp([spin(pitch ? turn(grp(parts), -pitch) : grp(parts), yaw)], x, y, z);

/** A round rod from a to b: a cable, a hanger, a piling. */
function rod(a: Vec, b: Vec, r: number, c: number): Part {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], level = Math.hypot(d[0], d[2]), len = Math.hypot(level, d[1]);
  return grp([spin(turn(cyl(r, r, len, c, 0, 0, 0, 6), Math.PI / 2 - Math.atan2(d[1], level)), Math.atan2(d[0], d[2]))], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
}

/** The highest straight stretch between the start and the grid (the longest of those), jumps left out. */
function bestStraight(track: Track) {
  const s = track.samples, first = track.checkpoints[1], last = track.checkpoints[track.checkpoints.length - 2];
  let best: { from: number; to: number; level: number } | undefined, from = -1;
  for (let i = first; i <= last; i++) {
    const straight = i < last && !s[i].turn && !s[i].kick;
    if (straight && from < 0) from = i;
    if (straight || from < 0) continue;
    const level = Math.round(Math.max(...s.slice(from, i).map((p) => p.y)) / 3.5);
    if (!best || level > best.level || (level === best.level && i - from > best.to - best.from)) best = { from, to: i, level };
    from = -1;
  }
  return best;
}

export function staging(track: Track, theme: ThemeData): Staging {
  const random = seeded(`${track.def.id}:staging`), s = track.samples, parts: Part[] = [];
  const key = (x: number, z: number) => `${Math.round(x)},${Math.round(z)}`;
  const road = new Set(track.tiles.map((t) => key(t.x, t.z))), blocked = new Set<string>();
  const tx = track.tiles.map((t) => t.x), tz = track.tiles.map((t) => t.z);
  const grid = (margin: number) => {
    const out: [number, number][] = [];
    for (let x = Math.min(...tx) - margin * TILE; x <= Math.max(...tx) + margin * TILE; x += TILE) {
      for (let z = Math.min(...tz) - margin * TILE; z <= Math.max(...tz) + margin * TILE; z += TILE) out.push([x, z]);
    }
    return out;
  };
  const clearOfRoad = (x: number, z: number, r: number) => s.every((p) => (p.x - x) ** 2 + (p.z - z) ** 2 > r * r);
  const out: Staging = { blocked: [], landmarks: [], parts };

  const water = theme.water, run = water && bestStraight(track);
  if (water && run) {
    // the river crosses the stretch where it is highest, as wide as that part, so the bridge reaches past both banks
    const top = Math.max(...s.slice(run.from, run.to).map((p) => p.y));
    const tops = [...Array(run.to - run.from).keys()].map((i) => run.from + i).filter((i) => s[i].y >= top - 0.05);
    const len = run.to - run.from, wanted = top > 1 ? tops.length - 2 : len * 0.4;
    const width = Math.max(6, Math.min(len - 8, Math.max(water.width[0], Math.min(water.width[1], wanted))));
    // the middle of the top, but far enough inside the stretch for the bridge to reach past both banks
    const edge = Math.ceil(width / 2 + 3), c = Math.max(run.from + edge, Math.min(run.to - 1 - edge, tops[Math.floor(tops.length / 2)]));
    const half = width / 2, dir = { x: s[c].dx, z: s[c].dz }, along = right(dir.x, dir.z), yaw = Math.atan2(dir.x, dir.z);
    const from = Math.max(run.from, Math.round(c - half - 3)), to = Math.min(run.to - 1, Math.round(c + half + 3));
    out.bridge = { from, to, rail: water.rail };
    out.river = { x: r2(s[c].x), z: r2(s[c].z), dx: r2(along.x), dz: r2(along.z), width: r2(width), color: water.color };
    // seen from the river: x runs along the water, z across it (towards where the road goes on)
    const at = (u: number, v: number) => ({ x: s[c].x + along.x * u + dir.x * v, z: s[c].z + along.z * u + dir.z * v });
    parts.push(place([
      flat(box(900, 0.1, width, water.color, 0, 0.06, 0)), ...[-1, 1].map((k) => flat(box(900, 0.08, 2.4, water.bank, 0, 0.04, k * (half + 1.2)))),
      ...many(30, (i) => flat(box(2 + (i % 3), 0.02, 0.25, 0xe8f6ff, -150 + ((i * 97) % 300), 0.12, (((i * 53) % 100) / 100 - 0.5) * (width - 3)))),
    ], s[c].x, GROUND, s[c].z, yaw));
    for (const [x, z] of grid(4)) {
      // the water's own tiles: any whose square it reaches
      const v = (x - s[c].x) * dir.x + (z - s[c].z) * dir.z;
      if (Math.abs(v) < half + TILE / 2 + 1) blocked.add(key(x, z));
    }

    // the bridge itself, piece by piece along the stretch
    const deckAt = (i: number) => s[Math.max(from, Math.min(to, i))];
    for (let i = from; i < to; i += 2) {
      const a = s[i], b = deckAt(i + 2), slope = Math.atan2(b.y - a.y, 2);
      parts.push(place([box(water.bridge === 'beam' ? 9.4 : 10, 1.2, 2.2, water.bridge === 'suspension' ? 0xc0362c : water.bridge === 'arches' ? 0xb5533c : 0xb8bec6, 0, -0.8, 0)],
        (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, yaw, slope));
    }
    if (water.bridge === 'arches') {
      // a stone bridge: piers with cutwaters, and between them solid spandrels with arched openings over the water
      const bay = 9;
      for (let u = -Math.floor((c - from) / bay) * bay; c + u + bay <= to; u += bay) {
        const mid = s[Math.round(c + u + bay / 2)], h = mid.y - 1.3 - GROUND, arch = Math.min(bay / 2 - 1.3, h - 0.6);
        // a dark half-disc for the opening (its lower half under the water) and a ring of lighter stone round it, on both faces
        parts.push(place([
          box(9.6, h, bay, 0xb5533c, 0, h / 2, 0),
          ...[-1, 1].flatMap((k) => [turn(cyl(arch, arch, 0.1, 0x2a1f1c, k * 4.84, 0, 0, 20), 0, 0, Math.PI / 2), turn(torus(arch + 0.35, 0.4, 0xc96a4f, k * 4.86, 0, 0), 0, Math.PI / 2)]),
        ], mid.x, GROUND, mid.z, yaw));
        const pier = s[Math.round(c + u)];
        if (Math.abs(u) <= half + 1) {
          const ph = pier.y - 1.3 - GROUND;
          parts.push(place([turn(wedge(2.6, 2, ph, 0xa04a35, 5.8, ph / 2, 0), Math.PI / 2, 0, -Math.PI / 2), turn(wedge(2.6, 2, ph, 0xa04a35, -5.8, ph / 2, 0), Math.PI / 2, 0, Math.PI / 2)],
            pier.x, GROUND, pier.z, yaw));
        }
      }
    } else if (water.bridge === 'suspension') {
      // the Golden Gate: two towers astride the road, cables sagging between them and down to the ends, hangers to the deck
      const T = Math.max(6, Math.min(30, (to - from) * 0.3)), top = 16, ends = [from, to];
      const towers = [Math.round(c - T), Math.round(c + T)];
      for (const i of towers) {
        const p = s[i], h = p.y + top - GROUND;
        parts.push(place([
          box(16, 1.5, 4.4, 0x9aa3ad, 0, 0.75, 0),
          ...[-1, 1].map((k) => box(1.3, h, 1.7, 0xc0362c, k * 6.4, h / 2, 0, 0.1)),
          ...[8, 12, 15.6].map((y) => box(14.2, 1.0, 1.4, 0xc0362c, 0, p.y - GROUND + y, 0)),
        ], p.x, GROUND, p.z, yaw));
      }
      // the cable's height above the road along the bridge: down to the ends straight, and a sag between the towers
      const cable = (i: number) => {
        const u = i - c, end = i < c ? from : to, tower = i < c ? towers[0] : towers[1];
        if (Math.abs(u) <= T) return 3.5 + (top - 3.5) * (u / T) ** 2;
        return 1 + ((top - 1) * (end - i)) / (end - tower);
      };
      const point = (i: number, k: number): Vec => { const p = s[i], r = right(p.dx, p.dz); return [p.x + r.x * k * 6, p.y + cable(i), p.z + r.z * k * 6]; };
      for (const k of [-1, 1]) {
        const knots = [ends[0], ...many(9, (j) => Math.round(towers[0] + ((towers[1] - towers[0]) * j) / 8)), ends[1]];
        for (let j = 0; j + 1 < knots.length; j++) parts.push(rod(point(knots[j], k), point(knots[j + 1], k), 0.18, 0xc0362c));
        for (let i = from + 2; i <= to - 2; i += 3) {
          if (towers.some((t) => Math.abs(t - i) < 2)) continue;
          const [x, y, z] = point(i, k);
          parts.push(rod([x, s[i].y + 0.9, z], [x, y, z], 0.04, 0xc0362c));
        }
      }
    } else {
      // a plain bridge: a concrete deck on pairs of columns
      for (let u = -Math.floor((to - c) / 10) * 10; c + u <= to; u += 10) {
        const p = s[Math.round(c + u)], h = p.y - 1.2 - GROUND;
        if (Math.abs(u) > half + 6) continue;
        parts.push(place([...[-1, 1].map((k) => cyl(0.45, 0.5, h, 0xb8bec6, k * 3, h / 2, 0, 10)), box(8.4, 0.6, 1.4, 0xa9b0b9, 0, h - 0.3, 0)], p.x, GROUND, p.z, yaw));
      }
    }
    if (water.gate) {
      // the bridge gate: two towers with slate helmets, and an arch over the road to drive through
      const p = s[from + 2], h = p.y + 9 - GROUND;
      parts.push(place([
        ...[-1, 1].flatMap((k) => [cyl(1.6, 1.7, h, 0xf4f1ea, k * 7.2, h / 2, 0), cone(1.9, 4.5, 0x3d4250, k * 7.2, h + 2.25, 0), ball(0.22, 0xd4a537, k * 7.2, h + 4.7, 0),
          ...many(3, (j) => box(0.12, 0.9, 0.5, 0x2a2a2a, k * 8.75, h - 2 - j * 2.4, 0))]),
        box(15.6, 2.6, 3.2, 0xb5533c, 0, p.y - GROUND + 7.4, 0), box(15.6, 0.4, 3.6, 0x8f3f2d, 0, p.y - GROUND + 8.9, 0),
      ], p.x, GROUND, p.z, yaw));
    }
    if (water.piers) {
      // wooden piers out into the water from the near bank, clear of the road; a shed on some, sea lions on one
      let n = 0;
      for (let u = -200; u <= 200 && n < 6; u += 22) {
        const reach = Math.min(14, width * 0.45), mid = at(u, -half + reach / 2);
        if (!clearOfRoad(mid.x, mid.z, reach / 2 + 9)) continue;
        if (Math.abs(mid.x - (Math.min(...tx) + Math.max(...tx)) / 2) > (Math.max(...tx) - Math.min(...tx)) / 2 + 2 * TILE) continue;
        if (Math.abs(mid.z - (Math.min(...tz) + Math.max(...tz)) / 2) > (Math.max(...tz) - Math.min(...tz)) / 2 + 2 * TILE) continue;
        parts.push(place([
          box(5, 0.4, reach, 0x9b6b3d, 0, 1.6, 0), ...[-2.2, 2.2].flatMap((x) => many(Math.ceil(reach / 3), (j) => cyl(0.22, 0.22, 2.2, 0x6b4a2b, x, 0.6, -reach / 2 + 1 + j * 3, 6))),
          ...(n % 2 === 0 ? [box(3.6, 2.6, 4.4, 0xd9c8a0, 0, 3.1, reach / 2 - 3), turn(wedge(4.2, 1.4, 4.8, 0x8f3f2d, 0, 5.1, reach / 2 - 3), 0, Math.PI / 2), sign(3, 0.6, 0.1, `PIER ${39 + n * 2}`, 0x1b3f8f, 0xffffff, 0, 3.6, reach / 2 - 0.76)] : []),
          ...(n === 1 ? [flat(box(4, 0.3, 3, 0x8a6a4a, 4.6, 0.2, 0)), ...[[4, -0.6], [5.2, 0.5], [4.4, 0.9]].map(([x, z]) => sized(ball(0.7, 0x6b4a2b, x, 0.7, z), 1.6, 0.6, 0.8))] : []),
        ], mid.x, GROUND, mid.z, yaw));
        for (const [x, z] of grid(2)) if ((x - mid.x) ** 2 + (z - mid.z) ** 2 < (reach / 2 + TILE) ** 2) blocked.add(key(x, z));
        n++;
      }
    }
    if (water.hills) {
      // hills along the far bank, rolling away from the water, clear of the road
      let n = 0;
      for (let u = -160; u <= 160 && n < 5; u += 28) {
        const r = 12 + ((Math.abs(u) * 7) % 9), h = at(u, half + r * 0.55);
        if (!clearOfRoad(h.x, h.z, r + HALF_WIDTH + 3)) continue;
        if (Math.abs(h.x - (Math.min(...tx) + Math.max(...tx)) / 2) > (Math.max(...tx) - Math.min(...tx)) / 2 + 4 * TILE) continue;
        if (Math.abs(h.z - (Math.min(...tz) + Math.max(...tz)) / 2) > (Math.max(...tz) - Math.min(...tz)) / 2 + 4 * TILE) continue;
        parts.push(place([sized(dome(r, water.hills, 0, 0, 0), 1, 0.42, 0.8), ...many(3, (j) => ball(1.4 + j * 0.3, 0x5a8a3a, (j - 1) * r * 0.3, r * 0.38 - j * 0.4, (j % 2) * 2))], h.x, GROUND, h.z, yaw + u * 0.01));
        for (const [x, z] of grid(4)) if ((x - h.x) ** 2 + (z - h.z) ** 2 < (r + TILE / 2) ** 2) blocked.add(key(x, z));
        n++;
      }
    }
  }

  // the big landmarks, each over a block of free tiles beside the road (smaller and scaled down if none is free)
  const free = (x: number, z: number) => !road.has(key(x, z)) && !blocked.has(key(x, z));
  const beside = (x: number, z: number) => [[TILE, 0], [-TILE, 0], [0, TILE], [0, -TILE]].find(([dx, dz]) => road.has(key(x + dx, z + dz)));
  for (const [kind, size] of theme.big ?? []) {
    for (let n = size; n >= 2; n--) {
      const blocks = grid(4).filter(([x, z]) => {
        const tiles = many(n, (i) => many(n, (j) => [[x + i * TILE, z + j * TILE]])) as [number, number][];
        return tiles.every(([a, b]) => free(a, b)) && tiles.some(([a, b]) => beside(a, b));
      });
      if (!blocks.length) continue;
      const [x, z] = blocks[Math.floor(random() * blocks.length)], mx = x + ((n - 1) * TILE) / 2, mz = z + ((n - 1) * TILE) / 2;
      // facing the road beside it: the nearest road tile, straight across
      let best = [0, 1], d = Infinity;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const t = beside(x + i * TILE, z + j * TILE);
        if (!t) continue;
        const ax = x + i * TILE + t[0] - mx, az = z + j * TILE + t[1] - mz, dd = ax * ax + az * az;
        if (dd < d) { d = dd; best = Math.abs(ax) > Math.abs(az) ? [Math.sign(ax), 0] : [0, Math.sign(az)]; }
      }
      out.landmarks.push({ kind, x: mx, z: mz, yaw: r2(Math.atan2(best[0], best[1])), ...(n < size ? { scale: r2(n / size) } : {}) });
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) blocked.add(key(x + i * TILE, z + j * TILE));
      break;
    }
  }
  // then the others, each in a free tile beside the road, facing it
  const spots = grid(2).filter(([x, z]) => free(x, z) && beside(x, z));
  for (const kind of theme.landmarks) {
    if (!spots.length) break;
    const [x, z] = spots.splice(Math.floor(random() * spots.length), 1)[0], [dx, dz] = beside(x, z)!;
    out.landmarks.push({ kind, x, z, yaw: r2(Math.atan2(dx, dz)) });
    blocked.add(key(x, z));
  }
  out.blocked = [...blocked].map((k) => k.split(',').map(Number) as [number, number]).filter(([x, z]) => !road.has(key(x, z)));
  return out;
}
