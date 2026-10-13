import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Theme } from '../../shared/src/track.ts';
import { PROP_DATA, THEME_DATA, type DataTheme } from './themes/index.ts';
import type { Paint, Part, PropData, ThemeData } from './themes/kit.ts';
import { canvasTexture, cyl, group, mesh, rbox, sph, toon } from './toon.ts';

// The themes and their props: the first four themes in code, the rest as data (themes/), which the apps build alike.

export type Mats = (color: number, outline?: boolean) => THREE.MeshToonMaterial;
/** Unlit materials (screens, neon, lamps) per colour. */
export type Glows = (color: number) => THREE.Material;
type PropMaker = (m: Mats, r: () => number) => THREE.Object3D;

const PROPS: Record<string, PropMaker> = {
  plate: (m, r) => group(cyl(6, 5, 0.5, m(0xffffff)), sph(1.6, m([0xff5a3c, 0x7ac943, 0xffc93c][Math.floor(r() * 3)]), 1.5, 0.6, -1)),
  mug: (m) => { const handle = mesh(new THREE.TorusGeometry(1.3, 0.35, 8, 16), m(0x3a86ff), 3.1, 1.6, 0); return group(cyl(3, 3, 3.6, m(0x3a86ff), 0, 1.8), cyl(2.7, 2.7, 0.1, m(0x6b3e26, false), 0, 3.5), handle); },
  toaster: (m) => group(rbox(9, 5, 5, 1, m(0xd9dde3), 0, 2.5), rbox(6, 0.3, 1, 0.1, m(0x333333), 0, 5, -1), rbox(6, 0.3, 1, 0.1, m(0x333333), 0, 5, 1), rbox(0.5, 1.5, 0.8, 0.2, m(0x222222), 4.6, 3, 0)),
  apple: (m) => group(sph(2.4, m(0xe63946), 0, 2.2), cyl(0.15, 0.15, 1, m(0x6b3e26), 0, 4.8), sph(0.6, m(0x5ad45a), 0.6, 4.7)),
  cheese: (m) => { const w = cyl(4, 4, 2.5, m(0xffd166), 0, 1.25, 0, 3); w.rotation.y = 0.4; return w; },
  flower: (m, r) => {
    const petal = m([0xff6fb5, 0xffd60a, 0xa66cff, 0xff4d4d][Math.floor(r() * 4)]);
    const h = 3 + r() * 3;
    const petals = [0, 1, 2, 3, 4].map((i) => sph(0.9, petal, Math.cos((i * 2 * Math.PI) / 5) * 1.1, h, Math.sin((i * 2 * Math.PI) / 5) * 1.1));
    return group(cyl(0.2, 0.2, h, m(0x3d9a3d), 0, h / 2), sph(0.7, m(0xffe066), 0, h + 0.2), ...petals);
  },
  bush: (m) => group(sph(3, m(0x4caf50), 0, 2), sph(2.4, m(0x5cc05c), 2.4, 1.6, 1), sph(2.2, m(0x43a047), -2.2, 1.5, -0.6)),
  stone: (m, r) => { const s = mesh(new THREE.DodecahedronGeometry(1.5 + r() * 1.5), m(0xa0a4ab)); s.scale.y = 0.6; s.position.y = 0.6; return s; },
  mushroom: (m) => group(cyl(0.7, 0.9, 2.2, m(0xfff3e0), 0, 1.1), mesh(new THREE.SphereGeometry(2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m(0xe63946), 0, 2), sph(0.35, m(0xffffff), 0.9, 3.3, 0.6), sph(0.3, m(0xffffff), -0.8, 3.4, -0.4)),
  gnome: (m) => group(cyl(1.4, 1.8, 3.4, m(0x2f6fdb), 0, 1.7), sph(1.1, m(0xffd2b0), 0, 4), mesh(new THREE.ConeGeometry(1, 2.2, 12), m(0xffffff), 0, 3.4, 0.7), mesh(new THREE.ConeGeometry(1.2, 3, 12), m(0xe63946), 0, 5.8)),
  pencil: (m, r) => {
    const p = group(cyl(0.6, 0.6, 12, m([0xffd60a, 0x2f9bff, 0xff4d4d][Math.floor(r() * 3)]), 0, 0, 0, 6), mesh(new THREE.ConeGeometry(0.6, 2, 6), m(0xf4d6a0), 0, 7, 0), cyl(0.62, 0.62, 1.2, m(0xff9fb5), 0, -6.6, 0, 6));
    p.rotation.z = Math.PI / 2;
    p.position.y = 0.6;
    return p;
  },
  books: (m, r) => group(...[0, 1, 2].slice(0, 1 + Math.floor(r() * 3)).map((i) => {
    const b = group(rbox(9, 1.8, 6.5, 0.2, m([0xe63946, 0x2f9bff, 0x1fd1b2, 0xffa62b][(i + Math.floor(r() * 4)) % 4])), rbox(8.6, 1.5, 6.3, 0.1, m(0xfffaf0), 0.3, 0, 0));
    b.position.y = 0.9 + i * 1.8;
    b.rotation.y = r() * 0.6 - 0.3;
    return b;
  })),
  cup: (m) => group(cyl(2.4, 2, 4, m(0xffffff), 0, 2), cyl(2.2, 2.2, 0.1, m(0x6b3e26, false), 0, 3.8)),
  note: (m, r) => { const n = rbox(5, 0.2, 5, 0.05, m([0xffe066, 0xff9fb5, 0x9be7ff][Math.floor(r() * 3)]), 0, 0.1); n.rotation.y = r(); return n; },
  eraser: (m) => rbox(4, 1.4, 2.2, 0.4, m(0xff9fb5), 0, 0.7),
  duck: (m) => group(sph(2.4, m(0xffd60a), 0, 1), sph(1.5, m(0xffd60a), 1.6, 3, 0), mesh(new THREE.ConeGeometry(0.6, 1.4, 8), m(0xff8c1a), 3.4, 2.8, 0).rotateZ(-Math.PI / 2), sph(0.25, m(0x111111), 2.4, 3.5, 0.7), sph(0.25, m(0x111111), 2.4, 3.5, -0.7)),
  foam: (m, r) => group(...[0, 1, 2, 3, 4].map(() => sph(0.8 + r() * 1.2, m(0xffffff), r() * 4 - 2, 0.3, r() * 4 - 2))),
  soap: (m) => rbox(4.5, 1.4, 2.8, 0.6, m(0xff9fb5), 0, 0.6),
};

export interface ThemeLook {
  /** The place, as the start screen names it. */
  title: string;
  sky: [string, string];
  groundY: number;
  ground: () => THREE.Texture;
  puddle: number;
  props: string[];
  /** Big props, each once, in a free tile of its own beside the road. */
  landmarks: string[];
  water?: boolean;
  clouds?: boolean;
}

type CodeTheme = Exclude<Theme, DataTheme>;

const CODE_THEMES: Record<CodeTheme, ThemeLook> = {
  kitchen: {
    title: 'Kitchen', landmarks: [],
    sky: ['#ffe9c9', '#f6cfa0'], groundY: -3, puddle: 0x9fdcff, props: ['plate', 'mug', 'toaster', 'apple', 'cheese'],
    ground: () => canvasTexture(256, 256, (g) => {
      g.fillStyle = '#d4955a'; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 64) {
        g.fillStyle = y % 128 ? '#cb8b50' : '#d99e64'; g.fillRect(0, y, 256, 64);
        g.fillStyle = '#9c5f30'; g.fillRect(0, y, 256, 3);
        g.strokeStyle = '#b97a44'; g.lineWidth = 2;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, y + 14 + i * 12); g.bezierCurveTo(80, y + 8 + i * 12, 170, y + 22 + i * 12, 256, y + 14 + i * 12); g.stroke(); }
      }
    }),
  },
  garden: {
    title: 'Garden', landmarks: [], clouds: true,
    sky: ['#4fb3ff', '#c9ecff'], groundY: -3, puddle: 0x5fb0de, props: ['flower', 'flower', 'bush', 'stone', 'mushroom', 'gnome', 'pond'],
    ground: () => canvasTexture(256, 256, (g) => {
      g.fillStyle = '#6cc04a'; g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#7cd058'; g.fillRect(0, 0, 128, 256);
      g.fillStyle = '#4f9e35';
      for (let i = 0; i < 90; i++) { const x = (i * 97) % 256, y = (i * 57) % 256; g.fillRect(x, y, 3, 8); g.fillRect(x + 4, y + 2, 3, 6); }
    }),
  },
  desk: {
    title: 'Office Desk', landmarks: [],
    sky: ['#e8eef5', '#c3cfdc'], groundY: -3, puddle: 0x6b3e26, props: ['pencil', 'books', 'cup', 'note', 'note', 'eraser'],
    ground: () => canvasTexture(256, 256, (g) => {
      g.fillStyle = '#eee6d8'; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = '#ddd2c0'; g.lineWidth = 2;
      for (let y = 8; y < 256; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y + 6); g.stroke(); }
    }),
  },
  bathtub: {
    title: 'Bathtub', landmarks: [],
    sky: ['#d9f3fb', '#a9dcec'], groundY: -2.3, puddle: 0xd8f4ff, props: ['duck', 'foam', 'foam', 'soap'], water: true,
    ground: () => canvasTexture(256, 256, (g) => {
      g.fillStyle = '#5cc6ef'; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = '#a8e6ff'; g.lineWidth = 5; g.lineCap = 'round';
      for (let i = 0; i < 14; i++) { const x = (i * 71) % 256, y = (i * 113) % 256; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 14, y - 8, x + 28, y); g.stroke(); }
    }),
  },
};

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Draws a data theme's ground tile (`Paint`). */
export function paint(g: CanvasRenderingContext2D, ops: Paint[]) {
  g.lineCap = 'round';
  for (const p of ops) {
    if ('fill' in p) { g.fillStyle = hex(p.fill); g.fillRect(0, 0, 256, 256); continue; }
    g.fillStyle = g.strokeStyle = hex(p.c);
    g.beginPath();
    if ('rect' in p) g.rect(...p.rect);
    else if ('line' in p) { g.moveTo(p.line[0], p.line[1]); g.lineTo(p.line[2], p.line[3]); }
    else if ('dot' in p || 'ring' in p) { const [x, y, r] = 'dot' in p ? p.dot : p.ring; g.arc(x, y, r, 0, 2 * Math.PI); }
    else for (let i = 0; i < p.poly.length; i += 2) g.lineTo(p.poly[i], p.poly[i + 1]);
    if ('line' in p || 'ring' in p) { g.lineWidth = p.w; g.stroke(); } else g.fill();
  }
}

