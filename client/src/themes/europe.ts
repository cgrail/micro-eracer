import { figure, lamp, vehicle, wheels } from './common.ts';
import { type Paint, type PropData, type ThemeData, ball, box, cone, cyl, dome, flat, grp, lit, many, pyramid, scatter, sign, sized, spin, torus, turn } from './kit.ts';
import { cobbles } from './rhine-neckar.ts';

// Big cities of Europe: London, Paris and a grubby Berlin with its Döner.

const RED = 0xd52b1e, IRON = 0x7a5c43, SAND = 0xe3d4b2;
type R = [number, number, number, number];

/** Paving slabs in a grid, a few of them a shade darker. */
const slabs = (base: number, joint: number, dark: number, size = 64): Paint[] => [
  { fill: base }, ...[[1, 0], [3, 1], [0, 2], [2, 3]].map(([i, j]) => ({ rect: [i * size, j * size, size, size] as R, c: dark })),
  ...many(256 / size, (i) => [{ rect: [i * size, 0, 2, 256] as R, c: joint }, { rect: [0, i * size, 256, 2] as R, c: joint }]),
];

/** A leg of a tower leaning in towards its middle from the corner (sx, sz). */
const leg = (sx: number, sz: number, x: number, y: number, h: number, lean: number, c: number) =>
  turn(cyl(0.35, 0.7, h, c, sx * x, y, sz * x, 4), -sz * lean, 0, sx * lean);

