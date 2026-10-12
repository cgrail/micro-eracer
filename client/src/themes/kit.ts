// Scenery as data: the props and ground of a theme written once, here, as plain numbers. The browsers build them in
// props.ts; the apps read the same data from ios/Shared/Resources/Themes.json (written by `npx tsx ios/themes.ts`) and build
// them in ThemeData.swift. Lengths in metres; colours as 0xrrggbb; a prop's front faces +z.

export type Vec = [number, number, number];
/** A colour, or 'pick': the one colour picked at random for the whole prop from its `pick` list. */
export type Color = number | 'pick';

interface Place { at?: Vec; rot?: Vec; scale?: Vec }
interface Look extends Place {
  c: Color;
  /** No black outline. */
  flat?: true;
  /** Unlit and never outlined: screens, neon, lamps. */
  glow?: true;
}
export type Part =
  /** A box, its edges rounded by `r` (0: sharp). */
  | (Look & { box: Vec; r?: number })
  /** A cylinder along y, `[radius at the top, radius at the bottom, height]`; a top radius of 0 is a cone. */
  | (Look & { cyl: Vec; seg?: number })
  | (Look & { ball: number })
  /** The top half of a ball, standing on its flat side. */
  | (Look & { dome: number })
  /** A ring `[radius, tube]` standing upright in the xy plane, like a wheel facing +z. */
  | (Look & { torus: [number, number] })
  /** A roof: triangles of base `w` and height `h` (in the xy plane) drawn out `d` along z. */
  | (Look & { wedge: Vec })
  /** A pyramid on a `w` × `d` base, `h` tall. */
  | (Look & { pyramid: Vec })
  /** A board in the colour `c` with comic lettering in `ink` on its faces. */
  | (Look & { sign: Vec; text: string; ink: number })
  | (Place & { parts: Part[] });

export interface PropData {
  /** Colours to pick one from per prop, for the parts coloured 'pick'. */
  pick?: number[];
  parts: Part[];
}

/** A ground texture: drawing operations on a 256 × 256 tile, which repeats every 17 m. */
export type Paint =
  | { fill: number }
  | { rect: [number, number, number, number]; c: number }
  /** A line from (x1, y1) to (x2, y2), `w` wide, with round ends. */
  | { line: [number, number, number, number]; c: number; w: number }
  | { dot: [number, number, number]; c: number }
  | { ring: [number, number, number]; c: number; w: number }
  /** A filled polygon: x0, y0, x1, y1, … */
  | { poly: number[]; c: number };

export interface ThemeData {
  /** The place, as the start screen names it. */
  title: string;
  /** The sky's gradient, top to bottom (the fog takes the bottom colour). */
  sky: [number, number];
  ground: Paint[];
  puddle: number;
  /** Small props, one or two in each free tile. */
  props: string[];
  /** Big props, each once, in a free tile of its own beside the road, facing it. */
  landmarks: string[];
  /** Comic clouds far away, as over the garden. */
  clouds?: true;
}

const round = (v: number) => Math.round(v * 1000) / 1000;
const vec = (x: number, y: number, z: number): Vec | undefined => (x || y || z ? [round(x), round(y), round(z)] : undefined);
const at = (p: Part, x: number, y: number, z: number): Part => {
  const v = vec(x, y, z);
  return v ? { ...p, at: v } : p;
};

// the helpers take the same arguments as scene.ts's rbox, cyl and sph: sizes, colour, then where
export const box = (w: number, h: number, d: number, c: Color, x = 0, y = 0, z = 0, r = 0): Part => at(r ? { box: [w, h, d], r, c } : { box: [w, h, d], c }, x, y, z);
export const cyl = (rt: number, rb: number, h: number, c: Color, x = 0, y = 0, z = 0, seg = 16): Part => at(seg === 16 ? { cyl: [rt, rb, h], c } : { cyl: [rt, rb, h], c, seg }, x, y, z);
export const cone = (r: number, h: number, c: Color, x = 0, y = 0, z = 0, seg = 12) => cyl(0, r, h, c, x, y, z, seg);
export const ball = (r: number, c: Color, x = 0, y = 0, z = 0): Part => at({ ball: r, c }, x, y, z);
export const dome = (r: number, c: Color, x = 0, y = 0, z = 0): Part => at({ dome: r, c }, x, y, z);
export const torus = (r: number, tube: number, c: Color, x = 0, y = 0, z = 0): Part => at({ torus: [r, tube], c }, x, y, z);
export const wedge = (w: number, h: number, d: number, c: Color, x = 0, y = 0, z = 0): Part => at({ wedge: [w, h, d], c }, x, y, z);
export const pyramid = (w: number, h: number, d: number, c: Color, x = 0, y = 0, z = 0): Part => at({ pyramid: [w, h, d], c }, x, y, z);
export const sign = (w: number, h: number, d: number, text: string, c: number, ink: number, x = 0, y = 0, z = 0): Part => at({ sign: [w, h, d], text, c, ink }, x, y, z);
export const grp = (parts: Part[], x = 0, y = 0, z = 0): Part => at({ parts }, x, y, z);
/** Turned about x, then y, then z (three's default Euler order), around its own middle. */
export const turn = (p: Part, rx: number, ry = 0, rz = 0): Part => ({ ...p, rot: vec(rx, ry, rz) });
/** Turned about y after its own turn: for spreading copies round a middle (`turn` would tilt them all one way). */
export const spin = (p: Part, ry: number): Part => ({ parts: [p], rot: vec(0, ry, 0) });
export const sized = (p: Part, sx: number, sy: number, sz: number): Part => ({ ...p, scale: [round(sx), round(sy), round(sz)] });
export const flat = (p: Part): Part => ({ ...p, flat: true });
export const lit = (p: Part): Part => ({ ...p, glow: true });