const dataLook = (t: ThemeData): ThemeLook => ({
  title: t.title, sky: [hex(t.sky[0]), hex(t.sky[1])], groundY: -3, puddle: t.puddle, props: t.props, landmarks: t.landmarks, clouds: t.clouds,
  ground: () => canvasTexture(256, 256, (g) => paint(g, t.ground)),
});

const THEMES = { ...CODE_THEMES } as Record<Theme, ThemeLook>;
for (const [id, t] of Object.entries(THEME_DATA)) THEMES[id as DataTheme] = dataLook(t);

/** Whether this game can draw a theme: a Track the server sends may be set somewhere newer. */
export const knowsTheme = (theme: unknown) => typeof theme === 'string' && Object.hasOwn(THEMES, theme);
/** The look of a theme; one this game doesn't know (a newer server's) is drawn as the kitchen. */
export const themeOf = (theme: Theme) => THEMES[theme] ?? THEMES.kitchen;

/** Triangles with a flat normal each, for the cel look (and with the uvs every merged geometry needs). */
function faces(tris: number[][]) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(tris.length * 2).fill(0), 2));
  geo.computeVertexNormals();
  return geo;
}

/** A roof: a triangle of base w and height h in the xy plane, drawn out d along z. */
function wedge(w: number, h: number, d: number) {
  const [x, y, z] = [w / 2, h / 2, d / 2];
  const A = [-x, -y], B = [x, -y], C = [0, y];
  const v = (p: number[], s: number) => [p[0], p[1], s * z];
  return faces([
    [...v(A, 1), ...v(B, 1), ...v(C, 1)], [...v(A, -1), ...v(C, -1), ...v(B, -1)],
    [...v(A, 1), ...v(A, -1), ...v(B, -1)], [...v(A, 1), ...v(B, -1), ...v(B, 1)],
    [...v(A, 1), ...v(C, 1), ...v(C, -1)], [...v(A, 1), ...v(C, -1), ...v(A, -1)],
    [...v(B, 1), ...v(B, -1), ...v(C, -1)], [...v(B, 1), ...v(C, -1), ...v(C, 1)],
  ]);
}

