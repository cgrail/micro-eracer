import { building, flag, lamp, palm, potPlant, tree, wheels } from './common.ts';
import {
  type Color, type Paint, type PropData, type ThemeData, ball, box, cone, cyl, dome, flat, grp, lit, many, scatter, sign, sized, spin, torus, turn, wedge,
} from './kit.ts';

// At home round Heidelberg: SAP in Walldorf, the old town and its castle, the village where Hoffenheim trains, and
// Sinsheim's stadium and the museum with the supersonic jets on its roof.

const SAP = 0x0a6ed1, GOLD = 0xf0ab00, STONE = 0xb5533c, WHITE = 0xf4f1ea, SLATE = 0x3d4250, TSG = 0x1c63b7;
type R = [number, number, number, number];

/** Round cobbles in staggered rows. */
export const cobbles = (base: number, stones: number[], size = 32): Paint[] => [
  { fill: base },
  ...many(256 / size, (j) => many(256 / size + 1, (i) => ({ dot: [i * size + (j % 2) * (size / 2), j * size + size / 2, size * 0.42] as [number, number, number], c: stones[(i * 3 + j * 7) % stones.length] }))),
];

/** Grass mown in bands. */
export const stripes = (a: number, b: number, band = 32): Paint[] => [{ fill: a }, ...many(256 / band / 2, (i) => ({ rect: [i * band * 2, 0, band, 256] as R, c: b }))];

/** A half-timbered house: white walls, dark beams, a red roof. */
const timbered = (w: number, h: number, d: number, roof: Color = 0xb5402f): PropData['parts'] => [
  box(w, h, d, WHITE, 0, h / 2, 0),
  ...[0, 0.5, 1].map((t) => box(w + 0.05, 0.2, d + 0.05, 0x4a2f22, 0, 0.1 + t * (h - 0.2), 0)),
  ...many(5, (i) => box(0.2, h, d + 0.06, 0x4a2f22, -w / 2 + (i * w) / 4, h / 2, 0)),
  ...[-1, 1].map((s) => turn(box(0.18, h * 0.62, 0.1, 0x4a2f22, s * w * 0.25, h * 0.25, d / 2 + 0.04), 0, 0, s * 0.7)),
  ...[-1, 1].map((s) => box(0.9, 0.9, 0.1, 0x9fd3f0, s * w * 0.25, h * 0.75, d / 2 + 0.05)),
  turn(wedge(d + 0.8, h * 0.7, w + 0.6, roof, 0, h + h * 0.35, 0), 0, Math.PI / 2),
];