/** Copies of `make(i)` for i = 0 … n − 1. */
export const many = <T>(n: number, make: (i: number) => T | T[]): T[] => [...Array(n).keys()].flatMap(make);

// --- how far a prop reaches, for keeping it inside its tile (the apps get the same number in the JSON)

type M = [number, number, number, number, number, number, number, number, number];
const mul = (a: M, b: M): M => {
  const o = new Array(9).fill(0) as M;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) o[3 * i + j] += a[3 * i + k] * b[3 * k + j];
  return o;
};
const rotation = ([x, y, z]: Vec): M => {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(x), Math.sin(x), Math.cos(y), Math.sin(y), Math.cos(z), Math.sin(z)];
  return mul(mul([1, 0, 0, 0, cx, -sx, 0, sx, cx], [cy, 0, sy, 0, 1, 0, -sy, 0, cy]), [cz, -sz, 0, sz, cz, 0, 0, 0, 1]);
};

/** Points around a part's outside, before it is placed: the corners of a box, rings round anything round. */
function corners(p: Part): Vec[] {
  // a 16-gon drawn round a circle of radius r, so the points are never inside the curve
  const ring = (r: number, at: (x: number, y: number) => Vec) => [...Array(16).keys()].map((i) => {
    const a = (i * Math.PI) / 8, R = r / Math.cos(Math.PI / 16);
    return at(R * Math.cos(a), R * Math.sin(a));
  });
  const cube = (w: number, h: number, d: number, y0 = -h / 2): Vec[] => [-w / 2, w / 2].flatMap((x) => [y0, y0 + h].flatMap((y) => [-d / 2, d / 2].map((z): Vec => [x, y, z])));
  if ('parts' in p) return [];
  if ('box' in p) return cube(...p.box);
  if ('sign' in p) return cube(...p.sign);
  if ('wedge' in p) return cube(...p.wedge);
  if ('pyramid' in p) return cube(...p.pyramid);
  if ('cyl' in p) return [...ring(p.cyl[0], (x, z) => [x, p.cyl[2] / 2, z]), ...ring(p.cyl[1], (x, z) => [x, -p.cyl[2] / 2, z])];
  if ('torus' in p) return [-1, 1].flatMap((s) => ring(p.torus[0] + p.torus[1], (x, y) => [x, y, s * p.torus[1]]));
  const r = 'ball' in p ? p.ball : p.dome, low = 'ball' in p ? -r : 0;
  return [...ring(r, (x, z) => [x, 0, z]), ...ring(r, (x, y) => [x, Math.max(low, y), 0]), ...ring(r, (y, z) => [0, Math.max(low, y), z])];
}

/** Every corner of every part, placed in the prop. */
export function points(parts: Part[], m: M = [1, 0, 0, 0, 1, 0, 0, 0, 1], t: Vec = [0, 0, 0]): Vec[] {
  return parts.flatMap((p) => {
    const s = p.scale ?? [1, 1, 1], r = rotation(p.rot ?? [0, 0, 0]), a = p.at ?? [0, 0, 0];
    const local = mul(mul(m, r), [s[0], 0, 0, 0, s[1], 0, 0, 0, s[2]]);
    const origin: Vec = [0, 1, 2].map((i) => t[i] + m[3 * i] * a[0] + m[3 * i + 1] * a[1] + m[3 * i + 2] * a[2]) as Vec;
    if ('parts' in p) return points(p.parts, local, origin);
    return corners(p).map((c) => [0, 1, 2].map((i) => origin[i] + local[3 * i] * c[0] + local[3 * i + 1] * c[1] + local[3 * i + 2] * c[2]) as Vec);
  });
}

/** Any way it's turned, the prop fits in a circle this big around its middle. */
export const reach = (prop: PropData) => round(Math.max(...points(prop.parts).map(([x, , z]) => Math.hypot(x, z))));

// --- ground helpers

/** `n` shapes spread over the tile at ((i·a) mod 256, (i·b) mod 256), copied across its edges so the tile wraps. */
export const scatter = (n: number, a: number, b: number, shape: (x: number, y: number, i: number) => Paint[], margin = 24): Paint[] =>
  [...Array(n).keys()].flatMap((i) => {
    const x = (i * a) % 256, y = (i * b) % 256;
    return [-256, 0, 256].flatMap((ox) => [-256, 0, 256].flatMap((oy) =>
      Math.abs(x + ox - 128) < 128 + margin && Math.abs(y + oy - 128) < 128 + margin ? shape(x + ox, y + oy, i) : []));
  });