function pyramid(w: number, h: number, d: number) {
  const [x, y, z] = [w / 2, h / 2, d / 2];
  const P1 = [-x, -y, -z], P2 = [x, -y, -z], P3 = [x, -y, z], P4 = [-x, -y, z], T = [0, y, 0];
  return faces([[...P4, ...P3, ...T], [...P3, ...P2, ...T], [...P2, ...P1, ...T], [...P1, ...P4, ...T], [...P1, ...P2, ...P3], [...P1, ...P3, ...P4]]);
}

/** A sign's face: its text in Bangers in `ink` on its colour, filling the board. */
function lettering(text: string, w: number, h: number, bg: number, ink: number) {
  const [tw, th] = w >= h ? [512, Math.max(32, Math.round((512 * h) / w))] : [Math.max(32, Math.round((512 * w) / h)), 512];
  const tex = canvasTexture(tw, th, (g) => {
    g.fillStyle = hex(bg); g.fillRect(0, 0, tw, th);
    g.fillStyle = hex(ink); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${Math.min(th * 0.72, tw / (text.length * 0.5))}px Bangers, Impact, sans-serif`;
    g.fillText(text, tw / 2, th * 0.55);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Segments round a ball: fewer for a small one (a bulb, a pip), so a theme full of them stays light for phones (thin
 * cylinders get 8 sides and rings 16 × 6 for the same reason). */
export const ballSegments = (r: number): [number, number] => (r < 0.5 ? [8, 6] : r < 1.5 ? [12, 8] : [16, 12]);

/** Builds a data prop; `r` picks its colour, as ThemeData.swift does with the same numbers. `signs` shares each sign's face. */
export function buildProp(def: PropData, m: Mats, glow: Glows, r: () => number, signs = new Map<string, THREE.Material>()): THREE.Object3D {
  const picked = def.pick ? def.pick[Math.floor(r() * def.pick.length)] : 0;
  const build = (p: Part): THREE.Object3D => {
    let o: THREE.Object3D;
    if ('parts' in p) o = group(...p.parts.map(build));
    else {
      const c = p.c === 'pick' ? picked : p.c, mat = p.glow ? glow(c) : m(c, !p.flat);
      if ('box' in p) {
        const [w, h, d] = p.box, round = Math.min(p.r ?? 0, Math.min(w, h, d) / 2);
        o = mesh(round ? new RoundedBoxGeometry(w, h, d, 2, round) : new THREE.BoxGeometry(w, h, d), mat);
      } else if ('cyl' in p) o = mesh(new THREE.CylinderGeometry(p.cyl[0], p.cyl[1], p.cyl[2], p.seg ?? (Math.max(p.cyl[0], p.cyl[1]) < 0.3 ? 8 : 16)), mat);
      else if ('ball' in p) o = mesh(new THREE.SphereGeometry(p.ball, ...ballSegments(p.ball)), mat);
      else if ('dome' in p) o = mesh(new THREE.SphereGeometry(p.dome, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      else if ('torus' in p) o = mesh(new THREE.TorusGeometry(p.torus[0], p.torus[1], 6, 16), mat);
      else if ('wedge' in p) o = mesh(wedge(...p.wedge), mat);
      else if ('pyramid' in p) o = mesh(pyramid(...p.pyramid), mat);
      else {
        const key = [p.text, p.sign[0], p.sign[1], c, p.ink, !p.flat].join();
        if (!signs.has(key)) signs.set(key, toon(0xffffff, { outline: !p.flat, map: lettering(p.text, p.sign[0], p.sign[1], c, p.ink) }));
        o = mesh(new THREE.BoxGeometry(...p.sign), signs.get(key)!);
      }
    }
    if (p.at) o.position.set(...p.at);
    if (p.rot) o.rotation.set(...p.rot);
    if (p.scale) o.scale.set(...p.scale);
    return o;
  };
  return group(...def.parts.map(build));
}

/** A prop of any theme, by name. */
export function makeProp(kind: string, m: Mats, glow: Glows, r: () => number, signs?: Map<string, THREE.Material>): THREE.Object3D {
  return kind in PROPS ? PROPS[kind](m, r) : buildProp(PROP_DATA[kind].prop, m, glow, r, signs);
}

/** How far a data prop reaches from its middle, any way it's turned (code props are measured once built). */
export const reachOf = (kind: string) => PROP_DATA[kind]?.reach;