export const props: Record<string, PropData> = {
  // SAP, Walldorf
  'sap-chair': { pick: [SAP, 0x2b2f36, GOLD], parts: [...many(5, (i) => spin(box(0.25, 0.2, 1.3, 0x2b2f36, 0, 0.3, 0.65), (i * 2 * Math.PI) / 5)), cyl(0.14, 0.14, 1.1, 0x9aa3ad, 0, 0.9, 0, 8), box(1.8, 0.35, 1.7, 'pick', 0, 1.6, 0, 0.15), box(1.7, 2.0, 0.35, 'pick', 0, 2.7, -0.75, 0.15)] },
  'sap-desk': {
    parts: [box(4, 0.15, 1.8, 0xf2f2f2, 0, 1.6, 0), ...[-1.8, 1.8].map((x) => box(0.15, 1.6, 1.5, 0x9aa3ad, x, 0.8, 0)),
      ...[-0.85, 0.85].flatMap((x) => [turn(box(1.5, 0.95, 0.12, 0x2b2f36, x, 2.35, -0.4), 0, -x * 0.25), lit(turn(box(1.35, 0.8, 0.05, 0x5ea9ef, x, 2.35, -0.33), 0, -x * 0.25))]),
      box(0.15, 0.45, 0.15, 0x2b2f36, 0, 1.9, -0.5), box(1.2, 0.06, 0.4, 0x3a3f47, 0, 1.71, 0.3), cyl(0.25, 0.22, 0.5, GOLD, 1.5, 1.93, 0.4, 10)],
  },
  'sap-cooler': { parts: [box(1.4, 2.6, 1.4, 0xf2f4f7, 0, 1.3, 0, 0.15), cyl(0.6, 0.6, 1.8, 0x9fd3f0, 0, 3.5, 0), cyl(0.3, 0.6, 0.4, 0x9fd3f0, 0, 4.6, 0), box(0.5, 0.25, 0.3, SAP, 0, 1.9, 0.75)] },
  'sap-ficus': { parts: potPlant(3.8, 0xe8eef4, 0x3f8f4a) },
  'sap-whiteboard': {
    parts: [...[-1.8, 1.8].map((x) => box(0.12, 3.6, 0.12, 0x9aa3ad, x, 1.8, 0)), box(4, 2.4, 0.15, 0xffffff, 0, 2.6, 0),
      ...[[0.5, 3.2, 1.6, SAP], [-0.8, 2.6, 1.8, 0xe5383b], [0.9, 2.3, 1.0, 0x2a9d58], [-0.4, 2.0, 1.4, SAP]].map(([x, y, w, c]) => flat(box(w, 0.12, 0.05, c, x, y, 0.1)))],
  },
  'sap-tower': { parts: [...building(9, 14, 9, 0xe8eef4, SAP, 5, 3), box(9.4, 0.8, 9.4, GOLD, 0, 14.2, 0), box(5.4, 1.6, 5.4, 0xc9d3dd, 0, 15.3, 0), box(6, 0.3, 1.6, 0xc9d3dd, 0, 3.4, 5.3)] },
  'sap-sign': { parts: [...[-4.6, 4.6].map((x) => box(0.5, 5, 0.5, 0x9aa3ad, x, 2.5, 0)), sign(10, 2.6, 0.5, 'WALLDORF', SAP, 0xffffff, 0, 4.0, 0), box(10, 0.4, 0.55, GOLD, 0, 2.5, 0), flat(box(11, 0.3, 3, 0x7cc36b, 0, 0.15, 0))] },
  'sap-cafe': {
    parts: [box(8, 2.2, 2.4, 0x6b4a2b, 0, 1.1, 0, 0.1), box(8.4, 0.25, 2.8, 0xe8eef4, 0, 2.3, 0), box(2.2, 2, 1.6, 0x9aa3ad, -2.2, 3.4, -0.2, 0.15), box(2.2, 0.3, 1.6, GOLD, -2.2, 4.55, -0.2),
      ...many(4, (i) => cyl(0.3, 0.25, 0.6, 0xffffff, 0.5 + i * 0.9, 2.7, 0.5, 10)), sign(6, 1.2, 0.3, 'COFFEE', SAP, 0xffffff, 1.0, 6.2, -1),
      ...[-2.5, 2.5].map((x) => box(0.2, 4, 0.2, 0x9aa3ad, x + 1, 4.2, -1))],
  },

  // Heidelberg
  'hd-house': { pick: [0xb5402f, 0x8c3a2b, 0xc75b3a], parts: timbered(5, 4.4, 4, 'pick') },
  'hd-vines': { parts: [...[-3, 0, 3].map((x) => box(0.15, 2.4, 0.15, 0x6b4a2b, x, 1.2, 0)), box(6.4, 0.06, 0.06, 0x6b4a2b, 0, 2.1, 0), ...many(6, (i) => ball(0.6, 0x5a9a3d, -2.6 + i * 1.05, 1.6, 0)), ...many(5, (i) => sized(ball(0.3, 0x6a2c70, -2.2 + i * 1.05, 1.1, 0.35), 1, 1.4, 1))] },
  'hd-monkey': {
    parts: [box(2.4, 1.2, 2.4, 0xc9b9a3, 0, 0.6, 0, 0.1), sized(ball(0.9, 0x9c6b3a, 0, 2.0, 0), 1, 1.2, 0.9), ball(0.7, 0x9c6b3a, 0, 3.2, 0), ball(0.3, 0x9c6b3a, -0.65, 3.3, 0), ball(0.3, 0x9c6b3a, 0.65, 3.3, 0),
      sized(ball(0.35, 0xc79a6a, 0, 3.05, 0.55), 1.2, 0.8, 0.6), ball(0.1, 0x111111, -0.25, 3.35, 0.6), ball(0.1, 0x111111, 0.25, 3.35, 0.6), torus(0.45, 0.1, 0xd8b04a, 0.9, 2.6, 0.3), turn(box(0.25, 1.1, 0.25, 0x9c6b3a, 0.65, 2.2, 0.3), 0, 0, -0.5)],
  },
  'hd-pretzel': { parts: [grp([turn(sized(torus(1.2, 0.35, 0x8a4b1f, 0, 0, 0), 1, 0.8, 1), Math.PI / 2), turn(torus(0.55, 0.3, 0x8a4b1f, -0.55, 0, 0.1), Math.PI / 2), turn(torus(0.55, 0.3, 0x8a4b1f, 0.55, 0, 0.1), Math.PI / 2),
    ...many(7, (i) => flat(ball(0.07, 0xffffff, Math.cos(i) * 1.1, 0.33, Math.sin(i) * 0.9)))], 0, 0.36, 0)] },
  'hd-lantern': { parts: [...lamp(4.6, 0x24302a, 0xffe3a3), cone(0.5, 0.5, 0x24302a, 0, 4.75, 1.0, 4)] },
  'hd-tree': { parts: tree(6.5, 0x5a9a3d) },
  'hd-castle': {
    parts: [
      box(9, 6, 4.5, STONE, -1, 3, -1), ...many(5, (i) => box(0.9, 1.6, 0.3, 0x2a1f1c, -4.4 + i * 1.7, 4.2, 1.27)), ...many(5, (i) => box(0.9, 1.4, 0.3, 0x2a1f1c, -4.4 + i * 1.7, 1.8, 1.27)),
      // the broken top: walls of different heights
      ...[[-4.6, 7.4], [-2.6, 6.8], [-0.6, 7.8], [1.4, 6.6], [2.9, 7.2]].map(([x, h]) => box(1.4, h - 6, 4.5, STONE, x, 6 + (h - 6) / 2, -1)),
      cyl(2.4, 2.6, 9, STONE, 3.8, 4.5, 1.2), flat(cyl(1.9, 1.9, 0.1, 0x3a2a24, 3.8, 9.02, 1.2)), ...many(8, (i) => box(0.8, 0.8, 0.8, STONE, 3.8 + Math.cos((i * Math.PI) / 4) * 2.1, 9.4, 1.2 + Math.sin((i * Math.PI) / 4) * 2.1)),
      box(1, 2, 0.3, 0x2a1f1c, 3.8, 6, 3.7), cyl(1.5, 1.6, 4, STONE, -4.6, 2, 2.0),
    ],
  },
  'hd-gate': {
    parts: [
      ...[-2.6, 2.6].flatMap((x) => [cyl(1.7, 1.8, 9, WHITE, x, 4.5, 0), cone(2.0, 4.5, SLATE, x, 11.25, 0), ...many(3, (i) => box(0.5, 0.9, 0.2, 0x2a2a2a, x, 3 + i * 2.2, 1.75)), ball(0.25, GOLD, x, 13.7, 0)]),
      box(3.6, 7.5, 3, STONE, 0, 3.75, 0), box(2.2, 4, 3.2, 0x1a1414, 0, 2, 0), box(4, 1, 3.4, 0x8f3f2d, 0, 7.8, 0),
      box(13, 1, 4, STONE, 0, 0.5, 0), ...[-5.6, 5.6].map((x) => box(1.6, 2.2, 4, STONE, x, 1.1, 0)),
    ],
  },
  'hd-church': {
    parts: [
      box(5, 6, 10, STONE, 0, 3, -1.5), turn(wedge(5.6, 3.6, 10.4, 0x4a5160, 0, 7.8, -1.5), 0, 0, 0), ...many(4, (i) => box(0.25, 2.6, 1.2, 0x7fb2cf, 2.55, 3.4, -5 + i * 2.4)), ...many(4, (i) => box(0.25, 2.6, 1.2, 0x7fb2cf, -2.55, 3.4, -5 + i * 2.4)),
      box(3.4, 13, 3.4, STONE, 0, 6.5, 4.6), box(0.9, 2.4, 0.3, 0x2a1f1c, 0, 1.2, 6.32), box(1.4, 1.4, 0.2, 0xf2f2f2, 0, 10.5, 6.32),
      cyl(1.5, 1.7, 1.6, SLATE, 0, 13.8, 4.6), dome(1.5, SLATE, 0, 14.6, 4.6), cyl(0.5, 0.7, 1.4, SLATE, 0, 16.6, 4.6), sized(ball(0.7, SLATE, 0, 17.6, 4.6), 1, 1.3, 1), cone(0.3, 2.6, SLATE, 0, 19.3, 4.6), ball(0.2, GOLD, 0, 20.7, 4.6),
    ],
  },

  // Zuzenhausen
  'zz-hay': { parts: [turn(cyl(1.3, 1.3, 2.2, 0xe6c35c, 0, 1.3, 0), 0, 0, Math.PI / 2), ...[-0.6, 0.6].map((x) => turn(torus(1.31, 0.06, 0xc9a23f, x, 1.3, 0), 0, Math.PI / 2)), turn(cyl(1.1, 1.1, 2, 0xe6c35c, 0.4, 1.1, 2.4), Math.PI / 2, 0.4)] },
  'zz-tractor': {
    parts: [turn(cyl(1.3, 1.3, 0.8, 0x222222, -1.2, 1.3, 1.1, 14), Math.PI / 2), turn(cyl(1.3, 1.3, 0.8, 0x222222, -1.2, 1.3, -1.1, 14), Math.PI / 2), turn(cyl(0.7, 0.7, 0.5, 0x222222, 1.6, 0.7, 0.9, 12), Math.PI / 2), turn(cyl(0.7, 0.7, 0.5, 0x222222, 1.6, 0.7, -0.9, 12), Math.PI / 2),
      ...[1.15, -1.15].map((z) => turn(cyl(0.6, 0.6, 0.82, 0xf2c230, -1.2, 1.3, z, 10), Math.PI / 2)), box(3.2, 1.2, 1.4, 0x2f8f3a, 0.8, 1.6, 0, 0.2), box(1.8, 2.2, 1.9, 0x2f8f3a, -1.2, 2.7, 0, 0.15),
      box(1.6, 1.5, 1.95, 0xbfe6ff, -1.2, 3.0, 0), box(2.0, 0.2, 2.1, 0x2f8f3a, -1.2, 3.9, 0), cyl(0.12, 0.12, 1.6, 0x333333, 1.6, 2.8, 0.4, 8)],
  },
  'zz-ball': { parts: [ball(1.0, 0xffffff, 0, 1.0, 0), ...[[0, 1, 0.98], [0.85, 1.2, 0.5], [-0.85, 1.2, 0.5], [0.5, 1.85, 0], [-0.5, 1.85, 0], [0, 0.4, 0.8]].map(([x, y, z]) => sized(ball(0.3, 0x111111, x, y, z), 1, 1, 0.5))] },
  'zz-cones': { parts: [...[[0, 0], [1.6, 0.4], [-1.5, -0.3], [0.3, -1.6]].map(([x, z]) => cone(0.5, 1.0, 0xff8c1a, x, 0.5, z)), cyl(0.07, 0.07, 2.2, 0xffd60a, 2.4, 1.1, -1.2, 6), cyl(0.07, 0.07, 2.2, 0xffd60a, -2.4, 1.1, 1.2, 6)] },
  'zz-tree': { parts: [...tree(6), ...[[1.2, 4.6, 0.8], [-1.0, 4.0, 1.1], [0.4, 5.2, -1.2], [-1.4, 4.8, -0.4]].map(([x, y, z]) => ball(0.3, 0xe63946, x, y, z))] },
  'zz-flag': { parts: [...flag(6, TSG), flat(box(1.4, 0.25, 0.06, 0xffffff, 0.72, 5.5, 0))] },
  'zz-goal': {
    parts: [...[-3.6, 3.6].map((x) => box(0.25, 2.6, 0.25, 0xffffff, x, 1.3, 0)), box(7.45, 0.25, 0.25, 0xffffff, 0, 2.6, 0),
      ...[-3.6, 3.6].map((x) => box(0.12, 0.12, 2.2, 0xd8dde4, x, 2.5, -1.1)), ...many(9, (i) => flat(box(0.05, 2.5, 0.05, 0xd8dde4, -3.6 + i * 0.9, 1.25, -2.2))), ...many(4, (i) => flat(box(7.2, 0.05, 0.05, 0xd8dde4, 0, 0.5 + i * 0.6, -2.2))),
      box(7.2, 0.05, 2.2, 0xd8dde4, 0, 2.55, -1.1), flat(box(9, 0.05, 0.25, 0xffffff, 0, 0.03, 0.4))],
  },
  'zz-clubhouse': { parts: [box(10, 4.5, 6, 0xffffff, 0, 2.25, 0), box(10.4, 0.6, 6.4, TSG, 0, 4.8, 0), box(10, 1, 0.2, TSG, 0, 0.5, 3.05), sign(8, 1.2, 0.3, 'ZUZENHAUSEN', TSG, 0xffffff, 0, 3.6, 3.1),
    ...many(4, (i) => box(1.4, 1.2, 0.2, 0x9fd3f0, -3.6 + i * 2.4, 2.1, 3.06)), box(1.2, 2.2, 0.2, 0x4a3426, 4.2, 1.1, 3.08), ...flag(7, TSG).map((p) => grp([p], -4.4, 0, 4))] },
  'zz-church': {
    parts: [...timbered(5, 5, 8, 0x8c3a2b).map((p) => grp([p], 0, 0, -1.6)), box(3, 10, 3, WHITE, 0, 5, 3.6), box(1.2, 1.2, 0.2, 0x2a2a2a, 0, 8.3, 5.12), cone(2.3, 6, 0x8c3a2b, 0, 13, 3.6, 4), ball(0.25, GOLD, 0, 16.2, 3.6)],
  },

  // Sinsheim
  'si-oldtimer': {
    pick: [0xb3261e, 0xf2e3c6, 0x1d3b2a, 0x1b2a49],
    parts: [...wheels(4.4, 2.2, 0.62, 0x1a1a1a), ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => sized(ball(0.8, 'pick', sx * 1.1, 0.9, sz * 1.42), 0.55, 0.6, 1.1))),
      box(1.6, 1.0, 3.6, 'pick', 0, 1.3, 0, 0.3), box(1.5, 1.1, 1.6, 0x1a1a1a, 0, 2.3, -0.5, 0.2), box(1.55, 0.8, 1.45, 0xbfe6ff, 0, 2.3, -0.5), turn(cyl(0.45, 0.45, 0.3, 0xd8dde4, 0, 1.4, 1.95, 12), Math.PI / 2),
      ...[-0.5, 0.5].map((x) => lit(ball(0.22, 0xfff3b0, x, 1.7, 1.85))), box(2.4, 0.1, 3.0, 0x1a1a1a, 0, 0.55, 0)],
  },
  'si-barrel': { pick: [0x1c63b7, 0xc0392b, 0x2a9d58], parts: [cyl(0.8, 0.8, 2.0, 'pick', 0, 1.0, 0), ...[0.4, 1.6].map((y) => cyl(0.83, 0.83, 0.12, 0x333333, 0, y, 0)), cyl(0.8, 0.8, 2.0, 0x333333, 1.7, 1.0, 0.3), turn(cyl(0.8, 0.8, 2.0, 'pick', -1.2, 0.8, 1.3), Math.PI / 2, 0.5)] },
  'si-tyres': { parts: [...many(4, (i) => turn(torus(1.0, 0.4, 0x1a1a1a, 0, 0.4 + i * 0.8, 0), Math.PI / 2)), turn(torus(1.0, 0.4, 0x1a1a1a, 2.2, 1.4, 0.4), 0, 0.4)] },
  'si-plane': {
    pick: [0xe63946, 0xf2c230, 0x2f9bff],
    parts: [turn(cyl(0.45, 0.6, 4.2, 'pick', 0, 1.6, 0), Math.PI / 2), turn(cone(0.45, 1.0, 'pick', 0, 1.6, -2.6), -Math.PI / 2), box(6, 0.15, 1.2, 'pick', 0, 1.9, 0.3), box(2.2, 0.12, 0.7, 'pick', 0, 1.8, 2.2), box(0.12, 1.0, 0.8, 'pick', 0, 2.3, 2.2),
      box(0.1, 1.8, 0.25, 0x333333, 0, 1.6, -2.15), box(0.8, 0.6, 0.9, 0xbfe6ff, 0, 2.15, -0.4), ...[-0.9, 0.9].map((x) => cyl(0.06, 0.06, 1.3, 0x333333, x, 0.65, -0.3, 6)), ...[-0.9, 0.9].map((x) => turn(cyl(0.35, 0.35, 0.2, 0x111111, x, 0.35, -0.3, 10), 0, 0, Math.PI / 2))],
  },
  'si-palm': { parts: palm(6.5) },
  'si-cone': { parts: [...[[0, 0], [1.4, 0.6], [-1.3, 0.4]].map(([x, z]) => grp([box(0.9, 0.12, 0.9, 0x222222, 0, 0.06, 0), cone(0.4, 1.3, 0xff6b1a, 0, 0.75, 0), flat(cyl(0.27, 0.32, 0.2, 0xffffff, 0, 0.7, 0))], x, 0, z))] },
  'si-concorde': {
    // on a pylon, nose up, as on the museum's roof
    parts: [
      box(2, 5.2, 2, 0xc9ced6, 0, 2.6, 0, 0.2),
      turn(grp([
        turn(cyl(0.75, 0.75, 10, WHITE, 0, 0, 0), 0, 0, Math.PI / 2), turn(cone(0.75, 2.4, WHITE, 6.2, -0.12, 0), 0, 0, -Math.PI / 2 - 0.08), turn(cone(0.75, 1.2, WHITE, -5.6, 0, 0), 0, 0, Math.PI / 2),
        turn(wedge(9, 5, 0.3, WHITE, -1.2, -0.4, 0), -Math.PI / 2, 0, -Math.PI / 2), turn(wedge(1.6, 3, 0.25, WHITE, -4.2, 1.6, 0), 0, 0, 0.2),
        flat(box(8.6, 0.2, 1.52, 0x1b3f8f, 0.3, 0.1, 0)), ...[-1.4, 1.4].map((z) => box(3, 0.6, 0.8, 0xd8dde4, -2.4, -0.9, z)),
      ], 0, 6.2, 0), 0, 0, 0.32),
    ],
  },
  'si-arena': {
    parts: [
      flat(cyl(4.6, 4.6, 0.1, 0x4caf50, 0, 0.05, 0, 24)), flat(box(5, 0.02, 0.2, 0xffffff, 0, 0.11, 0)),
      // the stands round the pitch, raked outwards, under a white roof ring
      ...many(12, (i) => spin(turn(box(3.4, 4.6, 1.6, TSG, 0, 2.1, 5.6), 0.35), (i * Math.PI) / 6)),
      ...many(12, (i) => spin(box(3.0, 0.3, 0.6, 0xffffff, 0, 1.4, 4.9), (i * Math.PI) / 6 + 0.26)),
      turn(torus(6.4, 0.5, 0xffffff, 0, 4.9, 0), Math.PI / 2), ...many(4, (i) => spin(cyl(0.2, 0.2, 7, 0xd8dde4, 0, 3.5, 6.8, 8), (i * Math.PI) / 2 + Math.PI / 4)),
    ],
  },
  'si-museum': {
    parts: [
      box(11, 5.5, 7, 0xd8dde4, 0, 2.75, -1), box(11.2, 0.4, 7.2, 0xa8b0ba, 0, 5.7, -1), sign(8, 1.4, 0.3, 'TECHNIK MUSEUM', 0xc0392b, 0xffffff, 0, 4.4, 2.6), box(3, 3, 0.2, 0x7fb2cf, 0, 1.5, 2.55),
      box(0.8, 3, 0.8, 0x9aa3ad, 0, 7.2, -1),
      turn(grp([turn(cyl(0.6, 0.6, 9, WHITE, 0, 0, 0), 0, 0, Math.PI / 2), turn(cone(0.6, 2, WHITE, 5.5, 0, 0), 0, 0, -Math.PI / 2), turn(wedge(7, 4, 0.25, WHITE, -1, -0.3, 0), -Math.PI / 2, 0, -Math.PI / 2),
        turn(wedge(1.4, 2.4, 0.2, WHITE, -3.8, 1.3, 0), 0, 0, 0.2), flat(box(7, 0.18, 1.22, 0xc0392b, 0.5, 0.05, 0))], 0, 9, -1), 0, 0.4, 0.3),
    ],
  },
};

