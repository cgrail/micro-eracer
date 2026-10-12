import { figure, potPlant } from './common.ts';
import {
  type Paint, type PropData, type ThemeData, ball, box, cyl, flat, grp, lit, many, scatter, sign, sized, spin, torus, turn,
} from './kit.ts';

// Offices round the world (Google, Facebook, Anthropic) and a LAN party: micro E-Cars between the desks.

const G = [0x4285f4, 0xea4335, 0xfbbc05, 0x34a853];
const FB = 0x1877f2;
const CLAY = 0xd97757, CREAM = 0xf0eee6, DARK = 0x262624;

/** Carpet tiles: a base colour, seams every `step`, and every other tile a shade darker. */
const carpet = (base: number, shade: number, seam: number, step = 64): Paint[] => [
  { fill: base },
  ...many(256 / step, (i) => many(256 / step, (j) => ((i + j) % 2 ? [{ rect: [i * step, j * step, step, step] as [number, number, number, number], c: shade }] : []))),
  ...many(256 / step, (i) => [{ rect: [i * step, 0, 2, 256] as [number, number, number, number], c: seam }, { rect: [0, i * step, 256, 2] as [number, number, number, number], c: seam }]),
].flat() as Paint[];

const desk = (screen: number, top = 0xf2f2f2, legs = 0x9aa3ad): PropData['parts'] => [
  box(3.2, 0.15, 1.6, top, 0, 1.6, 0), ...[-1.4, 1.4].map((x) => box(0.15, 1.6, 1.3, legs, x, 0.8, 0)),
  box(1.5, 0.95, 0.12, 0x2b2f36, 0, 2.3, -0.4), lit(box(1.35, 0.8, 0.05, screen, 0, 2.3, -0.33)), box(0.15, 0.4, 0.15, 0x2b2f36, 0, 1.85, -0.45),
  box(1.1, 0.06, 0.4, 0x3a3f47, 0, 1.71, 0.25),
];

