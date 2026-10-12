import { HALF_WIDTH, RISE, type Track, type TrackDef, buildTrack } from '../../shared/src/track.ts';
import { themeOf } from './props.ts';

// The start form's Track picker: the Track from above on its theme's ground, and what it has in store.

const built = new Map<string, Track>();
const trackOf = (def: TrackDef) => {
  if (!built.has(def.id)) built.set(def.id, buildTrack(def));
  return built.get(def.id)!;
};

const facts = new Map<string, { length: number; turns: number; climbs: number; jumps: number; bridges: number }>();
/** Length, turns, climbs, jumps and bridges, for the lines beside the picture. */
export function trackFacts(def: TrackDef) {
  if (!facts.has(def.id)) {
    const track = trackOf(def), count = (c: string) => def.pieces.split(/\s+/).filter((p) => p[0] === c).length;
    // a bridge: road high over another stretch of road
    const bridge = track.samples.some((a) => track.samples.some((b) => a.y > b.y + RISE * 0.7 && (a.x - b.x) ** 2 + (a.z - b.z) ** 2 < HALF_WIDTH ** 2));
    facts.set(def.id, { length: Math.round(track.n / 10) * 10, turns: count('L') + count('R'), climbs: count('U'), jumps: count('J'), bridges: bridge ? 1 : 0 });
  }
  return facts.get(def.id)!;
}

/** Draws the Track (or, for none, any Track: a question mark) to fill the canvas at its size on screen. */
export function drawTrackMap(canvas: HTMLCanvasElement, def: TrackDef | undefined) {
  const ratio = Math.min(devicePixelRatio, 2), w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  const g = canvas.getContext('2d')!;
  g.setTransform(ratio, 0, 0, ratio, 0, 0);
  g.clearRect(0, 0, w, h);
  if (!def) {
    g.fillStyle = '#2f9bff';
    g.fillRect(0, 0, w, h);
    g.font = `${Math.round(h * 0.8)}px Bangers, Impact, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 6;
    g.lineJoin = 'round';
    g.strokeStyle = '#111';
    g.strokeText('?', w / 2, h * 0.56);
    g.fillStyle = '#ffd60a';
    g.fillText('?', w / 2, h * 0.56);
    return;
  }
  const track = trackOf(def), xs = track.samples.map((s) => s.x), zs = track.samples.map((s) => s.z);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs), pad = 10;
  // seen from above with the start straight running up the picture, as the chase camera first sees it
  const scale = Math.min((w - 2 * pad) / (x1 - x0 + 2 * HALF_WIDTH), (h - 2 * pad) / (z1 - z0 + 2 * HALF_WIDTH));
  const at = (x: number, z: number): [number, number] => [w / 2 - (x - (x0 + x1) / 2) * scale, h / 2 - (z - (z0 + z1) / 2) * scale];
  const ground = themeOf(def.theme).ground();
  const pattern = g.createPattern(ground.image as HTMLCanvasElement, 'repeat');
  ground.dispose();
  if (pattern) {
    // the ground tile is 17 m across, as in the game
    pattern.setTransform(new DOMMatrix().scale((17 * scale) / 256));
    g.fillStyle = pattern;
    g.fillRect(0, 0, w, h);
  }
  g.lineJoin = g.lineCap = 'round';
  const road = Math.max(4, 2 * HALF_WIDTH * scale);
  const stroke = (from: number, to: number) => {
    const path = new Path2D();
    for (let i = from; i <= to; i++) path.lineTo(...at(track.samples[i % track.n].x, track.samples[i % track.n].z));
    for (const [color, width] of [['#111', road + 3], ['#51565f', road]] as const) {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.stroke(path);
    }
  };
  stroke(0, track.n);
  // the raised stretches again, on top, so a bridge lies over the road it crosses
  let start = -1;
  for (let i = 0; i <= track.n; i++) {
    const up = track.samples[i % track.n].y > RISE * 0.5;
    if (up && start < 0) start = i;
    if (!up && start >= 0) { stroke(start - 1, i); start = -1; }
  }
  const s = track.samples[0], [ax, ay] = at(s.x - s.dz * HALF_WIDTH, s.z + s.dx * HALF_WIDTH), [bx, by] = at(s.x + s.dz * HALF_WIDTH, s.z - s.dx * HALF_WIDTH);
  g.strokeStyle = '#fff';
  g.lineWidth = 3;
  g.lineCap = 'butt';
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(bx, by);
  g.stroke();
}
