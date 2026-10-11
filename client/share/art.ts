/**
 * The art for shared links, drawn as SVG in code like everything else: the 1200 × 630 card that Slack, Teams, X and
 * WhatsApp show under a link to the game, and the square icon for browser tabs and home screens. `plugin.ts` turns
 * both into PNGs at build time. Top-down E-Cars race up a road in the game's comic look (Bangers, black outlines,
 * the HUD's colours and the Seat colours).
 */
const INK = '#1b1410', CREAM = '#ffe9c9', YELLOW = '#ffd60a', RED = '#ff4d4d', GLASS = '#1d2b45', ROAD = '#51565f', GREEN = '#39e46b';
const FONT = `font-family="Bangers" letter-spacing="1"`;
const r1 = (n: number) => Math.round(n * 10) / 10;

export const CARD = { width: 1200, height: 630 };
export const ICON = 192;

type Pose = { x: number; y: number; deg: number };

/** The road's centre line, a cubic Bézier from the bottom left to the top right, and a point on it with its heading. */
const P = [[240, 760], [420, 470], [600, 380], [1320, 110]];
function along(t: number): Pose {
  const u = 1 - t, w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t], d = [-3 * u * u, 3 * u * u - 6 * u * t, 6 * u * t - 3 * t * t, 3 * t * t];
  const sum = (k: number[], i: number) => k.reduce((s, c, j) => s + c * P[j][i], 0);
  return { x: sum(w, 0), y: sum(w, 1), deg: (Math.atan2(sum(d, 1), sum(d, 0)) * 180) / Math.PI };
}
const place = (p: Pose, body: string, side = 0) =>
  `<g transform="translate(${r1(p.x + side * Math.sin((p.deg * Math.PI) / 180))} ${r1(p.y - side * Math.cos((p.deg * Math.PI) / 180))}) rotate(${r1(p.deg)})">${body}</g>`;

const rect = (x: number, y: number, w: number, h: number, rx: number, fill: string, stroke = 4, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${stroke ? ` stroke="${INK}" stroke-width="${stroke}"` : ''}${extra}/>`;
const text = (s: string, x: number, y: number, size: number, fill: string, stroke: number, extra = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" ${FONT} fill="${fill}" stroke="${INK}" stroke-width="${stroke}" stroke-linejoin="round" paint-order="stroke"${extra}>${s}</text>`;
/** A star-shaped comic burst of `n` points around (0, 0). */
function burst(n: number, outer: number, inner: number, fill: string, wobble = 0) {
  const pts = Array.from({ length: n * 2 }, (_, i) => {
    const a = (i * Math.PI) / n, rad = i % 2 ? inner : outer * (1 - wobble * ((i * 7) % 3) / 3);
    return `${r1(Math.cos(a) * rad)},${r1(Math.sin(a) * rad)}`;
  });
  return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`;
}
const BOLT = 'M8,-30 L-12,4 L1,4 L-6,30 L14,-6 L1,-6 Z';
const bolt = (fill: string, stroke: number) => `<path d="${BOLT}" fill="${fill}" stroke="${INK}" stroke-width="${stroke}" stroke-linejoin="round"/>`;

type Kind = 'roadster' | 'suv' | 'microbus';
/** A top-down E-Car facing +x, centred on its middle; `num` puts a racing number on it. */
function car(kind: Kind, paint: string, num?: { n: number; deg: number }) {
  const len = kind === 'microbus' ? 146 : 150, h = len / 2, b = kind === 'roadster' ? 38 : 41, axle = kind === 'suv' ? 48 : 46;
  let out = rect(-h + 8, -b + 12, len, b * 2, 24, INK, 0, ' opacity="0.22"');
  for (const ax of [axle, -axle]) for (const s of [-1, 1]) out += rect(ax - 18, s * (b - 3) - 9, 36, 18, 6, '#1a1a1a', 3);
  // bodywork with a shine along one side, tail lights and headlights
  out += rect(-h, -b, len, b * 2, 26, paint, 5) + `<path d="M${-h + 24},${-b + 10} L${h - 34},${-b + 10}" stroke="#fff" stroke-opacity="0.5" stroke-width="6" stroke-linecap="round"/>`;
  for (const s of [-1, 1]) {
    out += rect(-h + 1, s * (b - 16) - 6, 6, 12, 2, '#ff3b3b', 0);
    out += `<ellipse cx="${h - 8}" cy="${s * (b - 14)}" rx="6" ry="9" fill="#fff6b0" stroke="${INK}" stroke-width="3"/>`;
  }
  if (kind === 'roadster') {
    // glass canopy set back, a spoiler across the tail and twin stripes up the bonnet
    out += `<ellipse cx="-10" cy="0" rx="32" ry="27" fill="${GLASS}" stroke="${INK}" stroke-width="4"/>`;
    out += `<path d="M-30,-14 Q-14,-24 4,-20" stroke="#fff" stroke-opacity="0.7" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    out += rect(-h - 4, -b + 2, 16, b * 2 - 4, 5, paint, 4) + rect(26, -12, 46, 7, 2, '#fff', 0) + rect(26, 5, 46, 7, 2, '#fff', 0);
  } else if (kind === 'suv') {
    out += rect(-50, -35, 92, 70, 16, GLASS, 4) + rect(-44, -30, 62, 60, 12, paint, 4);
    out += [-14, 14].map((y) => `<path d="M-36,${y} L10,${y}" stroke="#fafafa" stroke-width="5" stroke-linecap="round"/>`).join('');
  } else {
    // the Microbus: a white roof over a band of glass, the paint showing at the nose
    out += rect(-66, -36, 118, 72, 16, GLASS, 4) + rect(-62, -31, 102, 62, 13, '#fafafa', 4);
    out += [-36, -10, 16].map((x) => rect(x, -16, 18, 32, 4, '#e8e2d6', 0)).join('');
  }
  if (num) out += `<g transform="translate(46 0) rotate(${r1(-num.deg)})"><circle r="18" fill="#fff" stroke="${INK}" stroke-width="4"/>${text(String(num.n), 0, 11, 32, INK, 0, ' text-anchor="middle"')}</g>`;
  return out;
}