export const props: Record<string, PropData> = {
  // London
  'ld-booth': {
    parts: [box(1.8, 0.3, 1.8, 0x9aa0a6, 0, 0.15, 0), box(1.5, 3.4, 1.5, RED, 0, 2, 0, 0.08), dome(0.75, RED, 0, 3.7, 0), box(1.6, 0.2, 1.6, RED, 0, 3.75, 0),
      ...[0, 1, 2, 3].map((i) => spin(grp([...many(3, (j) => box(0.9, 0.42, 0.05, 0xd9eef7, 0, 1.4 + j * 0.55, 0.77)), flat(sign(1.0, 0.24, 0.04, 'TELEPHONE', 0x1a1a1a, 0xffffff, 0, 3.3, 0.77))]), (i * Math.PI) / 2))],
  },
  'ld-postbox': { parts: [cyl(0.7, 0.7, 0.25, 0x1a1a1a, 0, 0.12, 0), cyl(0.6, 0.6, 2.2, RED, 0, 1.35, 0), dome(0.65, RED, 0, 2.45, 0), box(0.6, 0.1, 0.1, 0x1a1a1a, 0, 2.0, 0.6), flat(box(0.4, 0.3, 0.05, 0xffd60a, 0, 1.6, 0.6))] },
  'ld-cab': { parts: [...vehicle(4.4, 2, 2, 0x1a1a1a), lit(box(0.8, 0.3, 0.4, 0xffb000, 0, 2.6, 0))] },
  'ld-lamp': { parts: [...lamp(5, 0x1a1a1a, 0xffe3a3), cyl(0.3, 0.2, 0.6, 0x1a1a1a, 0, 0.3, 0, 8)] },
  'ld-guard': {
    parts: [box(1.8, 3.8, 1.6, 0xe8e4da, 0, 1.9, -0.6), pyramid(2.1, 1.0, 1.9, 0x3d4250, 0, 4.3, -0.6), box(1.3, 2.8, 0.1, 0x2a2a2a, 0, 1.6, 0.21),
      ...figure(0xc8102e, 0xffd2b0, 0x1a1a1a, 2.4).map((p) => grp([p], 0, 0, 0.9)), cyl(0.36, 0.33, 0.9, 0x111111, 0, 2.75, 0.9, 12), dome(0.36, 0x111111, 0, 3.2, 0.9)],
  },
  'ld-bigben': {
    parts: [box(5, 1, 5, 0x9aa0a6, 0, 0.5, 0), box(4, 14, 4, 0xc9a96e, 0, 7.5, 0), ...many(4, (i) => spin(grp([...many(4, (j) => box(0.5, 2, 0.1, 0x6b5536, -1 + (j % 2) * 2, 4 + j * 2.6, 2.03))]), (i * Math.PI) / 2)),
      box(4.6, 3.4, 4.6, 0xb8955a, 0, 16.2, 0), ...many(4, (i) => spin(grp([turn(cyl(1.55, 1.55, 0.1, 0xfff8e7, 0, 16.2, 2.33), Math.PI / 2), box(0.12, 1.1, 0.1, 0x111111, 0, 16.6, 2.4), turn(box(0.12, 0.8, 0.1, 0x111111, 0.25, 16.0, 2.4), 0, 0, 1.0)]), (i * Math.PI) / 2)),
      box(4, 2.6, 4, 0xc9a96e, 0, 19.2, 0), pyramid(4.4, 6, 4.4, 0x3d4250, 0, 23.5, 0), cone(0.25, 2, 0xd4af37, 0, 27.5, 0, 6), ...[-1.9, 1.9].flatMap((x) => [-1.9, 1.9].map((z) => cone(0.35, 2, 0xc9a96e, x, 21.5, z, 6)))],
  },
  'ld-bus': {
    parts: [...wheels(9, 2.5, 0.55), box(2.6, 4.2, 10, RED, 0, 2.6, 0, 0.35), ...[1.8, 3.6].flatMap((y) => [-1, 1].flatMap((s) => many(5, (i) => box(0.05, 0.9, 1.5, 0xbfe6ff, s * 1.32, y, -3.6 + i * 1.8)))),
      box(2.2, 0.9, 0.05, 0xbfe6ff, 0, 3.6, 5.02), box(2.2, 1.0, 0.05, 0xbfe6ff, 0, 2.0, 5.02), flat(sign(1.8, 0.4, 0.05, 'PICCADILLY', 0x111111, 0xffd60a, 0, 4.4, 5.02)), box(2.6, 0.3, 10, 0xf2f2f2, 0, 4.75, 0, 0.1)],
  },
  'ld-eye': {
    parts: [box(9, 0.5, 4, 0xd8dde4, 0, 0.25, 0), torus(6, 0.22, 0xf2f4f7, 0, 7.4, 0), torus(5.7, 0.08, 0xd8dde4, 0, 7.4, 0), ball(0.7, 0xd8dde4, 0, 7.4, 0),
      ...many(8, (i) => turn(box(0.1, 11.6, 0.1, 0xd8dde4, 0, 7.4, 0), 0, 0, (i * Math.PI) / 8)),
      ...many(16, (i) => sized(ball(0.45, i % 4 ? 0xbfe6ff : 0xd52b1e, Math.cos((i * Math.PI) / 8) * 6.2, 7.4 + Math.sin((i * Math.PI) / 8) * 6.2, 0.35), 1, 0.7, 1.4)),
      ...[-1, 1].map((s) => turn(box(0.5, 8.2, 0.5, 0xf2f4f7, s * 1.8, 3.7, -1.3), 0.15, 0, s * 0.22)), box(0.3, 0.3, 2.6, 0xf2f4f7, 0, 7.4, -1.2)],
  },

  // Paris
  'pa-cafe': {
    pick: [0xc0392b, 0x1b3f8f, 0x2a9d58],
    parts: [cyl(0.9, 0.9, 0.1, 0xf2f2f2, 0, 1.4, 0), cyl(0.07, 0.07, 1.4, 0x222222, 0, 0.7, 0, 6), cyl(0.5, 0.5, 0.06, 0x222222, 0, 0.03, 0, 10),
      ...[-1.4, 1.4].map((x) => grp([box(0.9, 0.1, 0.9, 0xc8a165, 0, 0.9, 0), box(0.1, 1, 0.9, 0xc8a165, x > 0 ? 0.42 : -0.42, 1.4, 0), ...[-0.35, 0.35].flatMap((a) => [-0.35, 0.35].map((b) => cyl(0.04, 0.04, 0.9, 0x222222, a, 0.45, b, 6)))], x, 0, 0)),
      cyl(0.06, 0.06, 2.6, 0x222222, 0, 2.6, 0, 6), cone(2.2, 0.9, 'pick', 0, 3.9, 0, 8), cyl(0.15, 0.2, 0.3, 0xffffff, 0.3, 1.6, 0.2, 8)],
  },
  'pa-baguette': { parts: [cyl(1.0, 0.8, 1.2, 0xb08158, 0, 0.6, 0, 12), ...[[0.2, 0.1, 0.15], [-0.25, -0.15, -0.1], [0, 0.3, 0.3], [0.3, -0.25, -0.2]].map(([x, z, t]) => turn(cyl(0.22, 0.22, 3.4, 0xd9a441, x, 2.0, z, 8), t, 0, -t))] },
  'pa-croissant': { parts: [...many(5, (i) => { const a = -0.9 + i * 0.45; return sized(ball(0.55 + (i === 2 ? 0.2 : i % 2 ? 0.1 : -0.1), 0xd99a3d, Math.sin(a) * 1.3, 0.5, Math.cos(a) * 1.3 - 1.0), 1, 0.75, 1); }), flat(cyl(1.8, 1.8, 0.06, 0xffffff, 0, 0.03, -0.4, 20))] },
  'pa-lamp': { parts: [cyl(0.35, 0.45, 0.8, 0x2f4a3a, 0, 0.4, 0, 8), cyl(0.1, 0.15, 4.2, 0x2f4a3a, 0, 2.8, 0, 8), box(1.6, 0.12, 0.12, 0x2f4a3a, 0, 4.5, 0), ...[-0.8, 0.8].map((x) => grp([lit(box(0.4, 0.55, 0.4, 0xffe3a3, 0, -0.35, 0)), pyramid(0.6, 0.4, 0.6, 0x2f4a3a, 0, 0.12, 0)], x, 4.5, 0))] },
  'pa-flowers': { pick: [0xff6fb5, 0xe63946, 0xffd60a], parts: [box(3.2, 0.9, 1.2, 0x2f4a3a, 0, 0.45, 0, 0.1), ...many(7, (i) => ball(0.38, i % 2 ? 'pick' : 0x5aa64a, -1.35 + i * 0.45, 1.1 + (i % 3) * 0.1, (i % 2) * 0.2 - 0.1))] },
  'pa-easel': { parts: [...[-0.6, 0.6].map((x) => turn(box(0.12, 3.6, 0.12, 0x8a5a33, x, 1.8, 0), 0, 0, x > 0 ? 0.12 : -0.12)), turn(box(0.12, 3.4, 0.12, 0x8a5a33, 0, 1.7, -0.6), -0.25), box(1.8, 1.4, 0.08, 0xfffaf0, 0, 2.6, 0.1),
    flat(box(1.5, 0.5, 0.02, 0x7fb2cf, 0, 2.95, 0.15)), flat(pyramid(0.6, 0.9, 0.02, 0x7a5c43, 0, 2.5, 0.16)), box(1.6, 0.1, 0.3, 0x8a5a33, 0, 1.85, 0.15)] },
  'pa-eiffel': {
    parts: [
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => leg(sx, sz, 3.6, 3.2, 6.8, 0.26, IRON))), box(8.2, 0.7, 8.2, IRON, 0, 6.4, 0),
      ...[0, Math.PI / 2].map((a) => spin(grp([torus(2.9, 0.3, IRON, 0, 2.3, 4.0)]), a)), ...[0, Math.PI / 2].map((a) => spin(grp([torus(2.9, 0.3, IRON, 0, 2.3, -4.0)]), a)),
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => turn(cyl(0.25, 0.45, 6.8, IRON, sx * 2.3, 9.9, sz * 2.3, 4), -sz * 0.18, 0, sx * 0.18))), box(4.4, 0.5, 4.4, IRON, 0, 13.2, 0),
      cyl(0.35, 1.4, 9, IRON, 0, 17.9, 0, 4), box(1.6, 0.4, 1.6, IRON, 0, 22.4, 0), cyl(0.12, 0.25, 3, IRON, 0, 24.1, 0, 6), lit(ball(0.2, 0xffd60a, 0, 25.6, 0)),
    ],
  },
  'pa-arc': {
    parts: [box(9, 7.5, 4.4, SAND, 0, 3.75, 0), box(3.2, 4.6, 4.6, 0x2a2420, 0, 2.3, 0), dome(1.6, 0x2a2420, 0, 4.6, 0), box(9, 0.4, 0.2, 0xcab88f, 0, 5.6, 2.25), box(9.6, 1.3, 5, SAND, 0, 8.15, 0),
      // the side arches run across, through both piers
      box(9.2, 2.6, 1.2, 0x2a2420, 0, 1.3, 0),
      ...[-3.1, 3.1].map((x) => box(1.6, 2.2, 0.15, 0xcab88f, x, 4.6, 2.25)), flat(box(10.5, 0.1, 6, 0x9aa0a6, 0, 0.05, 0))],
  },
  'pa-louvre': {
    parts: [flat(box(10, 0.3, 10, 0xd8d0bf, 0, 0.15, 0)), flat(box(9, 0.32, 9, 0x7fb2cf, 0, 0.16, 0)), box(7.2, 0.6, 7.2, 0xd8d0bf, 0, 0.3, 0), pyramid(7, 5.4, 7, 0xa9d8ee, 0, 3.3, 0),
      ...many(4, (i) => spin(grp([turn(box(0.08, 6.4, 0.08, 0x5b6470, 0, 3.3, 1.75), -0.57)]), (i * Math.PI) / 2)), ...many(4, (i) => spin(pyramid(1.6, 1.2, 1.6, 0xa9d8ee, 0, 0.9, 4.6), (i * Math.PI) / 2 + Math.PI / 4))],
  },

  // Berlin
  'be-doner': {
    parts: [box(2.6, 0.2, 2.2, 0x9aa3ad, 0, 1.4, 0), box(2.6, 1.4, 2.2, 0x6d7178, 0, 0.7, 0), cyl(0.08, 0.08, 4.2, 0xd8dde4, 0, 3.4, 0, 6), cyl(0.8, 1.15, 2.6, 0x9c5a2e, 0, 3.0, 0, 12),
      ...many(4, (i) => flat(cyl(1.0 - i * 0.07, 1.04 - i * 0.07, 0.12, 0x7a4220, 0, 2.0 + i * 0.6, 0, 12))), box(2.2, 3.2, 0.3, 0xc9ced6, 0, 3.0, -1.2), lit(box(1.6, 2.4, 0.1, 0xff7b29, 0, 3.0, -1.02)), cone(0.4, 0.4, 0xd8dde4, 0, 5.5, 0, 6)],
  },
  'be-kebab': {
    // a Döner in its bread: a half-moon, round side down, the filling spilling out of the top
    parts: [flat(cyl(1.7, 1.7, 0.06, 0xffffff, 0, 0.03, 0, 16)), turn(sized(dome(1.4, 0xe0b46a, 0, 1.5, 0), 1, 1, 0.45), 0, 0, Math.PI),
      ...[[-0.8, 1.6, 0x5aa64a], [-0.3, 1.75, 0x9c5a2e], [0.2, 1.65, 0xe63946], [0.6, 1.8, 0x9c5a2e], [0.95, 1.55, 0x5aa64a], [0, 1.95, 0xffffff], [-0.6, 1.85, 0x8e44ad]]
        .map(([x, y, c]) => ball(0.3, c, x, y, 0))],
  },
  'be-bottles': { parts: [...[[0, 0], [0.8, 0.3], [-0.7, 0.4]].map(([x, z], i) => grp([cyl(0.35, 0.35, 1.5, i === 1 ? 0x2a7a3a : 0x6b3d17, 0, 0.75, 0, 10), cyl(0.12, 0.3, 0.6, i === 1 ? 0x2a7a3a : 0x6b3d17, 0, 1.8, 0, 10), box(0.5, 0.5, 0.05, 0xf2f2f2, 0, 0.8, 0.34)], x, 0, z)),
    grp([turn(grp([cyl(0.35, 0.35, 1.5, 0x6b3d17, 0, 0, 0, 10), cyl(0.12, 0.3, 0.6, 0x6b3d17, 0, 1.05, 0, 10)]), Math.PI / 2)], 0.6, 0.35, 1.3)] },
  'be-trash': { parts: [sized(ball(1.0, 0x1a1a1a, 0, 0.8, 0), 1, 0.85, 1), sized(ball(0.85, 0x222222, 1.2, 0.6, 0.4), 1, 0.8, 1), sized(ball(0.7, 0x1a1a1a, 0.4, 1.5, 0.2), 1, 0.9, 1), cone(0.15, 0.4, 0x1a1a1a, 0.4, 2.2, 0.2, 6),
    turn(cyl(0.3, 0.3, 0.9, 0xc0392b, -1.1, 0.3, 0.8, 10), Math.PI / 2, 0, 0.6), box(1.2, 0.6, 0.9, 0xd9b382, -0.9, 0.3, -0.9)] },
  'be-barrier': { parts: [...[-1.6, 1.6].map((x) => grp([box(0.9, 0.15, 0.9, 0x222222, 0, 0.08, 0), box(0.12, 1.4, 0.12, 0xeeeeee, 0, 0.8, 0)], x, 0, 0)), box(3.6, 0.45, 0.1, 0xffffff, 0, 1.2, 0), ...many(4, (i) => flat(box(0.45, 0.45, 0.12, 0xe63946, -1.35 + i * 0.9, 1.2, 0))), lit(ball(0.15, 0xffb000, -1.6, 1.6, 0)), cone(0.5, 1.0, 0xff6b1a, 0.8, 0.5, 1.2)] },
  'be-ampel': { parts: [cyl(0.12, 0.15, 4.6, 0x2f3a3a, 0, 2.3, 0, 8), box(0.8, 1.7, 0.6, 0x1a1a1a, 0, 4.0, 0.2), lit(box(0.25, 0.5, 0.05, 0xff3b3b, 0, 4.45, 0.52)), lit(box(0.3, 0.55, 0.05, 0x39e46b, 0, 3.6, 0.52)), box(0.06, 0.06, 0.06, 0x1a1a1a, 0, 3.95, 0.55), box(0.7, 0.9, 0.3, 0xf2c230, 0, 1.4, 0.2)] },
  'be-tower': {
    parts: [cyl(2.4, 3.0, 2.4, 0xd5d8dc, 0, 1.2, 0), cyl(1.0, 1.4, 20, 0xd5d8dc, 0, 12.4, 0), ball(2.8, 0xb9c0c8, 0, 23.6, 0), turn(torus(2.85, 0.35, 0x5b6470, 0, 23.6, 0), Math.PI / 2), ...many(8, (i) => lit(sized(ball(0.3, 0xffe3a3, Math.cos(i * 0.785) * 2.8, 23.6, Math.sin(i * 0.785) * 2.8), 1, 0.8, 1))),
      cyl(0.5, 0.7, 2, 0xd5d8dc, 0, 27.2, 0), ...many(4, (i) => cyl(0.25 - i * 0.03, 0.28 - i * 0.03, 1.6, i % 2 ? 0xffffff : 0xe63946, 0, 29 + i * 1.6, 0, 8))],
  },
  'be-imbiss': {
    parts: [box(7, 4, 4.4, 0xf2c230, 0, 2, -0.8), box(7.4, 0.5, 6.4, 0xc0392b, 0, 4.25, 0), sign(6, 1.5, 0.3, 'DÖNER', 0xc0392b, 0xffffff, 0, 5.3, 1.2), box(5, 1.8, 0.2, 0x2a2420, 0, 2.5, 1.43), lit(box(4.6, 1.4, 0.05, 0xffb36b, 0, 2.5, 1.55)),
      cyl(0.45, 0.65, 1.4, 0x9c5a2e, -1.4, 2.4, 1.0, 10), box(7, 1.2, 0.8, 0xd8dde4, 0, 0.6, 2.0), ...[0, 1, 2].map((i) => grp([cyl(0.6, 0.6, 0.08, 0xffffff, 0, 1.3, 0, 12), cyl(0.08, 0.08, 1.3, 0x9aa3ad, 0, 0.65, 0, 6)], -2.5 + i * 2.5, 0, 3.6)),
      flat(box(1.2, 0.8, 0.05, 0xff2bd6, 2.8, 3.2, 1.42)), flat(box(0.9, 0.6, 0.05, 0x00b4d8, -2.9, 3.3, 1.42))],
  },
  'be-gate': {
    parts: [box(11, 0.8, 3.6, 0xc9b994, 0, 0.4, 0), ...many(6, (i) => cyl(0.4, 0.45, 6, 0xe3d4b2, -4.5 + i * 1.8, 3.8, 1.1, 10)), ...many(6, (i) => cyl(0.4, 0.45, 6, 0xe3d4b2, -4.5 + i * 1.8, 3.8, -1.1, 10)),
      box(11.4, 1.6, 3.8, SAND, 0, 7.6, 0), box(5, 1.4, 3, SAND, 0, 9.1, 0), box(1.6, 1.0, 0.8, 0x5e8f6b, 0, 10.3, 0), ...many(4, (i) => grp([box(0.4, 0.9, 1.3, 0x5e8f6b, 0, 0.45, 0), sized(ball(0.3, 0x5e8f6b, 0, 1.1, 0.5), 1, 1.3, 1)], -0.9 + i * 0.6, 9.8, 0.9))],
  },
  'be-spaeti': {
    parts: [box(7, 4.2, 5, 0x7d8187, 0, 2.1, -0.5), ...[[0xff2bd6, -2.6, 1.4], [0x00b4d8, -0.4, 0.8], [0x9cff57, 2.0, 1.9], [0xffd60a, -1.5, 3.2]].map(([c, x, y]) => flat(turn(box(1.8, 1.0, 0.05, c, x, y, 2.03), 0, 0, (x % 2) * 0.2))),
      ...[-1, 1].map((s) => flat(box(0.05, 1.4, 2.2, [0xff2bd6, 0x00b4d8][s > 0 ? 1 : 0], s * 3.53, 2.4, -0.5))), sign(4.6, 1.1, 0.3, 'SPÄTI', 0x1a1a1a, 0xffd60a, 0, 3.6, 2.1), lit(box(2.4, 1.6, 0.05, 0xfff3b0, 1.6, 1.6, 2.06)),
      box(1.1, 2.4, 0.06, 0x3a2a24, -1.6, 1.2, 2.04), ...[0, 1].map((i) => box(1.4, 0.9, 1.0, 0x2a7a3a, -2.6 + i * 0.3, 0.45 + i * 0.9, 3.0, 0.05)), ...many(4, (i) => cyl(0.15, 0.15, 0.6, 0x6b3d17, -3 + i * 0.3, 1.1 + 0.9 + 0.3, 3.0, 8))],
  },
};