export const themes: Record<'sap' | 'heidelberg' | 'zuzenhausen' | 'sinsheim', ThemeData> = {
  sap: {
    title: 'SAP Walldorf', sky: [0xa8cff5, 0xe3eef9], puddle: 0x6b3e26,
    ground: [{ fill: 0x9aa7b5 }, ...many(4, (i) => many(4, (j) => ((i + j) % 2 ? [{ rect: [i * 64, j * 64, 64, 64] as R, c: 0x8f9dab }] : []))).flat() as Paint[],
      ...many(4, (i) => [{ rect: [i * 64, 0, 2, 256] as R, c: 0x7f8c99 }, { rect: [0, i * 64, 256, 2] as R, c: 0x7f8c99 }]).flat() as Paint[]],
    props: ['sap-chair', 'sap-desk', 'sap-cooler', 'sap-ficus', 'sap-whiteboard'], landmarks: ['sap-tower', 'sap-sign', 'sap-cafe'],
  },
  heidelberg: {
    title: 'Heidelberg', sky: [0x8ec9f0, 0xdcefff], puddle: 0x6f9fbf, clouds: true,
    ground: cobbles(0xa58b74, [0xc2a68b, 0xb3967b, 0xbca087, 0xa98d73]),
    props: ['hd-house', 'hd-house', 'hd-vines', 'hd-monkey', 'hd-pretzel', 'hd-lantern', 'hd-tree'], landmarks: ['hd-castle', 'hd-gate', 'hd-church'],
  },
  zuzenhausen: {
    title: 'Zuzenhausen', sky: [0x5aaef0, 0xcfeaff], puddle: 0x6b4a2b, clouds: true,
    ground: [...stripes(0x62ba4b, 0x58ad41), ...scatter(30, 97, 57, (x, y) => [{ rect: [x, y, 3, 7], c: 0x4b9a37 }])],
    props: ['zz-hay', 'zz-tractor', 'zz-ball', 'zz-cones', 'zz-tree', 'zz-flag'], landmarks: ['zz-goal', 'zz-clubhouse', 'zz-church'],
  },
  sinsheim: {
    title: 'Sinsheim', sky: [0x7fbcef, 0xdff0ff], puddle: 0x2b2b2b, clouds: true,
    ground: [{ fill: 0x6d7178 }, ...many(4, (i) => ({ rect: [i * 64 + 30, 0, 4, 120] as R, c: 0xe8e8e8 })), { rect: [0, 120, 256, 4], c: 0xe8e8e8 },
      ...scatter(6, 83, 149, (x, y) => [{ dot: [x, y, 7], c: 0x55585e }, { dot: [x + 5, y + 3, 4], c: 0x4c4f55 }])],
    props: ['si-oldtimer', 'si-oldtimer', 'si-barrel', 'si-tyres', 'si-plane', 'si-palm', 'si-cone'], landmarks: ['si-concorde', 'si-arena', 'si-museum'],
  },
};
