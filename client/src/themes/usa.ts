import { building, lamp, palm, tree, vehicle, wheels } from './common.ts';
import { type Paint, type PropData, type ThemeData, ball, box, cone, cyl, dome, flat, grp, lit, many, pyramid, scatter, sign, sized, spin, torus, turn, wedge } from './kit.ts';

// The United States: New York, Las Vegas, Hollywood and San Francisco.

const CAB = 0xf7c516, ORANGE = 0xc0362c, GOLD = 0xd4a537;
type R = [number, number, number, number];

/** A five-pointed star as a polygon, for the Walk of Fame. */
const star = (x: number, y: number, r: number): number[] => [...Array(10).keys()].flatMap((i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5, d = i % 2 ? r * 0.42 : r;
  return [Math.round((x + Math.cos(a) * d) * 10) / 10, Math.round((y + Math.sin(a) * d) * 10) / 10];
});

/** Pips on the faces of a die of size s centred at y = s / 2. */
const pips = (s: number): PropData['parts'] => {
  const h = s / 2 + 0.01, o = s * 0.26, p = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => flat(sized(ball(s * 0.1, 0xffffff, x, y, z), sx, sy, sz));
  return [
    ...[[-o, -o], [o, o], [0, 0], [-o, o], [o, -o]].map(([a, b]) => p(a, s + 0.01, b, 1, 0.25, 1)),
    ...[[-o, -o], [0, 0], [o, o]].map(([a, b]) => p(a, h + b, h, 1, 1, 0.25)),
    ...[[-o, o], [o, -o]].map(([a, b]) => p(h, h + a, b, 0.25, 1, 1)),
  ];
};

