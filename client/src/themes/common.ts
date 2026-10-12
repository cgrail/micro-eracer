import { type Color, type Part, ball, box, cone, cyl, grp, lit, many, sized, spin, turn } from './kit.ts';

// Pieces several themes share. Each stands on y = 0 and faces +z.

/** A round tree: a trunk and a crown of balls. */
export const tree = (h: number, leaves: Color = 0x4caf50, trunk = 0x8a5a33): Part[] => [
  cyl(0.35, 0.5, h * 0.55, trunk, 0, h * 0.275),
  ball(h * 0.28, leaves, 0, h * 0.68), ball(h * 0.2, leaves, h * 0.18, h * 0.6, h * 0.1), ball(h * 0.2, leaves, -h * 0.16, h * 0.62, -h * 0.08),
];

/** A palm: a leaning trunk in rings and a crown of fronds. */
export const palm = (h: number, fronds: Color = 0x3fae49): Part[] => [
  ...many(5, (i) => cyl(0.32 - i * 0.03, 0.38 - i * 0.03, h / 5 + 0.05, 0x9b6b3d, i * 0.12, (i + 0.5) * (h / 5), 0, 8)),
  // each frond droops out from the crown (turned about x), then the crown spreads them round (about y)
  ...many(7, (i) => grp([spin(turn(grp([sized(cone(0.6, 4, fronds, 0, 2, 0, 4), 1, 1, 0.35)]), Math.PI / 2 + 0.5), (i * 2 * Math.PI) / 7)], 0.6, h - 0.4, 0)),
  ball(0.3, 0x6b4a2b, 0.6, h - 0.3, 0.3), ball(0.3, 0x6b4a2b, 0.4, h - 0.35, -0.3),
];

/** A street lamp: a pole, an arm and a lit lamp. */
export const lamp = (h: number, pole = 0x2b2f36, light = 0xfff3b0): Part[] => [
  cyl(0.12, 0.18, h, pole, 0, h / 2, 0, 8), box(0.25, 0.2, 1.2, pole, 0, h, 0.5), lit(box(0.6, 0.25, 0.6, light, 0, h - 0.2, 1.0)),
];

/** A box of a building with a grid of windows on all four sides. */
export function building(w: number, h: number, d: number, wall: Color, window: Color, rows: number, cols: number, glow = false): Part[] {
  const pane = (p: Part) => (glow ? lit(p) : p);
  const ww = (w / cols) * 0.5, wd = (d / cols) * 0.5, wh = (h / rows) * 0.5;
  return [
    box(w, h, d, wall, 0, h / 2, 0),
    ...many(rows, (r) => many(cols, (c) => {
      const y = (r + 0.5) * (h / rows), x = (c + 0.5 - cols / 2) * (w / cols), z = (c + 0.5 - cols / 2) * (d / cols);
      return [pane(box(ww, wh, 0.1, window, x, y, d / 2 + 0.03)), pane(box(ww, wh, 0.1, window, x, y, -d / 2 - 0.03)),
        pane(box(0.1, wh, wd, window, w / 2 + 0.03, y, z)), pane(box(0.1, wh, wd, window, -w / 2 - 0.03, y, z))];
    })),
  ];
}

/** Four wheels for a body `len` long and `w` wide, lying across it. */
export const wheels = (len: number, w: number, r = 0.45, tyre = 0x222222): Part[] =>
  [-1, 1].flatMap((sx) => [-1, 1].map((sz) => turn(cyl(r, r, 0.35, tyre, sx * (w / 2), r, sz * len * 0.32, 12), 0, 0, Math.PI / 2)));

/** A car or van: a body, a cabin with windows, and wheels; it drives along z. */
export const vehicle = (len: number, w: number, h: number, paint: Color, cabin: Color = 0xbfe6ff, cabinLen = 0.5): Part[] => [
  ...wheels(len, w),
  box(w, h * 0.45, len, paint, 0, 0.45 + h * 0.225, 0, 0.2),
  box(w * 0.9, h * 0.4, len * cabinLen, paint, 0, 0.45 + h * 0.65, -len * 0.05, 0.2),
  box(w * 0.92, h * 0.25, len * cabinLen * 0.9, cabin, 0, 0.45 + h * 0.67, -len * 0.05),
];

/** A little figure: legs, a body in `shirt`, a head. */
export const figure = (shirt: Color, skin = 0xffd2b0, legs = 0x2b3a67, h = 1.8): Part[] => [
  box(h * 0.22, h * 0.45, h * 0.14, legs, 0, h * 0.225), box(h * 0.28, h * 0.35, h * 0.16, shirt, 0, h * 0.62, 0, 0.05), ball(h * 0.12, skin, 0, h * 0.9),
];

/** A plant in a pot. */
export const potPlant = (h: number, pot: Color = 0xc96f3b, leaves: Color = 0x3d9a3d): Part[] => [
  cyl(h * 0.18, h * 0.13, h * 0.3, pot, 0, h * 0.15), ball(h * 0.22, leaves, 0, h * 0.5), ball(h * 0.18, leaves, h * 0.14, h * 0.62, 0.1), ball(h * 0.16, leaves, -h * 0.12, h * 0.7, -0.1),
];

/** A flag on a pole, flying towards +x. */
export const flag = (h: number, cloth: Color, pole = 0xd8dde4): Part[] => [cyl(0.08, 0.1, h, pole, 0, h / 2, 0, 8), box(1.4, 0.9, 0.05, cloth, 0.72, h - 0.5, 0)];