export const themes: Record<'london' | 'paris' | 'berlin', ThemeData> = {
  london: {
    title: 'London', sky: [0xaeb6c2, 0xd9dde3], puddle: 0x8fa9c4,
    ground: slabs(0x9ba1a8, 0x80868d, 0x91979e),
    props: ['ld-booth', 'ld-postbox', 'ld-cab', 'ld-lamp', 'ld-guard', 'ld-lamp'], landmarks: ['ld-bigben', 'ld-bus', 'ld-eye'],
  },
  paris: {
    title: 'Paris', sky: [0x9fd0f5, 0xffe4ec], puddle: 0x7b1e3a,
    ground: cobbles(0xbba77f, [0xd8c7a6, 0xcfbc98, 0xe0d1b2, 0xc9b590]),
    props: ['pa-cafe', 'pa-cafe', 'pa-baguette', 'pa-croissant', 'pa-lamp', 'pa-flowers', 'pa-easel'], landmarks: ['pa-eiffel', 'pa-arc', 'pa-louvre'],
  },
  berlin: {
    title: 'Dirty Berlin', sky: [0x9aa7b8, 0xd5dbe3], puddle: 0xd9a23b,
    ground: [...slabs(0x8f9399, 0x74787e, 0x868a90), ...scatter(16, 97, 57, (x, y, i) => (i % 3 ? [{ dot: [x, y, 3], c: 0x6b6f75 }] : [{ rect: [x, y, 8, 3], c: 0xe8e4da }, { rect: [x + 6, y, 2, 3], c: 0xd98c3a }])),
      ...scatter(4, 71, 181, (x, y) => [{ line: [x, y, x + 14, y + 9], c: 0x6b6f75, w: 2 }, { line: [x + 14, y + 9, x + 22, y + 6], c: 0x6b6f75, w: 2 }])],
    props: ['be-doner', 'be-kebab', 'be-bottles', 'be-trash', 'be-barrier', 'be-ampel', 'be-trash'], landmarks: ['be-tower', 'be-imbiss', 'be-gate', 'be-spaeti'],
  },
};