/** Comic speed lines streaming off the back of something `len` long. */
const speed = (len: number, lines: [number, number][]) =>
  lines.map(([y, l]) => `<path d="M${-len / 2 - 14},${y} L${-len / 2 - 14 - l},${y}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`).join('');

/** A Battery, standing upright with a green glow, like the ones on the Track. */
const battery = () =>
  `<circle r="46" fill="#8dff9e" opacity="0.45"/>` + rect(-12, -40, 24, 12, 4, '#c9ced6', 4) + rect(-24, -32, 48, 66, 10, GREEN, 5) +
  rect(-26, -6, 52, 16, 2, '#fff', 4) + `<g transform="translate(0 2) scale(0.55)">${bolt(YELLOW, 6)}</g>`;

/** An Item Box: the rainbow cube with its question mark. */
const itemBox = () =>
  `<defs><linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1">${['#ff4d4d', '#ffd60a', '#39e46b', '#2f9bff', '#a66cff']
    .map((c, i) => `<stop offset="${i / 4}" stop-color="${c}"/>`).join('')}</linearGradient></defs>` +
  rect(-34, -28, 68, 68, 12, INK, 0, ' opacity="0.22"') + rect(-40, -40, 80, 80, 14, 'url(#rainbow)', 6) + text('?', 0, 26, 74, '#fff', 8, ' text-anchor="middle"');

/** The road: an outline, red and white kerbs, the tarmac and a dashed centre line, all strokes of one path. */
function road() {
  const d = `M${P[0]} C${P[1]} ${P[2]} ${P[3]}`;
  const layer = (w: number, color: string, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}"${extra}/>`;
  return `<g transform="translate(10 14)">${layer(206, INK, ' opacity="0.2"')}</g>` + layer(206, INK) + layer(194, '#fff') +
    layer(194, '#ff3b3b', ' stroke-dasharray="34 34"') + layer(166, INK) + layer(160, ROAD) + layer(7, '#fff3b0', ' stroke-dasharray="44 40"');
}

/** A comic sunburst: `n` rays out of (cx, cy), as one path. */
function rays(cx: number, cy: number, n: number, reach: number, fill: string) {
  const at = (a: number) => `${r1(cx + Math.cos(a) * reach)},${r1(cy + Math.sin(a) * reach)}`;
  const d = Array.from({ length: n }, (_, i) => `M${cx},${cy} L${at((i * 2 * Math.PI) / n)} L${at(((i * 2 + 1) * Math.PI) / n)} Z`).join(' ');
  return `<path d="${d}" fill="${fill}"/>`;
}

