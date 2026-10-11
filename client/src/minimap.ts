import { HALF_WIDTH, type Track } from '../../shared/src/track.ts';
import { isTouch } from './input.ts';
import { SEAT_COLORS } from './scene.ts';
import type { CarState, RaceState } from './state.ts';

const SIZE = 200, PAD = 16;
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/**
 * The desktop map in a HUD corner: the Track from above, each E-Car a dot in its Racer's colour with its Position, and a
 * Player's name next to it (a Bot gets 🤖). Phones have no room for it.
 */
export function createMap(canvas: HTMLCanvasElement) {
  const g = canvas.getContext('2d')!, ratio = Math.min(devicePixelRatio, 2);
  canvas.width = canvas.height = SIZE * ratio;
  let shown: Track | undefined, road = new Path2D(), finish = new Path2D(), width = 0;
  let at = (x: number, z: number): [number, number] => [x, z];

  function load(track: Track) {
    shown = track;
    const xs = track.samples.map((s) => s.x), zs = track.samples.map((s) => s.z);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const scale = (SIZE - 2 * PAD) / Math.max(x1 - x0, z1 - z0);
    at = (x, z) => [SIZE / 2 + (x - (x0 + x1) / 2) * scale, SIZE / 2 + (z - (z0 + z1) / 2) * scale];
    road = new Path2D();
    for (const s of track.samples) road.lineTo(...at(s.x, s.z));
    road.closePath();
    width = Math.max(5, 2 * HALF_WIDTH * scale);
    const s = track.samples[0];
    finish = new Path2D();
    finish.moveTo(...at(s.x - s.dz * HALF_WIDTH, s.z + s.dx * HALF_WIDTH));
    finish.lineTo(...at(s.x + s.dz * HALF_WIDTH, s.z - s.dx * HALF_WIDTH));
  }

  return (track: Track | undefined, state: RaceState, me: CarState | undefined) => {
    if (isTouch || !track) return;
    if (track !== shown) load(track);
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, SIZE, SIZE);
    g.lineJoin = 'round';
    for (const [path, color, w] of [[road, '#111', width + 4], [road, '#c9ced6', width], [finish, '#fff', 3]] as const) {
      g.strokeStyle = color;
      g.lineWidth = w;
      g.stroke(path);
    }
    const cars: [CarState, number][] = [];
    state.cars.forEach((c, i) => cars.push([c, i]));
    // our own dot on top, the rest with the Leader uppermost
    const mine = (c: CarState) => !!me && c.owner === me.owner;
    cars.sort(([a], [b]) => Number(mine(a)) - Number(mine(b)) || b.position - a.position);
    g.font = '15px Bangers, Impact, sans-serif';
    for (const [c, i] of cars) {
      const [x, y] = at(c.x, c.z);
      g.beginPath();
      g.arc(x, y, mine(c) ? 7 : 5, 0, 2 * Math.PI);
      g.fillStyle = hex(SEAT_COLORS[i]);
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = mine(c) ? '#fff' : '#111';
      g.stroke();
      const label = c.owner ? `${c.position} ${c.name}` : `${c.position}🤖`;
      g.lineWidth = 3;
      g.strokeStyle = '#111';
      g.strokeText(label, x + 9, y + 5);
      g.fillStyle = '#fff';
      g.fillText(label, x + 9, y + 5);
    }
  };
}
