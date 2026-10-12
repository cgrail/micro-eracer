import { building, figure, flag, lamp, palm, tree, wheels } from './common.ts';
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
  // SAP's campus in Walldorf: lawns and paths, the logo by the entrance, the marble ball, WDF01 and the star buildings
  'sap-tree': { parts: tree(7, 0x4f9a3d) },
  'sap-hedge': { parts: [box(5.4, 1.4, 1.4, 0x3f8a3a, 0, 0.7, 0, 0.5), box(1.4, 1.4, 3.6, 0x3f8a3a, 2.0, 0.7, 2.3, 0.5)] },
  'sap-bench': { parts: [box(3, 0.15, 0.9, 0x8a5a33, 0, 1, 0), box(3, 0.9, 0.12, 0x8a5a33, 0, 1.6, -0.45), ...[-1.3, 1.3].flatMap((x) => [box(0.15, 1, 0.15, 0x5b6470, x, 0.5, 0.3), box(0.15, 1.6, 0.15, 0x5b6470, x, 0.8, -0.4)])] },
  'sap-bikes': {
    parts: [box(0.12, 0.12, 4.2, 0x9aa3ad, 0.9, 0.7, 0), ...[-1.4, 0, 1.4].flatMap((z) => [torus(0.55, 0.07, 0x222222, -0.6, 0.55, z), torus(0.55, 0.07, 0x222222, 0.6, 0.55, z),
      box(1.2, 0.1, 0.1, SAP, 0, 1.0, z), box(0.1, 0.5, 0.1, SAP, -0.4, 1.2, z), box(0.4, 0.1, 0.25, 0x222222, -0.4, 1.5, z), box(0.08, 0.08, 0.6, 0x222222, 0.55, 1.35, z), box(0.1, 0.45, 0.1, SAP, 0.55, 1.12, z)])],
  },
  'sap-flag': { parts: [-2.2, 0, 2.2].flatMap((x) => [cyl(0.08, 0.1, 7, 0xd8dde4, x, 3.5, 0, 8), sign(1.5, 1.0, 0.05, 'SAP', SAP, 0xffffff, x + 0.78, 6.4, 0)]) },
  'sap-lamp': { parts: lamp(5, 0x5b6470, 0xfff3b0) },
  'sap-logo': {
    // the logo on a plinth: a blue board cut away on the slant at its right, and SAP across it in white on both faces
    parts: [box(8.4, 1, 2.4, 0xd8dde4, 0, 0.5, 0, 0.1), box(5.6, 3.4, 0.6, SAP, -0.8, 2.7, 0), turn(wedge(3.2, 3.4, 0.6, SAP, 2.0, 2.7, 0), 0, 0, Math.PI),
      sign(5, 2.2, 0.66, 'SAP', SAP, 0xffffff, -0.8, 2.75, 0), flat(box(10, 0.06, 4.6, 0x7cc36b, 0, 0.03, 0))],
  },
  'sap-ball': {
    // the marble ball, floating on a film of water in its granite bowl, its veins round it
    parts: [cyl(4.2, 4.4, 0.9, 0x8f959c, 0, 0.45, 0, 24), flat(cyl(3.8, 3.8, 0.1, 0x7fbfe0, 0, 0.92, 0, 24)), cyl(1.5, 1.8, 1.0, 0x5b6470, 0, 1.2, 0, 20),
      ball(2.4, 0xefebe3, 0, 4.0, 0), turn(torus(2.42, 0.05, 0xa9a49a, 0, 4.0, 0), 0.6, 0, 0.3), turn(torus(2.42, 0.04, 0xb8b2a8, 0, 4.0, 0), 1.3, 0.8), turn(torus(2.42, 0.05, 0xa9a49a, 0, 4.0, 0), 0.2, 1.7, 1.1),
      flat(turn(torus(1.75, 0.09, 0xffffff, 0, 1.72, 0), Math.PI / 2)), ...many(4, (i) => box(1.4, 0.45, 0.6, 0x8f959c, Math.cos(i * 1.571 + 0.785) * 5.6, 0.22, Math.sin(i * 1.571 + 0.785) * 5.6))],
  },
  'sap-wdf01': {
    // WDF01, the main building: a long block with the name over its door, a glass hall in front, the logo on the roof
    parts: [flat(box(22, 0.06, 20, 0xd8d3c8, 0, 0.03, 0)), grp(building(24, 11, 9, 0xeef2f6, SAP, 4, 6), 0, 0, -4), box(24.4, 0.6, 9.4, 0xc9d3dd, 0, 11.3, -4),
      box(9, 8, 6, 0x9fd3f0, -5, 4, 3.4), box(9.4, 0.4, 6.4, 0xd8dde4, -5, 8.2, 3.4), box(5, 0.3, 3, 0xd8dde4, 6, 3.6, 2.2), ...[3.8, 8.2].map((x) => cyl(0.12, 0.12, 3.5, 0xd8dde4, x, 1.75, 3.4, 8)),
      sign(7, 1.7, 0.25, 'WDF01', SAP, 0xffffff, 6, 7.8, 0.65), box(4.2, 2.2, 0.4, SAP, 7, 12.8, -4), sign(3.2, 1.4, 0.46, 'SAP', SAP, 0xffffff, 6.6, 12.8, -4),
      ...many(4, (i) => grp(tree(6, 0x4f9a3d), -9 + i * 6, 0, 8.5))],
  },
  'sap-star': {
    // one of the star buildings: three wings round a round glass core
    parts: [flat(cyl(15, 15, 0.06, 0xd8d3c8, 0, 0.03, 0, 24)), cyl(5, 5, 13, 0x9fd3f0, 0, 6.5, 0, 16), cyl(5.3, 5.3, 0.5, 0xd8dde4, 0, 13.25, 0, 16),
      ...many(3, (i) => spin(grp([...building(6.4, 12, 9, 0xf2efe8, SAP, 4, 3), box(6.8, 0.5, 9.4, 0xd8dde4, 0, 12.25, 0)], 0, 0, 9), (i * 2 * Math.PI) / 3 + Math.PI / 3))],
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
    // the castle ruin on its hill: the roofless Ottheinrich façade, the Friedrich building with its roof, the bell tower,
    // and the powder tower that was blown up, a great piece of it lying where it fell
    parts: [sized(dome(14.5, 0x5a8f3a, 0, 0, 0), 1, 0.3, 0.9), flat(sized(dome(13, 0x4f8233, 0, 0.05, 0), 1, 0.32, 0.88)),
      box(13, 12, 1.4, STONE, -1.5, 9, 2.5), ...many(3, (r) => many(5, (i) => box(1.2, 1.8, 0.2, 0x2a1f1c, -6.3 + i * 2.4, 6.5 + r * 3.2, 3.25))),
      ...many(4, (i) => box(0.6, 1.2, 0.3, 0xd9b38f, -5.1 + i * 2.4, 8.1, 3.3)), ...[[-7.2, 15.6], [-4.6, 15.0], [-1.8, 16.3], [1.2, 15.2], [3.9, 16.0]].map(([x, y]) => box(2.6, y - 15 + 1.4, 1.4, STONE, x, 15 + (y - 15) / 2, 2.5)),
      box(10, 11, 6.5, 0xa84c37, 4.5, 7.5, -3.5), turn(wedge(6.9, 4, 10.2, SLATE, 4.5, 15, -3.5), 0, Math.PI / 2), ...many(2, (r) => many(4, (i) => box(1.1, 1.6, 0.2, 0x2a1f1c, 1.2 + i * 2.2, 6.5 + r * 3.2, -0.15))),
      cyl(3.4, 3.6, 9, STONE, -8, 7.8, -4.5), flat(cyl(2.8, 2.8, 0.1, 0x3a2a24, -8, 12.32, -4.5)), ...many(6, (i) => box(1.1, 0.9 + (i % 3) * 0.7, 1.1, STONE, -8 + Math.cos(i * 0.7) * 3, 12.7 + (i % 3) * 0.35, -4.5 + Math.sin(i * 0.7) * 3)),
      turn(box(5, 6, 3.2, STONE, -10.5, 4.5, 1.2), 0.45, 0.4, 0.5), cyl(2, 2.2, 15, 0xa84c37, 9, 10.7, 3.5, 8), ...many(4, (i) => box(0.9, 1.2, 0.9, 0xa84c37, 9 + Math.cos(i * 1.571) * 1.6, 18.6, 3.5 + Math.sin(i * 1.571) * 1.6)),
      box(6, 4, 1.2, STONE, -5, 5, -8), box(1.2, 4, 7, STONE, 11, 4.6, -4), ...many(6, (i) => ball(1.6 + (i % 3) * 0.4, 0x4f8233, -9.6 + i * 3.84, 2.0, 8 - (i % 2) * 2))],
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
  'zz-pitch': {
    // a training pitch of the Hoffenheim club: mown stripes, its lines, two goals and a few players at practice
    parts: [flat(box(25, 0.06, 17, 0x4fae42, 0, 0.03, 0)), ...many(4, (i) => flat(box(2.75, 0.07, 15, 0x47a03a, -8.25 + i * 5.5, 0.035, 0))),
      ...[[0, 7.5, 22, 0.15], [0, -7.5, 22, 0.15], [-11, 0, 0.15, 15], [11, 0, 0.15, 15], [0, 0, 0.15, 15], [-8.5, 0, 0.15, 7], [8.5, 0, 0.15, 7], [-9.75, 3.5, 2.5, 0.15], [-9.75, -3.5, 2.5, 0.15], [9.75, 3.5, 2.5, 0.15], [9.75, -3.5, 2.5, 0.15]]
        .map(([x, z, w, d]) => flat(box(w, 0.08, d, 0xffffff, x, 0.05, z))), flat(turn(torus(2.4, 0.08, 0xffffff, 0, 0.06, 0), Math.PI / 2)),
      ...[-1, 1].flatMap((k) => [box(0.15, 2.2, 0.15, 0xffffff, k * 11.6, 1.1, -1.6), box(0.15, 2.2, 0.15, 0xffffff, k * 11.6, 1.1, 1.6), box(0.15, 0.15, 3.35, 0xffffff, k * 11.6, 2.2, 0),
        flat(box(0.05, 2.1, 3.2, 0xd8dde4, k * 12.5, 1.05, 0))]),
      ...[[-5, 2], [-2, -3], [3, 1], [6.5, -2.5], [-8, -1]].map(([x, z]) => grp(figure(TSG, 0xffd2b0, 0xffffff, 1.8), x, 0, z)), ball(0.25, 0xffffff, 0.5, 0.25, 1.2),
      ...[-6, -3, 0, 3].map((x) => cone(0.25, 0.5, 0xff8c1a, x, 0.25, -6))],
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
  'si-stadium': {
    // the TSG's stadium: an oval of blue stands under a white roof ring, white fins round it, the name over the gate
    parts: [sized(grp([
      flat(cyl(12, 12, 0.1, 0x4caf50, 0, 0.05, 0, 32)), ...many(24, (i) => spin(turn(box(4.2, 6.5, 5.5, TSG, 0, 3.4, 14.5), 0.45), (i * Math.PI) / 12)),
      ...many(24, (i) => spin(box(0.6, 9.5, 0.6, 0xf2f4f7, 0, 4.75, 17.6), (i * Math.PI) / 12 + 0.13)), turn(torus(16.2, 1.6, 0xffffff, 0, 10.2, 0), Math.PI / 2),
      ...many(8, (i) => spin(lit(box(2.4, 0.5, 0.8, 0xfffbe0, 0, 9.4, 14.8)), (i * Math.PI) / 4)),
    ]), 1.25, 1, 1),
      flat(box(0.15, 0.08, 16, 0xffffff, 0, 0.11, 0)), flat(turn(torus(2.6, 0.08, 0xffffff, 0, 0.11, 0), Math.PI / 2)),
      flat(box(26, 0.08, 0.15, 0xffffff, 0, 0.11, 8)), flat(box(26, 0.08, 0.15, 0xffffff, 0, 0.11, -8)),
      sign(16, 2.2, 0.4, 'TSG HOFFENHEIM', TSG, 0xffffff, 0, 7.4, 18.3), box(8, 3.6, 1.2, TSG, 0, 1.8, 18.6), lit(box(6, 2.6, 0.1, 0xfff3b0, 0, 1.5, 19.25))],
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
    title: 'SAP Walldorf', sky: [0x8ec5f2, 0xdcecf9], puddle: 0x6fa8dc, clouds: true,
    // lawn crossed by paved paths
    ground: [...stripes(0x7cc36b, 0x74ba62), { rect: [0, 108, 256, 40], c: 0xd8d3c8 }, { rect: [108, 0, 40, 256], c: 0xd8d3c8 },
      ...[106, 146].flatMap((v) => [{ rect: [0, v, 256, 2] as R, c: 0xb9b3a6 }, { rect: [v, 0, 2, 256] as R, c: 0xb9b3a6 }])],
    props: ['sap-tree', 'sap-tree', 'sap-hedge', 'sap-bench', 'sap-bikes', 'sap-flag', 'sap-lamp'], landmarks: ['sap-logo', 'sap-ball'],
    big: [['sap-wdf01', 2], ['sap-star', 2], ['sap-star', 2]],
  },
  heidelberg: {
    title: 'Heidelberg', sky: [0x8ec9f0, 0xdcefff], puddle: 0x6f9fbf, clouds: true,
    ground: cobbles(0xa58b74, [0xc2a68b, 0xb3967b, 0xbca087, 0xa98d73]),
    props: ['hd-house', 'hd-house', 'hd-vines', 'hd-monkey', 'hd-pretzel', 'hd-lantern', 'hd-tree'], landmarks: ['hd-church'], big: [['hd-castle', 2]],
    // the Neckar, crossed on the Alte Brücke's red sandstone arches, through its gate
    water: { color: 0x5f8fae, bank: 0x6f9a4a, width: [16, 30], bridge: 'arches', rail: STONE, gate: true },
  },
  zuzenhausen: {
    title: 'Zuzenhausen', sky: [0x5aaef0, 0xcfeaff], puddle: 0x6b4a2b, clouds: true,
    ground: [...stripes(0x62ba4b, 0x58ad41), ...scatter(30, 97, 57, (x, y) => [{ rect: [x, y, 3, 7], c: 0x4b9a37 }])],
    props: ['zz-hay', 'zz-tractor', 'zz-ball', 'zz-cones', 'zz-tree', 'zz-flag'], landmarks: ['zz-clubhouse', 'zz-church'], big: [['zz-pitch', 2], ['zz-pitch', 2]],
    // the Elsenz, a little river, crossed on a plain bridge with green railings
    water: { color: 0x6b8f9e, bank: 0x5a8f3a, width: [8, 14], bridge: 'beam', rail: 0x2f8f3a },
  },
  sinsheim: {
    title: 'Sinsheim', sky: [0x7fbcef, 0xdff0ff], puddle: 0x2b2b2b, clouds: true,
    ground: [{ fill: 0x6d7178 }, ...many(4, (i) => ({ rect: [i * 64 + 30, 0, 4, 120] as R, c: 0xe8e8e8 })), { rect: [0, 120, 256, 4], c: 0xe8e8e8 },
      ...scatter(6, 83, 149, (x, y) => [{ dot: [x, y, 7], c: 0x55585e }, { dot: [x + 5, y + 3, 4], c: 0x4c4f55 }])],
    props: ['si-oldtimer', 'si-oldtimer', 'si-barrel', 'si-tyres', 'si-plane', 'si-palm', 'si-cone'], landmarks: ['si-museum', 'si-concorde'], big: [['si-stadium', 3]],
  },
};