export const props: Record<string, PropData> = {
  // New York
  'ny-cab': { parts: [...vehicle(4.4, 2, 2, CAB), sign(0.9, 0.35, 0.3, 'TAXI', 0xfff3b0, 0x111111, 0, 2.65, 0), ...[-1, 1].flatMap((s) => many(6, (i) => flat(box(0.05, 0.18, 0.3, i % 2 ? 0x111111 : 0xffffff, s * 1.01, 1.0, -0.9 + i * 0.3))))] },
  'ny-hotdog': {
    pick: [0xe63946, 0x2f9bff, 0xf7c516],
    parts: [turn(cyl(0.6, 0.6, 0.2, 0x222222, 0, 0.6, 1.3, 12), Math.PI / 2), turn(cyl(0.6, 0.6, 0.2, 0x222222, 0, 0.6, -1.3, 12), Math.PI / 2), box(1.6, 1.4, 2.8, 0xd8dde4, 0, 1.5, 0, 0.1), sign(1.4, 0.5, 0.05, 'HOT DOGS', 0xe63946, 0xffffff, 0, 1.6, 1.43),
      cyl(0.06, 0.06, 2.6, 0x9aa3ad, 0, 3.4, 0, 6), cone(2.0, 0.8, 'pick', 0, 4.9, 0, 8), turn(cyl(0.15, 0.15, 0.9, 0xc0603a, 0.4, 2.3, 0.2, 8), Math.PI / 2), box(0.5, 0.2, 1.2, 0xe0b46a, -0.3, 2.3, 0)],
  },
  'ny-hydrant': { parts: [cyl(0.55, 0.6, 0.3, ORANGE, 0, 0.15, 0, 10), cyl(0.42, 0.45, 1.4, ORANGE, 0, 1.0, 0, 10), dome(0.45, ORANGE, 0, 1.7, 0), cyl(0.12, 0.15, 0.3, ORANGE, 0, 2.2, 0, 6), ...[-1, 1].map((s) => turn(cyl(0.18, 0.18, 0.4, 0xd8dde4, s * 0.55, 1.2, 0, 8), 0, 0, Math.PI / 2))] },
  'ny-lamp': { parts: lamp(5.5, 0x2e5e3e, 0xfff3b0) },
  'ny-trash': { parts: [cyl(0.75, 0.6, 1.8, 0x2e5e3e, 0, 0.9, 0, 12), ...[0.4, 1.0, 1.6].map((y) => turn(torus(0.72 - (1.8 - y) * 0.06, 0.06, 0x1d3b2a, 0, y, 0), Math.PI / 2)), ball(0.35, 0xf2f2f2, 0.2, 1.9, 0.1), ball(0.28, 0xd9b382, -0.2, 1.95, -0.2)] },
  'ny-mailbox': { parts: [...[-0.4, 0.4].flatMap((x) => [-0.35, 0.35].map((z) => box(0.12, 0.6, 0.12, 0x1b3f8f, x, 0.3, z))), box(1.1, 1.4, 1.0, 0x1b3f8f, 0, 1.3, 0), turn(cyl(0.55, 0.55, 1.0, 0x1b3f8f, 0, 2.0, 0), Math.PI / 2), box(0.6, 0.08, 0.05, 0x111111, 0, 1.85, 0.52)] },
  'ny-empire': {
    parts: [box(9, 5, 9, 0xbfb6a0, 0, 2.5, 0), box(6.4, 12, 6.4, 0xc9c0aa, 0, 11, 0), ...many(4, (i) => spin(grp(many(5, (j) => flat(box(0.35, 11.6, 0.05, 0x8f8775, -2.4 + j * 1.2, 11, 3.23)))), (i * Math.PI) / 2)),
      box(4.8, 6, 4.8, 0xbfb6a0, 0, 20, 0), box(3.4, 3, 3.4, 0xc9c0aa, 0, 24.5, 0), cyl(1.0, 1.4, 3, 0xbfb6a0, 0, 27.5, 0, 8), cyl(0.3, 0.7, 2.6, 0xd8dde4, 0, 30.3, 0, 8), cone(0.25, 3, 0xd8dde4, 0, 33.1, 0, 6), lit(ball(0.2, 0xff3b3b, 0, 34.7, 0))],
  },
  'ny-glass': {
    parts: [...building(8, 20, 8, 0x4e6f8f, 0xbfe6ff, 8, 3), box(8.4, 0.5, 8.4, 0x9aa3ad, 0, 20.2, 0),
      ...[-0.8, 0.8].flatMap((x) => [-0.8, 0.8].map((z) => cyl(0.1, 0.1, 2.2, 0x5b3a26, 1.6 + x, 21.5, 1.6 + z, 6))), cyl(1.3, 1.3, 2.4, 0x8a5a33, 1.6, 23.8, 1.6), cone(1.4, 1.2, 0x3d4250, 1.6, 25.6, 1.6)],
  },
  'ny-liberty': {
    parts: [box(6, 2, 6, 0xc9c0aa, 0, 1, 0), box(4, 5, 4, 0xd8d0bf, 0, 4.5, 0), box(4.6, 0.6, 4.6, 0xc9c0aa, 0, 7.3, 0),
      cyl(0.9, 1.6, 6, 0x6fae9a, 0, 10.6, 0), box(1.9, 1.4, 1.3, 0x6fae9a, 0, 14, 0, 0.4), ball(0.75, 0x6fae9a, 0, 15.2, 0), ...many(7, (i) => spin(turn(cone(0.12, 1.1, 0x6fae9a, 0, 15.9, 0.65, 4), 0.9), -1.4 + (i * 2.8) / 6)),
      turn(box(0.45, 3.2, 0.45, 0x6fae9a, 1.05, 16.0, 0), 0, 0, -0.15), cyl(0.18, 0.12, 0.9, 0x6fae9a, 1.3, 17.9, 0, 8), cyl(0.35, 0.25, 0.4, GOLD, 1.32, 18.5, 0, 8), lit(cone(0.3, 0.8, 0xffb000, 1.33, 19.1, 0, 8)),
      turn(box(0.9, 1.3, 0.25, 0x6fae9a, -1.1, 12.6, 0.4), 0, 0.3, 0.3)],
  },

  // Las Vegas
  'lv-dice': { parts: [box(1.8, 1.8, 1.8, 0xd62839, 0, 0.9, 0, 0.3), ...pips(1.8), grp([turn(grp([box(1.6, 1.6, 1.6, 0xd62839, 0, 0.8, 0, 0.28), ...pips(1.6)]), 0, 0.7)], 2.0, 0, 0.6)] },
  'lv-chips': {
    pick: [0xd62839, 0x1b3f8f, 0x2a9d58, 0x111111],
    parts: [...many(7, (i) => [cyl(0.8, 0.8, 0.22, 'pick', 0, 0.12 + i * 0.24, 0, 16), flat(cyl(0.82, 0.82, 0.08, 0xffffff, 0, 0.12 + i * 0.24, 0, 16))]),
      ...many(4, (i) => [cyl(0.8, 0.8, 0.22, 0x111111, 1.8, 0.12 + i * 0.24, 0.3, 16), flat(cyl(0.82, 0.82, 0.08, GOLD, 1.8, 0.12 + i * 0.24, 0.3, 16))]), turn(cyl(0.8, 0.8, 0.22, 'pick', -1.4, 0.7, 0.9, 16), 1.2, 0.3)],
  },
  'lv-cards': {
    parts: [...many(5, (i) => turn(grp([box(1.4, 0.04, 2.0, 0xffffff, 0, 0.05 + i * 0.01, 0.6), flat(ball(0.18, i % 2 ? 0xd62839 : 0x111111, 0, 0.08 + i * 0.01, 0.6))]), 0, -0.8 + i * 0.4)),
      turn(box(1.4, 2.0, 0.05, 0xffffff, -1.6, 0.95, 0), -0.3), turn(box(1.4, 2.0, 0.05, 0xffffff, -1.6, 0.95, -0.55), 0.3), flat(box(0.4, 0.4, 0.06, 0xd62839, -1.6, 1.0, 0.33))],
  },
  'lv-slot': {
    parts: [box(2.4, 3.6, 1.8, 0xc0392b, 0, 1.8, 0, 0.2), box(2.5, 0.5, 1.9, GOLD, 0, 3.8, 0, 0.1), lit(box(2.0, 1.1, 0.1, 0xfff6d6, 0, 2.7, 0.92)),
      ...[-0.6, 0, 0.6].map((x, i) => flat(ball(0.25, [0xd62839, GOLD, 0x7cff4f][i], x, 2.7, 0.98))), box(2.0, 0.2, 0.6, 0x222222, 0, 1.8, 1.1), cyl(0.07, 0.07, 1.6, 0xd8dde4, 1.35, 3.0, 0, 6), ball(0.3, 0xd62839, 1.35, 3.85, 0), lit(dome(0.5, 0xff3b3b, 0, 4.05, 0))],
  },
  'lv-palm': { parts: palm(7.5, 0x45b84c) },
  'lv-sign': {
    parts: [...[-1.6, 1.6].map((x) => box(0.4, 4, 0.4, 0xd8dde4, x, 2, 0)), turn(box(5.4, 5.4, 0.4, 0xffffff, 0, 6.2, 0, 0.3), 0, 0, Math.PI / 4), sign(6.4, 2.0, 0.5, 'LAS VEGAS', 0xffffff, 0xd62839, 0, 6.2, 0.05),
      ...many(4, (i) => turn(box(0.25, 1.4, 0.25, 0xe63946, 0, 10.6, 0), 0, 0, (i * Math.PI) / 4 + 0.4)), ...many(16, (i) => lit(ball(0.17, 0xfff3b0, Math.cos((i * Math.PI) / 8) * 3.6, 6.2 + Math.sin((i * Math.PI) / 8) * 3.6, 0.25)))],
  },
  'lv-luxor': { parts: [pyramid(10, 8, 10, 0x1d1b2e, 0, 4, 0), lit(cyl(0.35, 0.35, 22, 0xfff6d6, 0, 19.5, 0, 8)), box(2.4, 2.2, 1.4, 0xd9c08a, 0, 1.1, 5.6), box(0.9, 1.2, 0.9, 0xd9c08a, 0, 2.5, 6.0)] },
  'lv-casino': {
    parts: [box(11, 6, 7, 0x2a1f4f, 0, 3, -0.5), box(11.2, 0.4, 7.2, GOLD, 0, 6.2, -0.5), sign(8, 2, 0.4, 'CASINO', 0xd62839, 0xffd60a, 0, 7.6, 2.6),
      ...many(14, (i) => lit(ball(0.18, 0xfff3b0, -4 + i * 0.615, 8.75, 2.85))), ...many(14, (i) => lit(ball(0.18, 0xfff3b0, -4 + i * 0.615, 6.45, 2.85))),
      lit(box(3, 3, 0.1, 0xffb36b, 0, 1.5, 3.02)), box(5, 0.3, 2.6, GOLD, 0, 3.3, 4.2), ...[-2.3, 2.3].map((x) => cyl(0.12, 0.12, 3.2, GOLD, x, 1.6, 5.2, 8)), flat(box(4, 0.04, 3, 0xd62839, 0, 0.02, 4.4))],
  },

  // Hollywood
  'hw-camera': {
    parts: [...many(3, (i) => spin(turn(box(0.15, 3.0, 0.15, 0x333333, 0, 1.4, 0.55), -0.35), (i * 2 * Math.PI) / 3)), box(1.0, 1.0, 1.8, 0x2a2a2a, 0, 3.1, 0, 0.1),
      turn(cyl(0.35, 0.45, 0.8, 0x111111, 0, 3.1, 1.2, 12), Math.PI / 2), ...[-0.5, 0.5].map((z) => turn(torus(0.55, 0.15, 0x2a2a2a, 0, 4.1, z), 0, Math.PI / 2)), turn(cyl(0.5, 0.5, 0.15, 0x555555, 0, 4.1, 0.5), 0, 0, Math.PI / 2)],
  },
  'hw-clapper': { parts: [box(2.2, 1.6, 0.15, 0x1a1a1a, 0, 0.9, 0), ...many(3, (i) => flat(box(1.8, 0.04, 0.02, 0xffffff, 0, 0.5 + i * 0.4, 0.09))), turn(grp([box(2.2, 0.35, 0.15, 0x1a1a1a, 1.1, 0, 0), ...many(4, (i) => flat(box(0.25, 0.36, 0.02, 0xffffff, 0.3 + i * 0.55, 0, 0.09)))], -1.1, 1.85, 0), 0, 0, 0.35)] },
  'hw-chair': {
    pick: [0x8b1e2d, 0x1b3f8f, 0x1a1a1a],
    parts: [...[-0.7, 0.7].flatMap((x) => [turn(box(0.12, 1.8, 0.12, 0x8a5a33, x, 0.9, 0.3), 0.35), turn(box(0.12, 1.8, 0.12, 0x8a5a33, x, 0.9, -0.3), -0.35), box(0.12, 2.6, 0.12, 0x8a5a33, x, 1.3, -0.4)]),
      box(1.4, 0.06, 0.9, 'pick', 0, 1.6, 0), box(1.4, 0.6, 0.06, 'pick', 0, 2.3, -0.42), sign(1.2, 0.3, 0.07, 'DIRECTOR', 0x1a1a1a, 0xffffff, 0, 2.3, -0.38)],
  },
  'hw-popcorn': { parts: [...many(8, (i) => spin(box(0.55, 2, 0.1, i % 2 ? 0xd62839 : 0xffffff, 0, 1.0, 0.85), (i * Math.PI) / 4)), cyl(0.85, 0.65, 2, 0xffffff, 0, 1.0, 0, 16), ...many(9, (i) => ball(0.32, i % 3 ? 0xfff6d6 : 0xffe38a, Math.cos(i * 1.3) * 0.5, 2.15 + (i % 3) * 0.12, Math.sin(i * 1.3) * 0.5))] },
  'hw-statue': { parts: [cyl(0.8, 0.9, 1.2, 0x1a1a1a, 0, 0.6, 0), cyl(0.5, 0.5, 0.3, GOLD, 0, 1.35, 0), cyl(0.35, 0.3, 2.4, GOLD, 0, 2.7, 0, 10), ball(0.32, GOLD, 0, 4.15, 0), box(0.9, 0.25, 0.35, GOLD, 0, 3.2, 0.2, 0.1)] },
  'hw-palm': { parts: palm(8.5) },
  'hw-sign': {
    parts: [sized(dome(6, 0x9a8a4a, 0, 0, 0), 1.15, 0.45, 0.8), flat(sized(dome(5, 0x7d8f3e, 0, 0.05, 0), 1.1, 0.42, 0.75)),
      ...many(9, (i) => box(0.2, 2.2, 0.2, 0x8a7a5a, -5.2 + i * 1.3, 2.6, 0.5)), turn(sign(12, 2.3, 0.15, 'HOLLYWOOD', 0x7d8f3e, 0xffffff, 0, 3.4, 0.7), -0.2)],
  },
  'hw-reel': {
    parts: [box(4, 0.8, 2, 0x333333, 0, 0.4, 0), torus(4.0, 0.35, 0x9aa3ad, 0, 5.0, 0), turn(cyl(3.8, 3.8, 0.3, 0x5b6470, 0, 5.0, 0, 24), Math.PI / 2),
      ...many(6, (i) => flat(turn(cyl(0.8, 0.8, 0.34, 0x2a2a2a, Math.cos((i * Math.PI) / 3) * 2.3, 5.0 + Math.sin((i * Math.PI) / 3) * 2.3, 0, 12), Math.PI / 2))), turn(cyl(0.6, 0.6, 0.5, 0xd8dde4, 0, 5, 0), Math.PI / 2),
      ...many(5, (i) => turn(box(1.3, 0.05, 1.2, 0x1a1a1a, 2.4 + i * 0.3, 0.2 + i * 0.05, 1.2 + i * 0.9), 0, 0.3 + i * 0.25)), ...many(5, (i) => flat(box(1.1, 0.06, 0.8, 0xfff3b0, 2.4 + i * 0.3, 0.21 + i * 0.05, 1.2 + i * 0.9)))],
  },
  'hw-lights': {
    // two searchlights, their beams crossing over the street
    parts: [...[-2.4, 2.4].flatMap((x) => [box(1.6, 1.0, 1.6, 0x333333, x, 0.5, 0),
      grp([turn(grp([cyl(0.75, 0.75, 1.5, 0x5b6470), lit(cyl(0.65, 0.65, 0.05, 0xfff6d6, 0, 0.78, 0)), lit(cyl(0.6, 0.2, 18, 0xfff6d6, 0, 9.8, 0, 10))]), 0, 0, x * 0.1)], x, 1.8, 0)])],
  },

  // San Francisco
  'sf-cablecar': {
    parts: [...wheels(5, 1.6, 0.35), box(2.4, 1.3, 6, ORANGE, 0, 1.15, 0, 0.1), box(2.4, 1.4, 4, 0xf2e3c6, 0, 2.5, 0), ...[-1, 1].flatMap((s) => many(4, (i) => box(0.05, 0.9, 0.7, 0xbfe6ff, s * 1.22, 2.55, -1.4 + i * 0.95))),
      box(2.6, 0.3, 6.4, 0x6b3a26, 0, 3.35, 0, 0.1), ...[-2.6, 2.6].flatMap((z) => [-1, 1].map((x) => cyl(0.06, 0.06, 1.6, 0xd4a537, x * 1.1, 2.6, z, 6))), sign(1.6, 0.35, 0.06, 'POWELL ST', 0x111111, 0xffffff, 0, 3.0, 3.0)],
  },
  'sf-lady': {
    pick: [0xf7c6d0, 0xb8e0d2, 0xf9e79f, 0xc3b1e1],
    parts: [box(4, 6.5, 4.4, 'pick', 0, 3.25, 0), box(1.6, 3.6, 1.0, 'pick', -0.8, 3.8, 2.6), ...[3.2, 4.6].map((y) => box(1.2, 0.9, 0.06, 0xbfe6ff, -0.8, y, 3.11)), turn(wedge(4.6, 2.4, 4.8, 0x6b4a6b, 0, 7.7, 0), 0, 0, 0),
      ...[0.5, 2.0, 3.6, 5.0, 6.45].map((y) => box(4.1, 0.15, 4.5, 0xffffff, 0, y, 0)), box(1.0, 1.9, 0.06, 0x7a4a3a, 1.1, 1.65, 2.23), ...many(4, (i) => box(1.4, 0.25, 0.5, 0xffffff, 1.1, 0.12 + i * 0.25, 3.6 - i * 0.4))],
  },
  'sf-hydrant': { parts: [cyl(0.5, 0.55, 0.3, 0xf2f2f2, 0, 0.15, 0, 10), cyl(0.4, 0.42, 1.3, 0xf2f2f2, 0, 0.95, 0, 10), dome(0.42, GOLD, 0, 1.6, 0), ...[-1, 1].map((s) => turn(cyl(0.16, 0.16, 0.4, GOLD, s * 0.5, 1.1, 0, 8), 0, 0, Math.PI / 2))] },
  'sf-sealion': { parts: [sized(ball(2.4, 0x7d7f82, 0, 0.6, 0), 1.2, 0.5, 1), sized(ball(0.9, 0x6b4a2b, -0.6, 1.8, 0), 1.9, 0.6, 0.8), ball(0.5, 0x6b4a2b, 1.2, 2.2, 0), sized(ball(0.35, 0x6b4a2b, -2.3, 1.6, 0.3), 1.4, 0.4, 1), ball(0.08, 0x111111, 1.55, 2.35, 0.25)] },
  'sf-sourdough': { parts: [flat(cyl(1.6, 1.6, 0.06, 0xffffff, 0, 0.03, 0, 16)), sized(ball(1.3, 0xc8913f, 0, 1.0, 0), 1, 0.75, 1), flat(cyl(0.95, 0.95, 0.1, 0xf6efe0, 0, 1.75, 0, 14)), ball(0.12, 0xe0b46a, 0.3, 1.82, 0.2), ball(0.12, 0x5aa64a, -0.3, 1.82, -0.1)] },
  'sf-pyramid': { parts: [box(6, 1.2, 6, 0xd8dde4, 0, 0.6, 0), pyramid(5.2, 24, 5.2, 0xf4f4f0, 0, 13.2, 0), ...[-1, 1].map((s) => box(0.8, 5, 2.2, 0xf4f4f0, s * 1.4, 17, 0)), cone(0.2, 3, 0xd8dde4, 0, 26.6, 0, 6)] },
  'sf-coit': { parts: [sized(dome(6, 0x5aa64a, 0, 0, 0), 1, 0.35, 1), cyl(1.6, 1.8, 1.6, 0xe8e4da, 0, 2.6, 0), cyl(1.15, 1.25, 11, 0xf2efe6, 0, 8.8, 0, 16), ...many(8, (i) => box(0.3, 1.2, 0.1, 0x2a2a2a, Math.cos(i * 0.785) * 1.2, 13.0, Math.sin(i * 0.785) * 1.2)), cyl(1.3, 1.2, 0.6, 0xe8e4da, 0, 14.5, 0), ...tree(4.5, 0x3d8b3d).map((p) => grp([p], 3.6, 1.2, 1.2))] },
};

