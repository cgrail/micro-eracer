import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { type Track, BAY_WIDTH, HALF_WIDTH, TILE, right } from '../../shared/src/track.ts';
import { type Mats, makeProp, reachOf, themeOf } from './props.ts';
import { GRADIENT, canvasTexture, cyl, group, mesh, rbox, rng, sph, toon } from './toon.ts';


export const SEAT_COLORS = [0xff4d4d, 0x2f9bff, 0xffa62b, 0x1fd1b2, 0xa66cff, 0xffd60a, 0x5ad45a, 0xff6fb5];

type Sample = Track['samples'][number];
/**
 * A ribbon between two sideways offsets from the centreline (`to` may depend on the sample, for the Charging Station's bay),
 * `lift` above the road; `keep` drops segments (dashes, kerb colours).
 */
function ribbon(track: Track, from: number, to: number | ((s: Sample) => number), lift: number, mat: THREE.Material, keep: (i: number) => boolean = () => true) {
  const pos: number[] = [], index: number[] = [];
  track.samples.forEach((s, i) => {
    const r = right(s.dx, s.dz), y = s.y + lift, t = typeof to === 'number' ? to : to(s);
    pos.push(s.x + r.x * from, y, s.z + r.z * from, s.x + r.x * t, y, s.z + r.z * t);
    if (!keep(i)) return;
    const j = (i + 1) % track.n;
    index.push(2 * i, 2 * i + 1, 2 * j, 2 * i + 1, 2 * j + 1, 2 * j);
  });
  return mesh(geometry(pos, index), mat);
}

function skirt(track: Track, offset: (s: Sample) => number, mat: THREE.Material) {
  const pos: number[] = [], index: number[] = [];
  track.samples.forEach((s, i) => {
    const r = right(s.dx, s.dz), x = s.x + r.x * offset(s), z = s.z + r.z * offset(s);
    pos.push(x, s.y, z, x, s.y - 0.6, z);
    const j = (i + 1) % track.n;
    index.push(2 * i, 2 * i + 1, 2 * j, 2 * i + 1, 2 * j + 1, 2 * j);
  });
  return mesh(geometry(pos, index), mat);
}

function geometry(pos: number[], index: number[]) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Merges static meshes per material: far fewer draw calls (and outline passes) on phones. */
function mergeStatic(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    const list = byMat.get(o.material) ?? [];
    list.push(g);
    byMat.set(o.material, list);
  });
  const out = new THREE.Group();
  byMat.forEach((list, mat) => out.add(new THREE.Mesh(mergeGeometries(list), mat)));
  return out;
}

function ripple(x: number, y: number, z: number, r: number, phase: number, animated: ((t: number) => void)[]) {
  const ring = mesh(new THREE.RingGeometry(0.85, 1, 32), toon(0xffffff, { outline: false, opacity: 0.7 }), x, y, z);
  ring.rotation.x = -Math.PI / 2;
  animated.push((t) => {
    const k = (t / 1.8 + phase) % 1;
    ring.scale.setScalar(0.2 + k * r);
    (ring.material as THREE.Material).opacity = 0.7 * (1 - k);
  });
  return ring;
}

export interface TrackScene { group: THREE.Group; update: (t: number) => void; water: boolean; groundY: number; background: THREE.Texture }