export const props: Record<string, PropData> = {
  // Google
  'g-beanbag': { pick: G, parts: [sized(ball(1.8, 'pick', 0, 1.0, 0.2), 1, 0.55, 1), sized(ball(1.3, 'pick', 0, 1.5, -0.7), 1, 0.75, 0.7)] },
  'g-bike': {
    pick: G,
    parts: [
      torus(0.7, 0.09, 0x222222, -0.95, 0.75, 0), torus(0.7, 0.09, 0x222222, 0.95, 0.75, 0),
      turn(box(1.5, 0.12, 0.12, 'pick', 0, 1.25, 0), 0, 0, 0), turn(box(1.3, 0.12, 0.12, 'pick', -0.3, 1.0, 0), 0, 0, 0.75),
      turn(box(0.9, 0.12, 0.12, 'pick', 0.55, 1.0, 0), 0, 0, -1.0), box(0.12, 0.7, 0.12, 'pick', -0.55, 1.45, 0),
      box(0.5, 0.12, 0.3, 0x222222, -0.55, 1.8, 0, 0.05), box(0.12, 0.6, 0.12, 'pick', 0.85, 1.5, 0), box(0.12, 0.1, 0.9, 0x222222, 0.85, 1.8, 0),
      box(0.6, 0.35, 0.5, 0xc8a165, 1.25, 1.55, 0),
    ],
  },
  'g-plant': { parts: potPlant(3.2, G[3], 0x3d9a3d) },
  'g-balls': { parts: [turn(torus(1.9, 0.25, G[0], 0, 0.25, 0), Math.PI / 2), ...[[0, 0], [0.8, 0.5], [-0.7, 0.6], [0.5, -0.8], [-0.6, -0.6], [1.2, -0.2], [-1.2, 0], [0, 1.1], [0.1, 0.3]].map(([x, z], i) => ball(0.45, G[i % 4], x, i === 8 ? 0.95 : 0.45, z))] },
  'g-desk': { parts: [...desk(0x8ab4f8), box(0.5, 0.6, 0.5, G[1], 1.0, 1.98, 0.2, 0.15)] },

  'g-trex': {
    parts: [
      box(9, 0.6, 3, 0xb0b6be, 0, 0.3, 0, 0.1),
      // legs, hips and a spine of bones from the tail to the skull
      ...[-0.7, 0.7].flatMap((z) => [turn(cyl(0.35, 0.5, 2.4, 0xf5f0e6, -0.6, 2.4, z, 8), 0, 0, -0.35), turn(cyl(0.25, 0.3, 2, 0xf5f0e6, -0.3, 1.05, z, 8), 0, 0, 0.3), box(1, 0.2, 0.5, 0xf5f0e6, 0, 0.7, z)]),
      ball(0.8, 0xf5f0e6, -0.8, 3.4, 0),
      ...[[-4.4, 2.0, 0.22], [-3.6, 2.4, 0.28], [-2.8, 2.8, 0.34], [-2, 3.1, 0.4], [-1.2, 3.4, 0.45], [-0.4, 3.6, 0.45], [0.4, 3.7, 0.45], [1.2, 3.8, 0.42], [2, 4.1, 0.36], [2.6, 4.5, 0.32]]
        .map(([x, y, r]) => ball(r, 0xf5f0e6, x, y, 0)),
      ...many(5, (i) => turn(torus(0.75 - i * 0.05, 0.08, 0xf5f0e6, -0.2 + i * 0.5, 3.05, 0), 0, Math.PI / 2)),
      box(1.7, 0.9, 0.9, 0xf5f0e6, 3.4, 4.7, 0, 0.3), turn(box(1.4, 0.3, 0.8, 0xf5f0e6, 3.4, 4.05, 0, 0.1), 0, 0, -0.25),
      ball(0.15, 0x222222, 3.6, 4.95, 0.42), ball(0.15, 0x222222, 3.6, 4.95, -0.42),
      ...[0.4, -0.4].map((z) => turn(box(0.6, 0.12, 0.12, 0xf5f0e6, 1.7, 3.2, z), 0, 0, -0.8)),
    ],
  },
  'g-slide': {
    parts: [
      ...[[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].map(([x, z]) => cyl(0.15, 0.15, 5.5, G[0], x - 3, 2.75, z, 8)),
      box(3, 0.3, 3, G[2], -3, 5, 0), ...many(6, (i) => box(0.2, 0.12, 1.2, G[1], -4.6, 0.7 + i * 0.8, 0)), box(0.12, 5, 0.12, G[1], -4.6, 2.5, 0.6), box(0.12, 5, 0.12, G[1], -4.6, 2.5, -0.6),
      turn(box(7.2, 0.2, 1.6, G[3], 0.9, 2.65, 0), 0, 0, -0.62), turn(box(7.2, 0.6, 0.15, G[3], 0.9, 2.9, 0.85), 0, 0, -0.62), turn(box(7.2, 0.6, 0.15, G[3], 0.9, 2.9, -0.85), 0, 0, -0.62),
      sized(ball(1.0, G[1], -3, 6.3, 0), 1.6, 0.6, 1.6),
    ],
  },
  'g-blocks': { parts: [box(4, 4, 4, G[0], -0.8, 2, 0, 0.3), turn(box(3, 3, 3, G[1], -0.6, 5.5, 0.2, 0.3), 0, 0.5), box(2.5, 2.5, 2.5, G[2], 2.6, 1.25, 1.2, 0.3), turn(box(2, 2, 2, G[3], -0.4, 8, 0, 0.3), 0, 1.1)] },

  // Facebook
  'fb-beanbag': { pick: [FB, 0xffffff, 0x42b72a], parts: [sized(ball(1.7, 'pick', 0, 1.0, 0), 1, 0.55, 1), sized(ball(1.2, 'pick', 0, 1.4, -0.7), 1, 0.75, 0.7)] },
  'fb-desk': { parts: [...desk(0x6aa6ff, 0xffffff, 0x2b2f36), turn(box(0.9, 0.05, 0.6, 0xc9ced6, -0.9, 1.72, 0.1), 0, 0.3)] },
  'fb-foosball': {
    parts: [
      box(4.2, 0.9, 2.4, 0x6b4a2b, 0, 1.7, 0, 0.1), flat(box(3.8, 0.05, 2.0, 0x3fae49, 0, 2.16, 0)), ...[-1.6, 1.6].flatMap((x) => [-0.9, 0.9].map((z) => box(0.25, 1.3, 0.25, 0x6b4a2b, x, 0.65, z))),
      ...many(4, (i) => turn(cyl(0.05, 0.05, 3.2, 0xd8dde4, -1.2 + i * 0.8, 2.35, 0, 6), Math.PI / 2)),
      ...many(4, (i) => many(2, (j) => box(0.18, 0.5, 0.12, i % 2 ? 0xea4335 : FB, -1.2 + i * 0.8, 2.25, -0.5 + j))),
    ],
  },
  'fb-plant': { parts: potPlant(3, 0xffffff, 0x42b72a) },
  'fb-scooter': { parts: [turn(cyl(0.3, 0.3, 0.15, 0x222222, -1, 0.3, 0, 10), Math.PI / 2), turn(cyl(0.3, 0.3, 0.15, 0x222222, 1, 0.3, 0, 10), Math.PI / 2), box(2, 0.12, 0.45, FB, 0, 0.45, 0), turn(box(0.12, 2, 0.12, 0xd8dde4, 1.1, 1.4, 0), 0, 0, -0.12), box(0.1, 0.1, 0.9, 0x222222, 1.22, 2.35, 0)] },

  'fb-thumb': {
    parts: [
      box(5, 1, 5, 0xd8dde4, 0, 0.5, 0, 0.2), box(2.6, 2.4, 2.4, 0xffffff, 0, 2.2, 0, 0.3),
      box(3.4, 3.2, 2.8, FB, 0, 4.8, 0, 0.9), box(1.3, 2.6, 1.4, FB, -1.1, 7.4, 0, 0.6),
      ...many(4, (i) => box(0.4, 0.55, 0.3, 0x0f5ec7, 1.75, 3.6 + i * 0.75, 0.6, 0.12)),
    ],
  },
  'fb-hack': { parts: [box(12, 0.3, 6, 0xe7f0fd, 0, 0.15, 0, 0.1), turn(flat(sign(11, 4.6, 0.12, 'HACK', 0xe7f0fd, FB, 0, 0.36, 0)), -Math.PI / 2)] },
  'fb-wall': {
    parts: [
      box(11, 5, 0.6, 0xffffff, 0, 2.5, 0), ...[-5, 5].map((x) => box(0.6, 5.4, 0.9, 0x2b2f36, x, 2.7, 0)),
      ...many(6, (i) => many(4, (j) => turn(box(1.0, 1.0, 0.08, [0xffe066, 0x9be7ff, 0xff9fb5, 0xb9f6a0][(i * 3 + j * 5) % 4], -3.8 + i * 1.5 + ((j % 2) * 0.3), 0.9 + j * 1.15, 0.36), 0, 0, ((i + j) % 3 - 1) * 0.12))),
    ],
  },

  // Anthropic
  'a-books': { pick: [CLAY, 0x5b7c6a, 0x3c4a5c], parts: [box(3.4, 0.7, 2.4, CREAM, 0, 0.35, 0, 0.08), turn(box(3.2, 0.6, 2.3, 'pick', 0, 1.0, 0, 0.08), 0, 0.2), turn(box(2.8, 0.55, 2.0, DARK, 0.1, 1.58, 0, 0.08), 0, -0.15), turn(box(2.6, 0.5, 1.9, CLAY, 0, 2.1, 0, 0.08), 0, 0.35)] },
  'a-plant': { parts: [...potPlant(3.4, CLAY, 0x6b8f71), ...many(5, (i) => grp([spin(turn(sized(ball(0.7, 0x4f7d5c, 0, 0, 0.9), 1, 0.25, 1.4), 0.4), (i * 2 * Math.PI) / 5)], 0, 2.2, 0))] },
  'a-armchair': { pick: [CREAM, 0xe3c9a8, CLAY], parts: [box(3, 1, 2.8, 'pick', 0, 0.9, 0, 0.4), box(3, 2.4, 0.7, 'pick', 0, 1.9, -1.05, 0.35), box(0.7, 1.6, 2.8, 'pick', -1.3, 1.5, 0, 0.3), box(0.7, 1.6, 2.8, 'pick', 1.3, 1.5, 0, 0.3), ...[-1.2, 1.2].flatMap((x) => [-1.1, 1.1].map((z) => cyl(0.12, 0.08, 0.4, 0x6b4a2b, x, 0.2, z, 8)))] },
  'a-lamp': { parts: [cyl(0.8, 0.9, 0.2, DARK, 0, 0.1), cyl(0.1, 0.1, 4.6, DARK, 0, 2.4, 0, 8), lit(cyl(0.7, 1.0, 1.0, 0xffe3b3, 0, 4.9, 0))] },
  'a-mug': { parts: [cyl(1.1, 1.0, 2.2, CLAY, 0, 1.1), flat(cyl(0.95, 0.95, 0.1, 0x6b3e26, 0, 2.15)), torus(0.6, 0.18, CLAY, 1.2, 1.2, 0)] },
  'a-notebook': { parts: [turn(grp([box(3, 0.15, 2.2, CREAM, 0, 0.1, 0), box(0.12, 0.17, 2.2, DARK, 0, 0.12, 0), ...many(5, (i) => flat(box(1.1, 0.02, 0.06, 0x9b9b9b, i % 2 ? 0.8 : -0.8, 0.19, -0.6 + Math.floor(i / 2) * 0.5)))]), 0, 0.3), turn(cyl(0.08, 0.08, 2.4, 0xffd166, 0.6, 0.3, 0.9, 6), 0, 0.2, Math.PI / 2)] },

  'a-spark': {
    parts: [
      box(3.4, 2.4, 3.4, CREAM, 0, 1.2, 0, 0.2), box(3.6, 0.3, 3.6, DARK, 0, 2.5, 0),
      // the rays of the spark, each through the middle
      ...many(8, (i) => turn(box(0.7, 5.6, 0.7, CLAY, 0, 6.2, 0, 0.3), 0, 0, (i * Math.PI) / 8)),
      ball(0.9, CLAY, 0, 6.2, 0),
    ],
  },
  'a-shelf': {
    parts: [
      box(10, 6, 1.6, 0xb08158, 0, 3, 0), ...many(3, (j) => flat(box(9.4, 0.15, 1.4, 0x8a6240, 0, 0.9 + j * 1.9, 0.12))),
      ...many(3, (j) => many(14, (i) => box(0.5, 1.3 + ((i * 7 + j * 3) % 4) * 0.08, 1.1, [CLAY, CREAM, 0x5b7c6a, 0x3c4a5c, 0xe3c9a8, DARK][(i * 5 + j * 2) % 6], -4.3 + i * 0.66, 1.6 + j * 1.9 + ((i * 7 + j * 3) % 4) * 0.04, 0.3))),
    ],
  },
  'a-nook': {
    parts: [
      flat(box(10, 0.08, 8, 0xe3c9a8, 0, 0.04, 0)), flat(box(9, 0.09, 7, CLAY, 0, 0.05, 0)),
      box(7, 1.1, 2.4, 0x5b7c6a, 0, 0.9, -2.4, 0.4), box(7, 2.2, 0.8, 0x5b7c6a, 0, 1.8, -3.4, 0.35), box(0.8, 1.6, 2.4, 0x5b7c6a, -3.3, 1.3, -2.4, 0.3), box(0.8, 1.6, 2.4, 0x5b7c6a, 3.3, 1.3, -2.4, 0.3),
      cyl(1.4, 1.4, 0.2, 0xb08158, 0, 1.2, 1.2), cyl(0.15, 0.15, 1.1, DARK, 0, 0.6, 1.2, 8), cyl(0.6, 0.55, 0.9, CLAY, 0.4, 1.75, 1.2),
    ],
  },

  // LAN party
  'lan-pc': {
    pick: [0x00e5ff, 0xff2bd6, 0x7cff4f],
    parts: [box(1.4, 3, 3, 0x1b1d24, 0, 1.6, 0, 0.1), lit(box(0.06, 2.6, 0.12, 'pick', 0.72, 1.6, 1.3)), lit(box(0.06, 2.6, 0.12, 'pick', 0.72, 1.6, -1.3)),
      ...[0.9, 2.2].map((y) => turn(torus(0.55, 0.08, 0x3a3f47, 0.72, y, 0), 0, Math.PI / 2)), lit(box(0.05, 0.12, 2.4, 'pick', 0.72, 3.0, 0))],
  },
  'lan-desk': { parts: [...desk(0x39e46b, 0x2b2f36, 0x111111), lit(box(1.1, 0.05, 0.4, 0xff2bd6, 0, 1.75, 0.25)), box(1.4, 0.3, 1.4, 0x222222, 0, 1.0, 1.6), box(1.4, 1.8, 0.3, 0xe63946, 0, 2.0, 2.2, 0.1)] },
  'lan-cans': { pick: [0x9cff57, 0x2f9bff, 0xff4d4d], parts: [cyl(0.45, 0.45, 1.6, 'pick', 0, 0.8, 0), cyl(0.45, 0.45, 1.6, 0x111111, 1.0, 0.8, 0.3), turn(cyl(0.45, 0.45, 1.3, 'pick', -0.6, 0.45, 1.1), Math.PI / 2, 0.6), flat(cyl(0.35, 0.35, 0.05, 0xd8dde4, 0, 1.62, 0))] },
  'lan-pizza': {
    parts: [box(3.4, 0.35, 3.4, 0xd9b382, 0, 0.18, 0), turn(box(3.3, 0.35, 3.3, 0xd9b382, 0.1, 0.53, 0), 0, 0.2), box(3.4, 0.12, 3.4, 0xd9b382, 0, 0.78, 0),
      turn(box(3.4, 3.4, 0.12, 0xcfa974, 0, 2.45, -1.7), -0.25), flat(cyl(1.5, 1.5, 0.08, 0xf2b84b, 0, 0.88, 0, 24)),
      ...[[0.6, 0.3], [-0.5, 0.6], [0.2, -0.7], [-0.7, -0.4], [0.9, -0.5]].map(([x, z]) => flat(cyl(0.25, 0.25, 0.05, 0xc0392b, x, 0.94, z, 10)))],
  },
  'lan-chair': {
    pick: [0xe63946, 0x00b4d8, 0x7cff4f],
    parts: [...many(5, (i) => spin(box(0.25, 0.2, 1.3, 0x111111, 0, 0.3, 0.65), (i * 2 * Math.PI) / 5)), cyl(0.15, 0.15, 1.2, 0x2b2f36, 0, 0.9, 0, 8),
      box(1.9, 0.4, 1.8, 0x111111, 0, 1.6, 0, 0.15), box(1.9, 3.2, 0.4, 0x111111, 0, 3.2, -0.8, 0.2), box(0.5, 2.8, 0.42, 'pick', 0, 3.3, -0.79),
      box(0.25, 0.7, 1.2, 0x222222, -1.0, 2.1, 0), box(0.25, 0.7, 1.2, 0x222222, 1.0, 2.1, 0)],
  },

  'lan-screen': {
    parts: [
      ...[-5.4, 5.4].map((x) => box(0.4, 8, 0.4, 0x2b2f36, x, 4, 0)), box(11.4, 6.6, 0.4, 0x111111, 0, 4.8, 0),
      lit(box(10.6, 5.8, 0.1, 0x1e3a8a, 0, 4.8, 0.22)), lit(box(3, 2, 0.1, 0x39e46b, -2.5, 4.2, 0.28)), lit(box(1.2, 1.2, 0.1, 0xff2bd6, 2.6, 5.4, 0.28)), lit(box(9, 0.3, 0.1, 0xfbbc05, 0, 2.4, 0.28)),
      sign(7, 1.3, 0.3, 'LAN PARTY', 0x111111, 0x00e5ff, 0, 8.8, 0),
    ],
  },
  'lan-tables': {
    parts: [box(11, 0.2, 3, 0xd8dde4, 0, 1.6, 0), ...[-5, 5].flatMap((x) => [-1.2, 1.2].map((z) => box(0.2, 1.6, 0.2, 0x9aa3ad, x, 0.8, z))),
      ...many(3, (i) => [box(1.6, 1.0, 0.12, 0x111111, -3.6 + i * 3.6, 2.4, -0.6), lit(box(1.45, 0.85, 0.05, [0x39e46b, 0xff2bd6, 0x00e5ff][i], -3.6 + i * 3.6, 2.4, -0.53)), box(0.15, 0.4, 0.15, 0x111111, -3.6 + i * 3.6, 1.9, -0.65),
        ...figure([0xe63946, 0x2f9bff, 0xffa62b][i], 0xffd2b0, 0x222222, 2.4).map((p) => grp([p], -3.6 + i * 3.6, 0, 1.9))])],
  },
  'lan-router': {
    parts: [box(3, 9, 3, 0x1b1d24, 0, 4.5, 0, 0.15), ...many(8, (i) => [box(2.6, 0.7, 0.1, 0x2b2f36, 0, 1 + i * 1, 1.52), lit(box(0.2, 0.2, 0.1, [0x39e46b, 0xff2bd6, 0x00e5ff, 0xfbbc05][i % 4], 1.0, 1 + i * 1, 1.6)), lit(box(0.2, 0.2, 0.1, 0x39e46b, 0.6, 1 + i * 1, 1.6))]),
      ...[-1, 1].map((x) => cyl(0.08, 0.08, 3, 0x111111, x, 10.5, 0, 6)), ...[-1, 1].map((x) => lit(ball(0.2, 0xff2bd6, x, 12, 0)))],
  },
};

export const themes: Record<'google' | 'facebook' | 'anthropic' | 'lan', ThemeData> = {
  google: {
    title: 'Google Office', sky: [0xeaf3ff, 0xcfe1fb], puddle: 0x7b4a2a,
    ground: [...carpet(0xe1e5ea, 0xd8dde3, 0xc9ced6), ...scatter(28, 37, 91, (x, y, i) => [{ dot: [x, y, 4], c: G[i % 4] }])],
    props: ['g-beanbag', 'g-beanbag', 'g-bike', 'g-plant', 'g-balls', 'g-desk'], landmarks: ['g-trex', 'g-slide', 'g-blocks'],
  },
  facebook: {
    title: 'Facebook HQ', sky: [0x7fb3ff, 0xd6e6ff], puddle: 0x3b82f6,
    ground: [{ fill: 0xc9cdd3 }, { rect: [0, 0, 256, 3], c: 0xa9afb8 }, { rect: [0, 0, 3, 256], c: 0xa9afb8 }, { rect: [0, 128, 256, 2], c: 0xb5bac2 }, { rect: [128, 0, 2, 256], c: 0xb5bac2 },
      ...scatter(10, 71, 113, (x, y, i) => [{ line: [x, y, x + 18, y + (i % 2 ? 8 : -8)], c: [FB, 0x42b72a, 0xf7b928, 0xe4405f][i % 4], w: 4 }])],
    props: ['fb-beanbag', 'fb-desk', 'fb-foosball', 'fb-plant', 'fb-scooter'], landmarks: ['fb-thumb', 'fb-hack', 'fb-wall'],
  },
  anthropic: {
    title: 'Anthropic Office', sky: [0xf3ede3, 0xe6d9c6], puddle: 0xb07a46,
    ground: [{ fill: 0xdcbf96 }, ...many(8, (j) => [{ rect: [0, j * 32, 256, 2] as [number, number, number, number], c: 0xc4a074 }, { rect: [((j * 97) % 256), j * 32, 2, 32] as [number, number, number, number], c: 0xc4a074 },
      { rect: [((j * 97 + 128) % 256), j * 32, 2, 32] as [number, number, number, number], c: 0xc4a074 }, { line: [20 + ((j * 53) % 200), j * 32 + 14, 60 + ((j * 53) % 200), j * 32 + 16], c: 0xd0b084, w: 2 }]).flat() as Paint[]],
    props: ['a-books', 'a-plant', 'a-armchair', 'a-lamp', 'a-mug', 'a-notebook'], landmarks: ['a-spark', 'a-shelf', 'a-nook'],
  },
  lan: {
    title: 'LAN Party', sky: [0x140c2a, 0x2c1f55], puddle: 0x9cff57,
    ground: [...carpet(0x262640, 0x22223a, 0x1c1c30), ...scatter(8, 61, 97, (x, y, i) => [{ line: [x, y, x + 60, y + (i % 2 ? 30 : -20)], c: [0x00e5ff, 0xff2bd6, 0x7cff4f, 0xfbbc05][i % 4], w: 3 }], 64)],
    props: ['lan-pc', 'lan-desk', 'lan-cans', 'lan-pizza', 'lan-chair'], landmarks: ['lan-screen', 'lan-tables', 'lan-router'],
  },
};