export const themes: Record<'newyork' | 'vegas' | 'hollywood' | 'sanfrancisco', ThemeData> = {
  newyork: {
    title: 'New York', sky: [0x7ab8f5, 0xffd9b0], puddle: 0x7d8a99,
    ground: [{ fill: 0xa7abb1 }, ...many(4, (i) => [{ rect: [i * 64, 0, 3, 256] as R, c: 0x8c9096 }, { rect: [0, i * 64, 256, 3] as R, c: 0x8c9096 }]).flat() as Paint[], ...scatter(12, 97, 57, (x, y) => [{ dot: [x, y, 3], c: 0x7d8187 }])],
    props: ['ny-cab', 'ny-cab', 'ny-hotdog', 'ny-hydrant', 'ny-lamp', 'ny-trash', 'ny-mailbox'], landmarks: ['ny-empire', 'ny-glass', 'ny-liberty'],
  },
  vegas: {
    title: 'Las Vegas', sky: [0x2a1450, 0xff7a4d], puddle: 0xf3e6a0,
    ground: [{ fill: 0x7a1530 }, ...many(4, (i) => many(4, (j) => ({ poly: [i * 64 + 32, j * 64 + 6, i * 64 + 58, j * 64 + 32, i * 64 + 32, j * 64 + 58, i * 64 + 6, j * 64 + 32], c: 0x8f1d3b }))),
      ...many(4, (i) => many(4, (j) => ({ dot: [i * 64 + 32, j * 64 + 32, 6] as [number, number, number], c: GOLD }))), ...many(5, (i) => many(5, (j) => ({ dot: [i * 64, j * 64, 3] as [number, number, number], c: 0xf0c75e })))],
    props: ['lv-dice', 'lv-chips', 'lv-cards', 'lv-slot', 'lv-palm', 'lv-chips'], landmarks: ['lv-sign', 'lv-luxor', 'lv-casino'],
  },
  hollywood: {
    title: 'Hollywood', sky: [0x5fb3ff, 0xffd59a], puddle: 0x4a2511,
    ground: [{ fill: 0x3b3537 }, ...many(4, (i) => [{ rect: [i * 64, 0, 3, 256] as R, c: 0x5a5254 }, { rect: [0, i * 64, 256, 3] as R, c: 0x5a5254 }]).flat() as Paint[],
      ...many(4, (i) => many(4, (j) => [{ poly: star(i * 64 + 33, j * 64 + 34, 22), c: GOLD }, { poly: star(i * 64 + 33, j * 64 + 34, 18), c: 0xf2a6b8 }])).flat() as Paint[]],
    props: ['hw-camera', 'hw-clapper', 'hw-chair', 'hw-popcorn', 'hw-statue', 'hw-palm', 'hw-palm'], landmarks: ['hw-sign', 'hw-reel', 'hw-lights'],
  },
  sanfrancisco: {
    title: 'San Francisco', sky: [0xbcd7e8, 0xf1f4f6], puddle: 0x7fb2cf, clouds: true,
    ground: [{ fill: 0xb3b7bd }, { rect: [0, 0, 256, 3], c: 0x989ca2 }, { rect: [0, 128, 256, 3], c: 0x989ca2 }, ...[40, 88, 168, 216].map((x) => ({ rect: [x, 0, 5, 256] as R, c: 0x6d7178 })), { rect: [126, 0, 4, 256], c: 0x55585e }],
    props: ['sf-cablecar', 'sf-lady', 'sf-lady', 'sf-hydrant', 'sf-sealion', 'sf-sourdough'], landmarks: ['sf-pyramid', 'sf-coit'],
    // the Golden Gate over the bay, the piers along the city's shore, the Marin Headlands rising on the far one
    water: { color: 0x3f7fae, bank: 0xd8c8a0, width: [24, 44], bridge: 'suspension', rail: ORANGE, piers: true, hills: 0x8aa35a },
  },
};
