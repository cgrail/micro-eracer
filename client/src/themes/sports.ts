import { figure, flag, tree } from './common.ts';
import { type PropData, type ThemeData, ball, box, cone, cyl, flat, grp, lit, many, scatter, sized, turn, wedge } from './kit.ts';
import { stripes } from './rhine-neckar.ts';

// Sport: a golf course and a soccer field, mown in bands.

const WHITE = 0xffffff;

export const props: Record<string, PropData> = {
  // golf
  'golf-ball': { parts: [cyl(0.12, 0.06, 0.8, WHITE, 0, 0.4, 0, 8), cyl(0.3, 0.12, 0.15, WHITE, 0, 0.85, 0, 10), ball(0.85, WHITE, 0, 1.75, 0), ...many(6, (i) => flat(sized(ball(0.12, 0xdde3ea, Math.cos(i) * 0.6, 1.75 + Math.sin(i * 2) * 0.4, 0.62), 1, 1, 0.4)))] },
  'golf-flag': { parts: [flat(cyl(3.2, 3.2, 0.06, 0x7fd65a, 0, 0.03, 0, 24)), flat(cyl(0.5, 0.5, 0.08, 0x1a1a1a, 0, 0.05, 0, 12)), cyl(0.07, 0.07, 5, WHITE, 0, 2.5, 0, 6), box(1.6, 1.0, 0.05, 0xe63946, 0.82, 4.5, 0)] },
  'golf-bunker': { parts: [flat(sized(cyl(3, 3, 0.1, 0xe9d8a6, 0, 0.05, 0, 20), 1.4, 1, 0.8)), turn(box(0.08, 0.08, 2.6, 0x8a5a33, 1.2, 0.4, 0.2), 0.3, 0.6), box(0.9, 0.12, 0.2, 0x333333, 1.6, 0.15, -0.9)] },
  'golf-bag': {
    pick: [0x1b3f8f, 0xc0392b, 0x2a2a2a],
    parts: [turn(grp([cyl(0.6, 0.6, 2.6, 'pick', 0, 1.3, 0), cyl(0.62, 0.62, 0.25, WHITE, 0, 2.5, 0), ...[[0.2, 0.1], [-0.2, 0.2], [0, -0.25]].map(([x, z]) => grp([cyl(0.04, 0.04, 1, 0x9aa3ad, x, 3.0, z, 6), box(0.4, 0.2, 0.15, 0x333333, x + 0.12, 3.5, z)]))]), 0, 0, 0.15),
      turn(box(0.06, 1.6, 0.06, 0x9aa3ad, -0.5, 0.75, 0.4), 0, 0, -0.4)],
  },
  'golf-tree': { parts: tree(7.5, 0x3d8b3d) },
  'golf-bench': { parts: [box(3, 0.15, 0.9, 0x8a5a33, 0, 1, 0), box(3, 0.9, 0.12, 0x8a5a33, 0, 1.6, -0.45), ...[-1.3, 1.3].flatMap((x) => [box(0.15, 1, 0.15, 0x333333, x, 0.5, 0.3), box(0.15, 1.6, 0.15, 0x333333, x, 0.8, -0.4)])] },
  'golf-cart': {
    parts: [...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => turn(cyl(0.45, 0.45, 0.35, 0x222222, sx * 1.0, 0.45, sz * 1.1, 12), 0, 0, Math.PI / 2))),
      box(2.1, 0.7, 3.4, WHITE, 0, 0.9, 0, 0.2), box(2.0, 0.9, 1.0, 0xe9edf2, 0, 1.6, -0.3, 0.15), box(2.0, 0.7, 0.4, 0x2a9d58, 0, 1.6, 0.25), ...[[-0.9, 1.0], [0.9, 1.0], [-0.9, -1.4], [0.9, -1.4]].map(([x, z]) => cyl(0.06, 0.06, 1.9, 0xd8dde4, x, 2.2, z, 6)),
      box(2.3, 0.15, 2.9, 0x2a9d58, 0, 3.15, -0.2), box(1.8, 1.2, 0.8, 0x1b3f8f, 0, 1.6, -1.55), turn(box(1.7, 0.7, 0.08, 0xbfe6ff, 0, 2.4, 1.0), -0.2)],
  },
  'golf-clubhouse': {
    parts: [box(10, 4.5, 7, WHITE, 0, 2.25, -0.5), turn(wedge(8, 3, 10.6, 0xb5402f, 0, 6, -0.5), 0, Math.PI / 2), ...many(4, (i) => box(1.4, 1.6, 0.2, 0x9fd3f0, -3.4 + i * 2.2, 2.4, 3.05)), box(1.2, 2.4, 0.2, 0x5b3a26, 0, 1.2, 3.06),
      box(10, 0.25, 2.2, 0x8a5a33, 0, 0.12, 4.0), ...[-4.6, -1.5, 1.5, 4.6].map((x) => cyl(0.15, 0.15, 3.2, WHITE, x, 1.6, 4.8, 8)), box(10.2, 0.25, 2.6, 0x2a9d58, 0, 3.3, 4.0)],
  },
  'golf-giant': { parts: [flat(cyl(4.5, 4.5, 0.06, 0x7fd65a, 0, 0.03, 0, 24)), cyl(0.5, 0.25, 2.6, WHITE, 0, 1.3, 0, 10), cyl(1.4, 0.5, 0.5, WHITE, 0, 2.8, 0, 14), ball(3.4, WHITE, 0, 6.3, 0), ...many(10, (i) => flat(sized(ball(0.4, 0xdde3ea, Math.cos(i * 0.9) * 2.6, 6.3 + Math.sin(i * 1.7) * 1.8, 2.2 - Math.abs(Math.sin(i * 1.7)) * 0.8), 1, 1, 0.35))), ...flag(6.5, 0xe63946).map((p) => grp([p], 3.2, 0, -2.6))] },

  // soccer
  'sc-ball': { parts: [ball(1.0, WHITE, 0, 1.0, 0), ...[[0, 1, 0.98], [0.85, 1.2, 0.5], [-0.85, 1.2, 0.5], [0.5, 1.85, 0], [-0.5, 1.85, 0], [0, 0.4, 0.8]].map(([x, y, z]) => sized(ball(0.3, 0x111111, x, y, z), 1, 1, 0.5))] },
  'sc-cones': { parts: [...many(5, (i) => cone(0.45, 0.6, i % 2 ? 0xffd60a : 0xff6b1a, -2.4 + i * 1.2, 0.3, Math.sin(i * 2) * 0.6, 10)), ball(0.5, WHITE, 1.4, 0.5, 1.2)] },
  'sc-corner': { parts: [...flag(4, 0xff3b3b, 0xffd60a), flat(turn(cyl(2.2, 2.2, 0.04, WHITE, 0, 0.02, 0, 16), 0, 0, 0)), flat(cyl(2.0, 2.0, 0.05, 0x4caa3f, 0, 0.03, 0, 16))] },
  'sc-bottles': { parts: [...many(5, (i) => grp([cyl(0.28, 0.28, 1.2, i % 2 ? 0x2f9bff : 0xff4d4d, 0, 0.6, 0, 10), cyl(0.12, 0.2, 0.3, WHITE, 0, 1.35, 0, 8)], -1 + i * 0.6, 0, 0.2)), box(3.6, 0.5, 1.4, 0x2f9bff, 0, 0.25, -1, 0.1)] },
  'sc-bench': {
    parts: [box(6, 0.2, 1.2, 0x333a44, 0, 1, 0), ...[-2.6, 0, 2.6].map((x) => box(0.2, 1, 1, 0x333a44, x, 0.5, 0)),
      box(6.4, 3.2, 0.2, 0xbfe6ff, 0, 1.6, -1.2), turn(box(6.4, 0.2, 2.6, 0xbfe6ff, 0, 3.4, -0.2), 0.25), ...many(3, (i) => grp(figure([0xe63946, 0xffd60a, 0xe63946][i], 0xffd2b0, 0x222222, 1.8), -1.8 + i * 1.8, 0.4, 0))],
  },
  'sc-goal': {
    parts: [...[-3.8, 3.8].map((x) => box(0.3, 3, 0.3, WHITE, x, 1.5, 0)), box(7.9, 0.3, 0.3, WHITE, 0, 3, 0),
      ...[-3.8, 3.8].map((x) => turn(box(0.1, 0.1, 3.4, 0xd8dde4, x, 2.0, -1.6), -0.6)), ...many(9, (i) => flat(box(0.05, 2.1, 0.05, 0xd8dde4, -3.6 + i * 0.9, 1.05, -2.6))),
      ...many(3, (i) => flat(box(7.6, 0.05, 0.05, 0xd8dde4, 0, 0.4 + i * 0.75, -2.6))), turn(box(7.6, 0.05, 2.9, 0xe9edf2, 0, 2.5, -1.3), -0.38),
      flat(box(10, 0.04, 0.3, WHITE, 0, 0.02, 0.6)), flat(box(0.3, 0.04, 4, WHITE, -4.9, 0.02, 2.5)), flat(box(0.3, 0.04, 4, WHITE, 4.9, 0.02, 2.5))],
  },
  'sc-stand': {
    parts: [...many(3, (j) => [box(10, 1, 1.4, 0x9aa3ad, 0, 0.5 + j * 1, -j * 1.4), ...many(10, (i) => grp([box(0.6, 0.7, 0.5, [0xe63946, 0xffd60a, 0x2f9bff, 0xffffff][(i + j * 3) % 4], 0, 0.35, 0), ball(0.32, 0xffd2b0, 0, 0.95, 0)], -4.4 + i * 0.98, 1 + j * 1, -j * 1.4 + 0.2))]),
      box(10.4, 0.4, 5.6, 0xd8dde4, 0, 5.4, -1.8), ...[-5, 5].map((x) => box(0.3, 5.4, 0.3, 0x9aa3ad, x, 2.7, -4.4))],
  },
  'sc-floodlight': { parts: [cyl(0.4, 0.6, 15, 0x9aa3ad, 0, 7.5, 0, 8), box(4, 2.4, 0.6, 0x333a44, 0, 15.6, 0.3), ...many(3, (i) => many(2, (j) => lit(box(1.0, 0.8, 0.1, 0xfffbe0, -1.3 + i * 1.3, 15.1 + j * 1.0, 0.65))))] },
};

export const themes: Record<'golf' | 'soccer', ThemeData> = {
  golf: {
    title: 'Golf Course', sky: [0x58b6ff, 0xd8f0ff], puddle: 0x4fb3e8, clouds: true,
    ground: [...stripes(0x6cc24a, 0x63b842, 64), ...scatter(24, 97, 57, (x, y) => [{ rect: [x, y, 3, 6], c: 0x58a83a }])],
    props: ['golf-ball', 'golf-flag', 'golf-bunker', 'golf-bag', 'golf-tree', 'golf-tree', 'golf-bench'], landmarks: ['golf-cart', 'golf-clubhouse', 'golf-giant'],
  },
  soccer: {
    title: 'Soccer Field', sky: [0x4aa8ff, 0xcfe9ff], puddle: 0x6b4a2b, clouds: true,
    ground: [...stripes(0x4fae42, 0x47a03a), ...scatter(30, 97, 57, (x, y) => [{ rect: [x, y, 2, 6], c: 0x3f9433 }])],
    props: ['sc-ball', 'sc-cones', 'sc-corner', 'sc-bottles', 'sc-bench'], landmarks: ['sc-goal', 'sc-stand', 'sc-floodlight'],
  },
};