/** Rays from behind the title and a halftone screen that thickens towards the edges: a comic cover's background. */
function backdrop(w: number, h: number, cx: number, cy: number) {
  return `<defs><pattern id="dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2.6" fill="${INK}"/></pattern>` +
    `<radialGradient id="fade" cx="${cx / w}" cy="${cy / h}" r="1"><stop offset="0.3" stop-color="#fff" stop-opacity="0"/><stop offset="0.9" stop-color="#fff" stop-opacity="0.16"/></radialGradient>` +
    `<mask id="edges"><rect width="${w}" height="${h}" fill="url(#fade)"/></mask></defs>` +
    `<rect width="${w}" height="${h}" fill="${CREAM}"/>${rays(cx, cy, 28, Math.hypot(w, h), '#ffd9a0')}` +
    `<rect width="${w}" height="${h}" fill="url(#dots)" mask="url(#edges)"/>`;
}

export function cardSvg() {
  const { width: w, height: h } = CARD;
  const bus = along(0.27), suv = along(0.49), roadster = along(0.73), zap = along(0.61);
  const title =
    `<g transform="rotate(-5 300 170)">` +
    `<g transform="translate(9 9)">${text('MICRO', 66, 158, 132, INK, 14)}${text('E-RACER', 48, 318, 190, INK, 14)}</g>` +
    `${text('MICRO', 66, 158, 132, YELLOW, 14)}${text('E-RACER', 48, 318, 190, YELLOW, 14)}` +
    `<g transform="translate(392 104) rotate(14) scale(1.7)">${bolt('#2f9bff', 5)}</g></g>`;
  const caption =
    `<g transform="translate(56 392) rotate(-2)">${rect(8, 8, 400, 64, 12, INK, 0)}${rect(0, 0, 400, 64, 12, '#fffdf6', 5)}` +
    `${text('TINY E-CARS. BIG CHAOS.', 200, 47, 40, INK, 0, ' text-anchor="middle"')}</g>`;
  const badge =
    `<g transform="translate(1056 500) rotate(-8)"><g transform="translate(8 10)">${burst(16, 130, 100, INK)}</g>${burst(16, 130, 100, RED, 0.12)}` +
    `${text('RACE NOW!', 0, -2, 56, YELLOW, 10, ' text-anchor="middle"')}${text('in your browser', 0, 42, 30, '#fff', 7, ' text-anchor="middle"')}</g>`;
  const zigzag = 'M-40,0 L-14,-14 L-4,6 L22,-10 L44,0';
  const shot =
    place(zap, [[16, INK], [8, '#fff15c']].map(([sw, c]) => `<path d="${zigzag}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`).join(''), -10) +
    `<g transform="translate(${r1(zap.x + 40)} ${r1(zap.y + 116)}) rotate(-10)">${burst(12, 70, 46, '#fff')}${text('ZAP!', 0, 16, 46, '#2f9bff', 0, ' text-anchor="middle"')}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    backdrop(w, h, 300, 210) + road() +
    place(along(0.92), battery(), 20) +
    `<g transform="translate(150 560) rotate(-10)">${itemBox()}</g>` +
    place(bus, speed(146, [[-30, 60], [0, 96], [30, 60]]) + car('microbus', '#1fd1b2'), -24) +
    place(suv, speed(150, [[-24, 80], [20, 110]]) + car('suv', '#2f9bff'), 24) +
    place(roadster, speed(150, [[-30, 70], [30, 90]]) + car('roadster', RED, { n: 1, deg: roadster.deg }) +
      `<ellipse rx="104" ry="70" fill="#7fd6ff" fill-opacity="0.3" stroke="#fff" stroke-width="5" stroke-opacity="0.85"/>`, -16) +
    shot + title + caption + badge + `</svg>`;
}

/** The icon: a lightning bolt on a red tile with the backdrop's rays. */
export function iconSvg() {
  const s = ICON, c = s / 2, k = s / 76;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">` +
    `<rect width="${s}" height="${s}" fill="${RED}"/>${rays(c, c, 12, s, '#ff6b5e')}` +
    `<g transform="translate(${c + 5} ${c + 6}) scale(${k})">${bolt(INK, 5)}</g>` +
    `<g transform="translate(${c} ${c}) scale(${k})">${bolt(YELLOW, 5)}</g></svg>`;
}