export function buildTrackScene(track: Track): TrackScene {
  const look = themeOf(track.def.theme);
  const random = rng(track.def.id);
  const cache = new Map<string, THREE.MeshToonMaterial>();
  const m: Mats = (color, outline = true) => {
    const key = `${color}-${outline}`;
    if (!cache.has(key)) cache.set(key, toon(color, { outline }));
    return cache.get(key)!;
  };
  const glows = new Map<number, THREE.MeshBasicMaterial>();
  const glow = (color: number) => {
    if (!glows.has(color)) {
      const g = new THREE.MeshBasicMaterial({ color });
      g.userData.outlineParameters = { visible: false };
      glows.set(color, g);
    }
    return glows.get(color)!;
  };
  const signs = new Map<string, THREE.Material>();
  const statics = new THREE.Group(), live = new THREE.Group(), animated: ((t: number) => void)[] = [];

  // ground
  const xs = track.samples.map((s) => s.x), zs = track.samples.map((s) => s.z);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  // the bath is a tub of water with a rim; everything else stands on an endless surface
  const w = Math.max(...xs) - Math.min(...xs) + 80, d = Math.max(...zs) - Math.min(...zs) + 80;
  const [gw, gd] = look.water ? [w, d] : [700, 700];
  const groundTex = look.ground();
  groundTex.repeat.set(gw / 17, gd / 17);
  const ground = mesh(new THREE.PlaneGeometry(gw, gd), toon(0xffffff, { outline: false, map: groundTex }), cx, look.groundY, cz);
  ground.rotation.x = -Math.PI / 2;
  live.add(ground);
  if (look.water) {
    animated.push((t) => groundTex.offset.set(t * 0.01, t * 0.006));
    for (const [x, z, sx, sz] of [[cx, cz - d / 2, w + 8, 8], [cx, cz + d / 2, w + 8, 8], [cx - w / 2, cz, 8, d], [cx + w / 2, cz, 8, d]]) {
      statics.add(rbox(sx, 7, sz, 3, m(0xffffff), x, look.groundY + 1, z));
    }
    const tiles = canvasTexture(64, 64, (g) => { g.fillStyle = '#eef5f8'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#c4d3da'; g.fillRect(0, 0, 64, 3); g.fillRect(0, 0, 3, 64); });
    tiles.repeat.set(120, 120);
    const floor = mesh(new THREE.PlaneGeometry(700, 700), toon(0xffffff, { outline: false, map: tiles }), cx, look.groundY - 6, cz);
    floor.rotation.x = -Math.PI / 2;
    live.add(floor);
  }

  // the road: asphalt, white edges on straights, red/white kerbs in turns, dashed centre line
  statics.add(ribbon(track, -HALF_WIDTH, HALF_WIDTH, 0, m(0x51565f, false)));
  const white = m(0xffffff, false), red = m(0xff3b3b, false), turn = (i: number) => track.samples[i].turn;
  for (const [a, b] of [[-HALF_WIDTH, -HALF_WIDTH + 0.45], [HALF_WIDTH - 0.45, HALF_WIDTH]]) {
    statics.add(ribbon(track, a, b, 0.01, white, (i) => !turn(i)));
    statics.add(ribbon(track, a - 0.15, b + 0.15, 0.012, red, (i) => turn(i) && Math.floor(i / 2) % 2 === 0));
    statics.add(ribbon(track, a - 0.15, b + 0.15, 0.012, white, (i) => turn(i) && Math.floor(i / 2) % 2 === 1));
  }
  statics.add(ribbon(track, -0.15, 0.15, 0.01, m(0xfff3b0, false), (i) => !turn(i) && !track.samples[i].kick && Math.floor(i / 3) % 2 === 0));
  // a jump's kicker in hazard stripes
  // just under the edge lines, which would otherwise flicker through it
  statics.add(ribbon(track, -HALF_WIDTH, HALF_WIDTH, 0.006, m(0xffd60a, false), (i) => track.samples[i].kick && i % 2 === 0));
  const side = new THREE.MeshToonMaterial({ color: 0x3a3f47, gradientMap: GRADIENT, side: THREE.DoubleSide });
  side.userData.outlineParameters = { visible: false };
  statics.add(skirt(track, () => -HALF_WIDTH, side), skirt(track, (s) => HALF_WIDTH + s.bay, side));

  // the Charging Station: a blue bay with green charging pads under a canopy with its sign
  const inBay = (i: number) => track.samples[i].bay > 0;
  statics.add(ribbon(track, HALF_WIDTH, (s) => HALF_WIDTH + s.bay, 0, m(0x4a6a8f, false), inBay));
  statics.add(ribbon(track, HALF_WIDTH + 0.8, HALF_WIDTH + BAY_WIDTH - 0.8, 0.012, m(0x39e46b, false), (i) => track.samples[i].bay >= BAY_WIDTH && i % 5 < 3));
  const mid = track.samples[track.n - 17], rm = right(mid.dx, mid.dz), at = HALF_WIDTH + BAY_WIDTH / 2;
  const sign = canvasTexture(256, 64, (c) => {
    c.fillStyle = '#39e46b'; c.fillRect(0, 0, 256, 64);
    c.fillStyle = '#111'; c.font = '46px Bangers, Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('⚡ CHARGE', 128, 36);
  });
  sign.wrapS = sign.wrapT = THREE.ClampToEdgeWrapping;
  // turned along the road, the canopy's +x points left, so its posts stand at -x on the bay's outer edge; the roof is
  // see-through so the high camera still shows the E-Cars under it, and the sign faces the E-Cars coming in (-z)
  const posts = [-9, 9].map((z) => cyl(0.25, 0.25, 4.2, m(0x333a44), -(BAY_WIDTH / 2 + 0.2), 2.1, z, 10));
  const canopy = group(...posts, rbox(BAY_WIDTH + 1.2, 0.35, 20, 0.12, toon(0xffffff, { opacity: 0.45 }), 0, 4.3, 0),
    mesh(new THREE.BoxGeometry(BAY_WIDTH, 1.2, 0.2), toon(0xffffff, { map: sign }), 0, 5.1, -9.9));
  canopy.position.set(mid.x + rm.x * at, mid.y, mid.z + rm.z * at);
  canopy.rotation.y = Math.atan2(mid.dx, mid.dz);
  live.add(canopy);

  // a wall piece every metre, its edges rounded in one step: a Track walled all round stays light for phones
  track.walls.forEach((w, i) => {
    const wall = mesh(new RoundedBoxGeometry(0.5, 1, w.length + 0.06, 1, 0.12), Math.floor(i / 4) % 2 ? m(0xffffff) : m(0xff3b3b), w.x, w.y + 0.5, w.z);
    wall.rotation.set(w.pitch, w.yaw, 0, 'YXZ');
    statics.add(wall);
  });
  // pillars hold the road up, except where they would stand on the road under a bridge
  const overRoad = (p: Sample) => track.samples.some((o) => o.y < p.y - 1 && (o.x - p.x) ** 2 + (o.z - p.z) ** 2 < (HALF_WIDTH + 1) ** 2);
  for (let i = 0; i < track.n; i += 12) {
    const s = track.samples[i];
    if (!overRoad(s)) statics.add(cyl(0.35, 0.5, s.y - look.groundY, m(0xb8c0cc), s.x, (s.y + look.groundY) / 2 - 0.3, s.z, 8));
  }

  // start/finish: checkered line and a banner gantry
  const s0 = track.samples[0], yaw0 = Math.atan2(s0.dx, s0.dz);
  const checker = canvasTexture(16, 4, (g) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x, y, 1, 1); } });
  checker.magFilter = THREE.NearestFilter;
  const line = mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, 2), toon(0xffffff, { outline: false, map: checker }), s0.x, s0.y + 0.02, s0.z);
  line.rotation.set(-Math.PI / 2, 0, Math.atan2(-s0.dx, -s0.dz));
  live.add(line);
  const banner = canvasTexture(512, 96, (g) => {
    g.fillStyle = '#ffd60a'; g.fillRect(0, 0, 512, 96);
    g.fillStyle = '#111'; g.font = '64px Bangers, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('MICRO E-RACER', 256, 52);
  });
  banner.wrapS = banner.wrapT = THREE.ClampToEdgeWrapping;
  const gantry = group(
    cyl(0.4, 0.4, 6, m(0x333a44), HALF_WIDTH + 1.4, 3, 0, 10), cyl(0.4, 0.4, 6, m(0x333a44), -HALF_WIDTH - 1.4, 3, 0, 10),
    mesh(new THREE.BoxGeometry(HALF_WIDTH * 2 + 3.6, 1.6, 0.5), toon(0xffffff, { map: banner }), 0, 6, 0),
  );
  gantry.position.set(s0.x, s0.y, s0.z);
  gantry.rotation.y = yaw0;
  live.add(gantry);

  // Puddles on the road
  for (const p of track.puddles) {
    const disc = mesh(new THREE.CircleGeometry(p.r, 32), toon(look.puddle, { outline: false, opacity: 0.85 }), p.x, p.y + 0.03, p.z);
    disc.rotation.x = -Math.PI / 2;
    const shine = mesh(new THREE.RingGeometry(p.r * 0.5, p.r * 0.62, 24, 1, 0.4, 1.3), toon(0xffffff, { outline: false, opacity: 0.6 }), p.x, p.y + 0.04, p.z);
    shine.rotation.x = -Math.PI / 2;
    live.add(disc, shine, ripple(p.x, p.y + 0.05, p.z, p.r * 0.9, random(), animated));
  }

  // scenery in the tiles the road does not use: every prop stays inside its tile, so it never reaches the road or the
  // next tile's props, and clear of the other prop in its tile
  const key = (x: number, z: number) => `${Math.round(x)},${Math.round(z)}`;
  const used = new Set(track.tiles.map((t) => key(t.x, t.z)));
  const tx = track.tiles.map((t) => t.x), tz = track.tiles.map((t) => t.z);
  const footprints = new Map<string, number>();
  const footprint = (kind: string) => {
    if (!footprints.has(kind)) {
      // any way it's turned, the prop fits in this circle (a data prop knows it)
      let reach = reachOf(kind);
      if (reach === undefined) {
        const box = new THREE.Box3().setFromObject(makeProp(kind, m, glow, rng(kind)));
        reach = Math.max(...[box.min.x, box.max.x].flatMap((bx) => [box.min.z, box.max.z].map((bz) => Math.hypot(bx, bz))));
      }
      footprints.set(kind, reach);
    }
    return footprints.get(kind)!;
  };
  // landmarks first: each in a free tile of its own beside the road, turned to face it
  const road = new Set(used);
  const facing = (x: number, z: number) => [[TILE, 0], [-TILE, 0], [0, TILE], [0, -TILE]].find(([dx, dz]) => road.has(key(x + dx, z + dz)));
  const spots: { x: number; z: number }[] = [];
  if (look.landmarks.length) {
    for (let x = Math.min(...tx) - 2 * TILE; x <= Math.max(...tx) + 2 * TILE; x += TILE) {
      for (let z = Math.min(...tz) - 2 * TILE; z <= Math.max(...tz) + 2 * TILE; z += TILE) if (!road.has(key(x, z)) && facing(x, z)) spots.push({ x, z });
    }
  }
  for (const kind of look.landmarks) {
    if (!spots.length) break;
    const { x, z } = spots.splice(Math.floor(random() * spots.length), 1)[0], [dx, dz] = facing(x, z)!;
    const prop = makeProp(kind, m, glow, random, signs);
    prop.position.set(x, look.groundY, z);
    prop.rotation.y = Math.atan2(dx, dz);
    statics.add(prop);
    used.add(key(x, z));
  }
  let ponds = 0;
  for (let x = Math.min(...tx) - 2 * TILE; x <= Math.max(...tx) + 2 * TILE; x += TILE) {
    for (let z = Math.min(...tz) - 2 * TILE; z <= Math.max(...tz) + 2 * TILE; z += TILE) {
      if (used.has(key(x, z))) continue;
      const count = random() < 0.8 ? 1 + Math.floor(random() * 2) : 0;
      const placed: { x: number; z: number; r: number }[] = [];
      for (let i = 0; i < count; i++) {
        let kind = look.props[Math.floor(random() * look.props.length)];
        // a pond takes a whole tile to itself
        if (kind === 'pond' && (ponds >= 2 || placed.length)) kind = 'flower';
        if (kind === 'pond') ponds++;
        const r = kind === 'pond' ? 0 : footprint(kind), room = Math.max(0, TILE / 2 - 0.5 - r);
        let px = x, pz = z, fits = false;
        for (let tries = 0; tries < 6 && !fits; tries++) {
          px = x + (random() * 2 - 1) * room;
          pz = z + (random() * 2 - 1) * room;
          fits = placed.every((p) => Math.hypot(p.x - px, p.z - pz) > p.r + r + 0.5);
        }
        if (!fits) continue;
        placed.push({ x: px, z: pz, r });
        if (kind === 'pond') {
          const water = mesh(new THREE.CircleGeometry(5.5, 32), toon(0x4fb3e8, { outline: false }), x, look.groundY + 0.05, z);
          water.rotation.x = -Math.PI / 2;
          live.add(water, ripple(x, look.groundY + 0.08, z, 5, random(), animated));
          for (let a = 0; a < 12; a++) statics.add(makeProp('stone', m, glow, random).translateX(x + Math.cos(a / 1.9) * 5.6).translateZ(z + Math.sin(a / 1.9) * 5.6).translateY(look.groundY));
          break;
        }
        const prop = makeProp(kind, m, glow, random, signs);
        prop.position.add(new THREE.Vector3(px, look.groundY, pz));
        prop.rotation.y += random() * Math.PI * 2;
        if (kind === 'duck') {
          // ducks float, so they stay out of the merge to bob on the bath water
          const phase = random() * 6;
          animated.push((t) => { prop.position.y = look.groundY + Math.sin(t * 2 + phase) * 0.25; prop.rotation.z = Math.sin(t * 1.6 + phase) * 0.08; });
          live.add(prop);
        } else statics.add(prop);
      }
      if (look.water && random() < 0.3) live.add(ripple(x, look.groundY + 0.05, z, 4, random(), animated));
    }
  }
  if (look.clouds) {
    // a few comic clouds far away
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, d = 170 + random() * 40;
      const cloud = group(sph(8, m(0xffffff)), sph(6, m(0xffffff), 8, -1, 0), sph(6, m(0xffffff), -8, -1.5, 0), sph(5, m(0xffffff), 3, 4, 0));
      cloud.position.set(cx + Math.cos(a) * d, 45 + random() * 20, cz + Math.sin(a) * d);
      cloud.lookAt(cx, cloud.position.y, cz);
      statics.add(cloud);
    }
  }

  const g = new THREE.Group().add(mergeStatic(statics), live);
  const background = canvasTexture(2, 256, (ctx) => {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, look.sky[0]); grad.addColorStop(1, look.sky[1]);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 2, 256);
  });
  return { group: g, update: (t) => animated.forEach((f) => f(t)), water: !!look.water, groundY: look.groundY, background };
}

