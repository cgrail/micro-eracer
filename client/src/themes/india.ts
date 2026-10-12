import { type PropData, type ThemeData, ball, box, cone, cyl, dome, flat, grp, many, sized, spin, torus, turn } from './kit.ts';

// An Indian kitchen table: thalis, naan, samosas and chai on a red tablecloth.

const STEEL = 0xc9ced6, COPPER = 0xb87333, CLAY = 0xb5653a;

/** A small steel bowl (katori) with something in it. */
const katori = (food: number, x: number, z: number) => grp([cyl(0.55, 0.42, 0.45, STEEL, 0, 0.42, 0, 14), flat(cyl(0.5, 0.5, 0.05, food, 0, 0.63, 0, 14))], x, 0, z);

export const props: Record<string, PropData> = {
  'in-thali': {
    parts: [cyl(2.6, 2.5, 0.2, STEEL, 0, 0.1, 0, 24), turn(torus(2.5, 0.08, 0xdfe3e8, 0, 0.2, 0), Math.PI / 2),
      ...[[0xf2b632, -1.2, -1.2], [0xc0392b, 0, -1.6], [0x3f8f4a, 1.2, -1.2], [0xf6f1e3, 1.6, 0], [0xe67e22, 1.2, 1.2]].map(([c, x, z]) => katori(c, x, z)),
      sized(dome(1.0, 0xfaf7ee, -0.6, 0.2, 0.5), 1, 0.7, 1), flat(cyl(0.9, 0.9, 0.04, 0xe8c27a, 0.4, 0.24, 1.4, 16)), sized(ball(0.3, 0x3f8f4a, -1.8, 0.35, 0.6), 1, 0.6, 1)],
  },
  'in-naan': { parts: [...many(4, (i) => turn(sized(ball(1.3, 0xe8c27a, 0, 0.15 + i * 0.22, 0), 1.3, 0.12, 0.85), 0, i * 0.5)), ...many(6, (i) => flat(sized(ball(0.18, 0x9c6b3a, Math.cos(i * 1.7) * 0.9, 0.95, Math.sin(i * 1.7) * 0.5), 1, 0.3, 1)))] },
  'in-samosa': { parts: [flat(cyl(1.9, 1.9, 0.06, 0xffffff, 0, 0.03, 0, 16)), ...[[0, 0, 0], [1.0, 0.3, 1.2], [-0.9, 0.4, 2.3]].map(([x, z, a]) => turn(cone(0.8, 1.2, 0xd9a441, x, 0.6, z, 3), 0, a)), ...[[0.3, -1.1], [-0.5, -1.0]].map(([x, z]) => sized(ball(0.35, 0x3f8f4a, x, 0.2, z), 1, 0.5, 1))] },
  'in-chai': {
    parts: [cyl(0.5, 0.4, 1.2, 0xe8eef2, 0, 0.6, 0, 12), flat(cyl(0.46, 0.46, 0.05, 0xb07a46, 0, 1.0, 0, 12)), cyl(0.5, 0.4, 1.2, 0xe8eef2, 1.2, 0.6, 0.4, 12), flat(cyl(0.46, 0.46, 0.05, 0xb07a46, 1.2, 1.0, 0.4, 12)),
      sized(ball(1.0, COPPER, -1.4, 1.0, -0.2), 1, 0.9, 1), cyl(0.3, 0.45, 0.4, COPPER, -1.4, 1.95, -0.2, 10), turn(cyl(0.12, 0.18, 1.0, COPPER, -0.6, 1.4, -0.2, 8), 0, 0, -0.9), torus(0.5, 0.08, 0x2a2a2a, -2.3, 1.3, -0.2)],
  },
  'in-spices': { parts: [cyl(2.2, 2.0, 0.25, COPPER, 0, 0.12, 0, 20), ...[[0xc0392b, -0.8, -0.6], [0xf2b632, 0.8, -0.6], [0xe67e22, -0.8, 0.8], [0x3f8f4a, 0.8, 0.8], [0x7a4a2a, 0, 0.1]].map(([c, x, z]) => cone(0.62, 0.8, c, x, 0.65, z, 12))] },
  'in-chili': { parts: [...many(5, (i) => spin(turn(cone(0.25, 1.6, i % 4 ? 0xd62839 : 0x3f8f4a, -0.8 + i * 0.4, 0.25, 0), Math.PI / 2), -0.4 + i * 0.2)), ...many(5, (i) => cyl(0.06, 0.06, 0.3, 0x3f8f4a, -0.8 + i * 0.4, 0.25, -0.9, 6))] },
  'in-tandoor': {
    parts: [cyl(2.6, 3.2, 4, CLAY, 0, 2, 0), turn(torus(2.5, 0.3, 0x8a4a2a, 0, 4, 0), Math.PI / 2), flat(cyl(2.2, 2.2, 0.05, 0x2a1a14, 0, 4.0, 0, 20)),
      ...many(4, (i) => turn(cyl(0.05, 0.05, 4.4, 0x9aa3ad, Math.cos(i * 1.6) * 0.9, 5.4, Math.sin(i * 1.6) * 0.9, 6), Math.cos(i) * 0.2, 0, Math.sin(i) * 0.2)),
      ...many(4, (i) => sized(ball(0.35, 0xd96b2b, Math.cos(i * 1.6) * 0.9, 6.0, Math.sin(i * 1.6) * 0.9), 1, 1.5, 1)), box(1.2, 1.0, 0.3, 0x2a1a14, 0, 0.6, 2.95), ...many(3, (i) => spin(turn(sized(ball(1.0, 0xe8c27a, 0, 2.3, 2.9), 1, 1.3, 0.12), -0.15), i * 0.8 - 0.8))],
  },
  'in-tiffin': {
    parts: [...many(4, (i) => [cyl(2.0, 2.0, 1.5, STEEL, 0, 0.8 + i * 1.6, 0), cyl(2.05, 2.05, 0.12, 0xa9b0b9, 0, 1.58 + i * 1.6, 0)]), dome(2.0, STEEL, 0, 7.2, 0),
      ...[-1, 1].map((s) => box(0.2, 7.2, 0.3, 0xa9b0b9, s * 2.15, 4.2, 0)), torus(1.2, 0.15, 0xa9b0b9, 0, 8.4, 0), ...[0.8, 2.4, 4.0, 5.6].map((y) => box(0.5, 0.3, 0.35, 0xa9b0b9, 2.2, y + 0.4, 0))],
  },
  'in-pot': {
    parts: [sized(ball(3.0, COPPER, 0, 2.6, 0), 1, 0.85, 1), cyl(2.3, 2.0, 0.9, COPPER, 0, 5.0, 0), turn(torus(2.3, 0.2, 0xd08a4c, 0, 5.45, 0), Math.PI / 2), flat(cyl(2.1, 2.1, 0.05, 0xe39b2d, 0, 5.3, 0, 20)),
      ...[-1, 1].map((s) => turn(torus(0.6, 0.15, COPPER, s * 3.1, 3.8, 0), 0, Math.PI / 2)), turn(cyl(0.1, 0.1, 5, 0x6b4a2b, 1.6, 6.4, 0.5, 8), 0.3, 0, -0.5), ball(0.4, 0xd62839, -0.6, 5.4, 0.6), ball(0.3, 0x3f8f4a, 0.4, 5.38, -0.8)],
  },
};

export const themes: Record<'india', ThemeData> = {
  india: {
    title: 'Indian Kitchen', sky: [0xffcf7a, 0xff8c42], puddle: 0xe39b2d,
    ground: [{ fill: 0xa8302b }, ...many(4, (i) => many(4, (j) => [{ ring: [i * 64 + 32, j * 64 + 32, 14] as [number, number, number], c: 0xf2b84b, w: 3 }, { dot: [i * 64 + 32, j * 64 + 32, 5] as [number, number, number], c: 0xffe0a3 },
      ...many(6, (k) => ({ dot: [i * 64 + 32 + Math.round(Math.cos(k * 1.047) * 22), j * 64 + 32 + Math.round(Math.sin(k * 1.047) * 22), 3] as [number, number, number], c: 0xf2b84b }))])).flat(2)],
    props: ['in-thali', 'in-naan', 'in-samosa', 'in-chai', 'in-spices', 'in-chili'], landmarks: ['in-tandoor', 'in-tiffin', 'in-pot'],
  },
};
