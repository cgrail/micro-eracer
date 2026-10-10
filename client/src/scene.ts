import * as THREE from 'three';
import type { BodyKind } from '../../shared/src/car.ts';
import { type Track, HALF_WIDTH, ROAD_Y, right } from '../../shared/src/track.ts';

export const SEAT_COLORS = [0xe63946, 0x2a9df4, 0xf4a261, 0x2ec4b6, 0x9b5de5, 0xffd60a, 0x06d6a0, 0xff70a6];
const TABLE_Y = -3;
const mat = (color: number) => new THREE.MeshLambertMaterial({ color });
const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  return mesh;
};

/** Ribbon between two offsets from the centreline, at height y. */
function ribbon(track: Track, from: number, to: number, y: number, material: THREE.Material) {
  const pos: number[] = [], index: number[] = [];
  track.samples.forEach((s, i) => {
    const r = right(s.dx, s.dz);
    pos.push(s.x + r.x * from, y, s.z + r.z * from, s.x + r.x * to, y, s.z + r.z * to);
    const j = (i + 1) % track.n;
    index.push(2 * i, 2 * i + 1, 2 * j, 2 * i + 1, 2 * j + 1, 2 * j);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/** Vertical skirt along one road edge so the Track reads as a raised toy track. */
function skirt(track: Track, offset: number, material: THREE.Material) {
  const pos: number[] = [], index: number[] = [];
  track.samples.forEach((s, i) => {
    const r = right(s.dx, s.dz), x = s.x + r.x * offset, z = s.z + r.z * offset;
    pos.push(x, ROAD_Y, z, x, ROAD_Y - 0.5, z);
    const j = (i + 1) % track.n;
    index.push(2 * i, 2 * i + 1, 2 * j, 2 * i + 1, 2 * j + 1, 2 * j);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function checker() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 2;
  const g = c.getContext('2d')!;
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x, y, 1, 1); }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

export function buildTrackScene(track: Track): THREE.Group {
  const g = new THREE.Group();
  const xs = track.samples.map((s) => s.x), zs = track.samples.map((s) => s.z);
  const minX = Math.min(...xs) - 30, maxX = Math.max(...xs) + 30, minZ = Math.min(...zs) - 30, maxZ = Math.max(...zs) + 30;
  g.add(box(maxX - minX, 1, maxZ - minZ, mat(0xb07a4a), (minX + maxX) / 2, TABLE_Y - 0.5, (minZ + maxZ) / 2));

  g.add(ribbon(track, -HALF_WIDTH, HALF_WIDTH, ROAD_Y, mat(0x4a4f57)));
  const line = mat(0xffffff);
  g.add(ribbon(track, -HALF_WIDTH, -HALF_WIDTH + 0.3, ROAD_Y + 0.01, line), ribbon(track, HALF_WIDTH - 0.3, HALF_WIDTH, ROAD_Y + 0.01, line));
  const side = new THREE.MeshLambertMaterial({ color: 0x30343a, side: THREE.DoubleSide });
  g.add(skirt(track, -HALF_WIDTH, side), skirt(track, HALF_WIDTH, side));

  const wallMats = [mat(0xd62828), mat(0xf1f1f1)];
  track.walls.forEach((w, i) => {
    const wall = box(0.4, 1, w.length + 0.05, wallMats[Math.floor(i / 4) % 2], w.x, ROAD_Y + 0.5, w.z);
    wall.rotation.y = w.yaw;
    g.add(wall);
  });

  const start = track.samples[0];
  const finish = new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, 1.5), new THREE.MeshLambertMaterial({ map: checker() }));
  finish.rotation.set(-Math.PI / 2, 0, Math.atan2(-start.dx, -start.dz));
  finish.position.set(start.x, ROAD_Y + 0.02, start.z);
  g.add(finish);

  const pillar = new THREE.CylinderGeometry(0.3, 0.3, ROAD_Y - TABLE_Y);
  const pillarMat = mat(0x8d99ae);
  for (let i = 0; i < track.n; i += 12) {
    const p = new THREE.Mesh(pillar, pillarMat);
    p.position.set(track.samples[i].x, (ROAD_Y + TABLE_Y) / 2 - 0.25, track.samples[i].z);
    g.add(p);
  }

  for (const prop of track.def.props) {
    const y = TABLE_Y;
    if (prop.kind === 'plate') {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(6, 5, 0.4, 32), mat(0xfafafa));
      plate.position.set(prop.x, y + 0.2, prop.z);
      g.add(plate);
    } else if (prop.kind === 'mug') {
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 2.6, 24), mat(0xc1121f));
      mug.position.set(prop.x, y + 1.3, prop.z);
      g.add(mug);
    } else {
      g.add(box(9, 2.6, 5, mat(0xadb5bd), prop.x, y + 1.3, prop.z), box(7, 0.2, 1, mat(0x222222), prop.x, y + 2.65, prop.z - 1));
    }
  }
  return g;
}

/** Generic retro Microbus or low Roadster, facing +z, origin at the physics body's centre. */
export function makeCar(kind: BodyKind, color: number): THREE.Group {
  const g = new THREE.Group();
  const paint = mat(color), glass = mat(0x1b263b), white = mat(0xf8f9fa), tyre = mat(0x111111), lamp = mat(0xfff3b0);
  if (kind === 'microbus') {
    g.add(box(1.8, 0.75, 3.6, paint, 0, -0.05, 0), box(1.75, 0.8, 3.3, white, 0, 0.7, -0.1), box(1.78, 0.4, 3.1, glass, 0, 0.75, -0.1));
  } else {
    g.add(box(1.8, 0.45, 3.8, paint, 0, -0.12, 0), box(1.45, 0.38, 1.3, glass, 0, 0.3, -0.35), box(1.7, 0.12, 0.9, paint, 0, 0.08, 1.4));
  }
  g.add(box(0.4, 0.15, 0.05, lamp, 0.55, 0.05, 1.82), box(0.4, 0.15, 0.05, lamp, -0.55, 0.05, 1.82));
  const wheel = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  for (const [x, z] of [[0.85, 1.15], [-0.85, 1.15], [0.85, -1.15], [-0.85, -1.15]]) {
    const w = new THREE.Mesh(wheel, tyre);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, -0.3, z);
    g.add(w);
  }
  return g;
}

export function makeNameTag(name: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d')!;
  g.font = 'bold 36px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = '#000a';
  g.strokeText(name, 128, 32);
  g.fillStyle = '#fff';
  g.fillText(name, 128, 32);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  sprite.scale.set(4, 1, 1);
  sprite.position.y = 2.4;
  return sprite;
}