export function makeBattery(): THREE.Group {
  const body = cyl(0.55, 0.55, 1.3, toon(0x39e46b), 0, 0, 0, 16);
  const band = cyl(0.57, 0.57, 0.35, toon(0xffffff), 0, 0.1, 0, 16);
  const cap = cyl(0.25, 0.25, 0.3, toon(0xc9ced6), 0, 0.8, 0, 10);
  const glow = mesh(new THREE.SphereGeometry(1.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0x8dff9e, transparent: true, opacity: 0.25, depthWrite: false }));
  glow.material.userData.outlineParameters = { visible: false };
  return group(body, band, cap, glow);
}

export function makeItemBox(): THREE.Group {
  const face = canvasTexture(64, 64, (g) => {
    const grad = g.createLinearGradient(0, 0, 64, 64);
    ['#ff4d4d', '#ffd60a', '#39e46b', '#2f9bff', '#a66cff'].forEach((c, i) => grad.addColorStop(i / 4, c));
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 4; g.font = '48px Bangers, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeText('?', 32, 35); g.fillText('?', 32, 35);
  });
  face.wrapS = face.wrapT = THREE.ClampToEdgeWrapping;
  return group(rbox(1.6, 1.6, 1.6, 0.25, toon(0xffffff, { map: face })));
}

export function makeBolt(kind: string): THREE.Group {
  if (kind === 'shot') {
    const m = new THREE.MeshBasicMaterial({ color: 0xfff15c });
    m.userData.outlineParameters = { visible: false };
    const b = mesh(new THREE.CapsuleGeometry(0.2, 1.4, 4, 8), m);
    b.rotation.x = Math.PI / 2;
    return group(b);
  }
  const body = cyl(0.25, 0.25, 1.4, toon(0xff3b3b), 0, 0, 0, 10);
  const nose = mesh(new THREE.ConeGeometry(0.25, 0.5, 10), toon(0xffffff), 0, 0.95, 0);
  const fins = [0, 1, 2, 3].map((i) => { const f = rbox(0.05, 0.4, 0.5, 0.02, toon(0x333333), Math.cos((i * Math.PI) / 2) * 0.3, -0.5, Math.sin((i * Math.PI) / 2) * 0.3); f.rotation.y = (i * Math.PI) / 2; return f; });
  const missile = group(body, nose, ...fins);
  missile.rotation.x = Math.PI / 2;
  return group(missile);
}

export function makeMine(): THREE.Group {
  const light = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  light.userData.outlineParameters = { visible: false };
  const spikes = [0, 1, 2, 3, 4, 5].map((i) => {
    const sp = mesh(new THREE.ConeGeometry(0.15, 0.5, 6), toon(0x555b66), Math.cos((i * Math.PI) / 3) * 0.7, 0.3, Math.sin((i * Math.PI) / 3) * 0.7);
    sp.rotation.z = -Math.cos((i * Math.PI) / 3) * 1.2;
    sp.rotation.x = Math.sin((i * Math.PI) / 3) * 1.2;
    return sp;
  });
  const g = group(mesh(new THREE.SphereGeometry(0.7, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x2b2f36)), sph(0.18, light, 0, 0.72, 0), ...spikes);
  g.userData.light = light;
  return g;
}

export function makeDrone(): THREE.Group {
  const dark = toon(0x2b2f36), prop = toon(0xd8dde4), light = toon(0xff3b3b, { outline: false });
  const rotors: THREE.Object3D[] = [];
  const d = group(rbox(1.6, 0.5, 1.6, 0.2, dark), sph(0.15, light, 0, 0.3, 0.8), cyl(0.04, 0.04, 2.6, dark, 0, -1.5, 0, 4));
  for (const [x, z] of [[1.2, 1.2], [-1.2, 1.2], [1.2, -1.2], [-1.2, -1.2]]) {
    const arm = rbox(Math.hypot(x, z), 0.15, 0.25, 0.05, dark, x / 2, 0, z / 2);
    arm.rotation.y = Math.atan2(-z, x);
    const rotor = cyl(0.7, 0.7, 0.05, prop, x, 0.3, z, 12);
    rotors.push(rotor);
    d.add(arm, rotor);
  }
  d.userData.rotors = rotors;
  return d;
}

/** A Player's name in gold, a Bot's in grey, so you can tell who is who. */
export function makeNameTag(name: string, human: boolean): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d')!;
  g.font = '40px Bangers, Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 7;
  g.lineJoin = 'round';
  g.strokeStyle = '#111';
  g.strokeText(name, 128, 34);
  g.fillStyle = human ? '#ffd60a' : '#c9ced6';
  g.fillText(name, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(4, 1, 1);
  sprite.position.y = 2.6;
  return sprite;
}
