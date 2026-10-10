import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import type RAPIER from '@dimforge/rapier3d-compat';
import {
  type BodyKind, type Car, DT, HALF, NO_INPUT, createCar, createTrackWorld, driveCar, haltInput, limpScale, setKinematicPose,
  teleport, yawOfBody,
} from '../../shared/src/car.ts';
import { RECHARGE_TIME, type RaceEvent, STRANDED_TIME } from '../../shared/src/race.ts';
import {
  type Pose, type Progress, type Track, FALL_Y, TRACKS, buildTrack, inPuddle, nearestSample, resetToCheckpoint, right, startProgress,
  updateProgress,
} from '../../shared/src/track.ts';
import type { Sound } from './audio.ts';
import { Particles } from './effects.ts';
import { type Hud, ITEM_ICONS, createHud } from './hud.ts';
import type { Controls } from './input.ts';
import {
  SEAT_COLORS, type TrackScene, buildTrackScene, makeBattery, makeBolt, makeCar, makeDrone, makeItemBox, makeMine, makeNameTag,
} from './scene.ts';
import { RECHARGE, type BoltState, type CarState, DRIVING, type List, type RaceLink, type RaceState, STRANDED, type Spot } from './state.ts';

interface CarView {
  mesh: THREE.Group; tag: THREE.Sprite; drone: THREE.Group; name: string; kind: BodyKind; mine: boolean; car: Car;
  target: Pose & { vx: number; vz: number; at: number };
  shown: Pose;
  energy: number;
  mode: number;
  prevMode: number;
  modeSince: number;
  lastY: number;
  /** Height of the road under the E-Car. */
  roadY: number;
  wet: boolean;
}

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const smooth = (k: number) => k * k * (3 - 2 * k);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Rise of the road per metre along the Track at sample `i`. */
const gradeAt = (track: Track, i: number) => {
  const a = track.samples[(i - 1 + track.n) % track.n], b = track.samples[(i + 1) % track.n];
  return (b.y - a.y) / Math.hypot(b.x - a.x, b.z - a.z);
};

function dispose(obj: THREE.Object3D) {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Sprite || o instanceof THREE.Points) {
      o.geometry.dispose();
      for (const m of [o.material].flat()) { (m as THREE.MeshToonMaterial).map?.dispose(); m.dispose(); }
    }
  });
}

/** Runs one online session: our E-Car is simulated here, every other E-Car follows the server. Returns a stop function. */
export function startGame(room: RaceLink, controls: Controls, hud: Hud, sound: Sound): () => void {
  const ui = createHud(hud, sound);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.body.prepend(renderer.domElement);
  const effect = new OutlineEffect(renderer, { defaultThickness: 0.0042, defaultColor: [0.07, 0.05, 0.05] });
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a7a5a, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(40, 80, 25);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 600);
  const splash = new Particles(0xd4f1ff, 500), smoke = new Particles(0xf4f4f4, 300, 1.5, 2.2), sparks = new Particles(0x8dff9e, 200, -6);
  const fire = new Particles(0xffa424, 300, -4, 1.5), soot = new Particles(0x55565c, 200, 1.5, 2.5);
  const allParticles = [splash, smoke, sparks, fire, soot];
  for (const p of allParticles) scene.add(p.points);
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    const scale = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan((camera.fov * Math.PI) / 360));
    for (const p of allParticles) p.setScale(scale);
  };
  resize();
  addEventListener('resize', resize);

  let track: Track | undefined, world: RAPIER.World | undefined, look: TrackScene | undefined;
  let state: RaceState | undefined, me: CarState | undefined;
  let own: { view: CarView; seat: number; progress: Progress; spawn: number; lockedUntil: number } | undefined;
  const views: CarView[] = [];
  const batteries = new Map<number, THREE.Group>(), mines = new Map<number, THREE.Group>();
  const bolts = new Map<number, { mesh: THREE.Group; s: BoltState; at: number }>();
  let boxes: THREE.Group[] = [];
  let clock = 0, ticks = 0, status = '', shake = 0, nextShot = 0, nextBeep = 0, roulette = 0;

  function loadTrack(id: string) {
    for (const v of views) { scene.remove(v.mesh, v.drone); dispose(v.mesh); dispose(v.drone); }
    views.length = 0;
    for (const m of [...batteries.values(), ...mines.values(), ...[...bolts.values()].map((b) => b.mesh), ...boxes]) { scene.remove(m); dispose(m); }
    batteries.clear(); mines.clear(); bolts.clear();
    own = undefined;
    world?.free();
    if (look) { scene.remove(look.group); dispose(look.group); look.background.dispose(); }
    track = buildTrack(TRACKS.find((t) => t.id === id) ?? TRACKS[0]);
    // every Track has its own song
    sound.music(TRACKS.indexOf(track.def));
    world = createTrackWorld(track);
    look = buildTrackScene(track);
    scene.add(look.group);
    scene.background = look.background;
    scene.fog = new THREE.Fog(new THREE.Color().setStyle(skyBottom(look.background.image as HTMLCanvasElement)), 140, 320);
    boxes = track.itemBoxes.map((b) => { const box = makeItemBox(); box.position.set(b.x, b.y + 0.8, b.z); box.userData.baseY = b.y + 0.8; scene.add(box); return box; });
  }

  function syncCar(c: CarState, i: number) {
    const mine = c.owner === room.sessionId;
    const pose = { x: c.x, y: c.y, z: c.z, yaw: c.yaw };
    let v = views[i];
    if (!v || v.kind !== c.body || v.mine !== mine) {
      if (v) { scene.remove(v.mesh, v.drone); dispose(v.mesh); dispose(v.drone); world!.removeRigidBody(v.car.rb); }
      const mesh = makeCar(c.body, SEAT_COLORS[i]), tag = makeNameTag(c.name), drone = makeDrone();
      mesh.add(tag);
      drone.visible = false;
      scene.add(mesh, drone);
      v = views[i] = {
        mesh, tag, drone, name: c.name, kind: c.body, mine, car: createCar(world!, c.body, pose, mine),
        target: { ...pose, vx: c.vx, vz: c.vz, at: performance.now() }, shown: { ...pose },
        energy: c.energy, mode: c.mode, prevMode: c.mode, modeSince: performance.now(), lastY: c.y, roadY: 0, wet: false,
      };
      if (mine) own = { view: v, seat: i, progress: startProgress(track!, 0), spawn: -1, lockedUntil: 0 };
    }
    if (v.name !== c.name) {
      v.mesh.remove(v.tag);
      dispose(v.tag);
      v.mesh.add((v.tag = makeNameTag(c.name)));
      v.name = c.name;
    }
    if (v.mode !== c.mode) { v.prevMode = v.mode; v.mode = c.mode; v.modeSince = performance.now(); }
    v.energy = c.energy;
    (v.mesh.userData.shield as THREE.Object3D).visible = c.shield;
    if (!mine) { v.target = { ...pose, vx: c.vx, vz: c.vz, at: performance.now() }; return; }
    // Battery pickups, Rams and Hits show up as jumps; driving drains too slowly to trigger this
    const gained = me && c.mode === DRIVING && me.mode === DRIVING ? c.energy - me.energy : 0;
    if (Math.abs(gained) > 4) ui.popup(`${gained > 0 ? '+' : ''}${Math.round(gained)}`, gained > 0 ? 'gain' : 'loss');
    if (me && !me.finished && c.finished) sound.fanfare();
    if (roulette < performance.now()) hud.item.textContent = ITEM_ICONS[c.item] ?? '';
    me = { ...c };
    if (own!.spawn !== c.spawn) {
      // the race moved our E-Car (new Race grid, or we just took over a Bot)
      teleport(v.car, pose, c.vx, c.vz);
      own!.spawn = c.spawn;
      own!.progress = startProgress(track!, nearestSample(track!, c.x, c.y, c.z));
    }
  }

  /** `lift`: how high above the reported height the model floats. */
  function syncSpots(list: List<Spot>, map: Map<number, THREE.Group>, make: () => THREE.Group, lift: number, gone?: (m: THREE.Group) => void) {
    const seen = new Set<number>();
    list.forEach((b) => {
      seen.add(b.id);
      if (map.has(b.id)) return;
      const mesh = make();
      mesh.position.set(b.x, b.y + lift, b.z);
      mesh.userData.phase = b.id;
      mesh.userData.baseY = b.y + lift;
      map.set(b.id, mesh);
      scene.add(mesh);
    });
    for (const [id, mesh] of map) {
      if (seen.has(id)) continue;
      gone?.(mesh);
      scene.remove(mesh);
      dispose(mesh);
      map.delete(id);
    }
  }

  function syncBolts(list: List<BoltState>) {
    const seen = new Set<number>(), now = performance.now();
    list.forEach((b) => {
      seen.add(b.id);
      const known = bolts.get(b.id);
      if (known) { known.s = { ...b }; known.at = now; return; }
      const mesh = makeBolt(b.kind);
      mesh.position.set(b.x, b.y + 0.45, b.z);
      scene.add(mesh);
      bolts.set(b.id, { mesh, s: { ...b }, at: now });
    });
    for (const [id, b] of bolts) if (!seen.has(id)) { scene.remove(b.mesh); dispose(b.mesh); bolts.delete(id); }
  }

  /** Louder the closer it happens to our E-Car. */
  const near = (x: number, z: number) => {
    const p = own?.view.mesh.position ?? camera.position;
    return Math.max(0, 1 - Math.hypot(p.x - x, p.z - z) / 70);
  };
  const posOf = (seat: number) => views[seat]?.mesh.position ?? new THREE.Vector3();

  function explode(x: number, z: number) {
    for (let k = 0; k < 40; k++) fire.emit(x, 0.8, z, (Math.random() - 0.5) * 12, Math.random() * 9, (Math.random() - 0.5) * 12, 0.8 + Math.random() * 0.6, 0.6);
    for (let k = 0; k < 14; k++) soot.emit(x + (Math.random() - 0.5) * 2, 1, z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2, 1.2, 1.2);
  }

  function onEvent(e: RaceEvent) {
    const mySeat = own?.seat ?? -1;
    if (e.t === 'ram') {
      const p = posOf(e.b), vol = e.a === mySeat || e.b === mySeat ? 1 : near(p.x, p.z);
      sound.crash(vol);
      sound.cry('hurt', e.b, vol);
      sound.cry('gloat', e.a, vol, 0.35);
      for (let k = 0; k < 12; k++) sparks.emit(p.x, 0.8, p.z, (Math.random() - 0.5) * 10, Math.random() * 6, (Math.random() - 0.5) * 10, 0.35, 0.4);
      if (e.b === mySeat) shake = 0.35;
    } else if (e.t === 'hit') {
      const p = posOf(e.s), mine = e.s === mySeat;
      if (e.kind !== 'shot') {
        const by = posOf(e.by);
        sound.cry('thrown', e.s, mine ? 1 : near(p.x, p.z));
        sound.cry('gloat', e.by, e.by === mySeat ? 1 : near(by.x, by.z), 0.6);
      }
      if (mine && own) {
        // we drive our own E-Car, so we apply the shove the server worked out
        const v = own.view.car.rb.linvel();
        own.view.car.rb.setLinvel({ x: v.x + e.ix, y: v.y + e.hop, z: v.z + e.iz }, true);
        own.view.car.spin = e.spin;
        shake = e.kind === 'shot' ? 0.15 : 0.5;
      }
      if (e.kind === 'shot') for (let k = 0; k < 8; k++) sparks.emit(p.x, 0.9, p.z, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6, 0.3, 0.3);
    } else if (e.t === 'boom') {
      explode(e.x, e.z);
      sound.boom(near(e.x, e.z));
    } else if (e.t === 'block') {
      const p = posOf(e.s);
      sound.block(e.s === mySeat ? 1 : near(p.x, p.z));
    } else if (e.t === 'battery') {
      const p = posOf(e.s);
      sound.battery(e.s === mySeat ? 1 : near(p.x, p.z) * 0.4);
    } else if (e.t === 'shot') {
      const p = posOf(e.s);
      sound.shot(e.s === mySeat ? 1 : near(p.x, p.z));
    } else if (e.t === 'item') {
      const p = posOf(e.s), vol = e.s === mySeat ? 1 : near(p.x, p.z);
      if (e.item === 'missile') sound.missile(vol);
      else if (e.item === 'mine') sound.mineDrop(vol);
      else if (e.s === mySeat) sound.shield();
    } else if (e.t === 'box' && e.s === mySeat) {
      sound.box();
      // a short roulette before the Item shows
      roulette = performance.now() + 500;
      const icons = Object.values(ITEM_ICONS).filter(Boolean);
      for (let k = 0; k < 5; k++) setTimeout(() => (hud.item.textContent = icons[k % icons.length]), k * 100);
      setTimeout(() => (hud.item.textContent = ITEM_ICONS[e.item]), 500);
    } else if (e.t === 'stranded') {
      const p = posOf(e.s);
      if (e.s === mySeat) sound.powerDown();
      sound.cry('despair', e.s, e.s === mySeat ? 1 : near(p.x, p.z), 0.3);
    } else if (e.t === 'recharge' && e.s === mySeat) sound.battery();
  }

  room.onStateChange((s: RaceState) => {
    state = s;
    if (s.trackId !== track?.def.id) loadTrack(s.trackId);
    s.cars.forEach(syncCar);
    syncSpots(s.batteries, batteries, makeBattery, 1.1, (m) => {
      for (let k = 0; k < 18; k++) sparks.emit(m.position.x, m.position.y, m.position.z, (Math.random() - 0.5) * 8, Math.random() * 7, (Math.random() - 0.5) * 8, 0.5, 0.6);
    });
    syncSpots(s.mines, mines, makeMine, 0);
    syncBolts(s.bolts);
    s.boxes.forEach((on, i) => { if (boxes[i]) boxes[i].visible = on; });
  });
  room.onMessage('events', (list: RaceEvent[]) => list.forEach(onEvent));
  room.onDrop(() => (status = 'Reconnecting…'));
  room.onReconnect(() => (status = ''));

  function tick() {
    if (!world || !track || !state) return;
    const now = performance.now();
    for (const v of views) {
      if (v.mine) continue;
      const age = Math.min((now - v.target.at) / 1000, 0.25);
      const x = v.target.x + v.target.vx * age, z = v.target.z + v.target.vz * age;
      const k = Math.hypot(x - v.shown.x, z - v.shown.z) > 5 ? 1 : 0.3;
      v.shown.x += (x - v.shown.x) * k;
      v.shown.y += (v.target.y - v.shown.y) * k;
      v.shown.z += (z - v.shown.z) * k;
      v.shown.yaw += angleDiff(v.shown.yaw, v.target.yaw) * k;
      setKinematicPose(v.car, v.shown);
    }
    if (own && me) {
      const t = own.view.car.rb.translation();
      const locked = state.phase === 'grid' || clock < own.lockedUntil || me.mode !== DRIVING;
      const input = me.mode === STRANDED ? haltInput(own.view.car) : locked ? NO_INPUT : controls.drive();
      driveCar(world, own.view.car, input, limpScale(me.energy), inPuddle(track, t));
      if (!locked) {
        // a press uses the Item when there is one, and only shoots otherwise (on touch both come from one button)
        if (controls.takeItemPress() && me.item) { room.send('item'); nextShot = now + 600; }
        else if (controls.firing() && now >= nextShot) { room.send('shoot'); nextShot = now + 340; }
      }
    }
    world.step();
    clock += DT;
    if (!own) return;
    const rb = own.view.car.rb, t = rb.translation();
    if (t.y < track.samples[own.progress.idx].y + FALL_Y) {
      teleport(own.view.car, resetToCheckpoint(track, own.progress));
      own.lockedUntil = clock + 1;
    } else updateProgress(track, own.progress, t.x, t.z);
    if (++ticks % 3 === 0) {
      const v = rb.linvel();
      room.send('pose', { x: t.x, y: t.y, z: t.z, yaw: yawOfBody(rb), vx: v.x, vz: v.z, spawn: own.spawn });
    }
  }

  /**
   * Out of energy: Stranded and jerking on the spot while a drone flies in, then the drone hovers
   * over the E-Car sending charge down into it (the Recharge), and flies off once it's full.
   */
  function dronePose(v: CarView, time: number) {
    const since = (performance.now() - v.modeSince) / 1000;
    let droneY = -1, jerk = 0;
    if (v.mode === STRANDED) {
      jerk = Math.max(0, 1 - since / (STRANDED_TIME - 0.4));
      if (since > 0.6) droneY = 14 - smooth(Math.min(1, (since - 0.6) / 0.6)) * 11.4;
    } else if (v.mode === RECHARGE) {
      droneY = 2.6 + Math.sin(time * 5) * 0.15;
      const p = v.mesh.position;
      if (Math.random() < 0.6) sparks.emit(p.x + (Math.random() - 0.5) * 0.6, p.y + 2.2, p.z + (Math.random() - 0.5) * 0.6, 0, -6, 0, 0.3, 0.35);
    } else if (v.prevMode === RECHARGE && since < 0.6) droneY = 2.6 + since ** 2 * 40;
    const p = v.mesh.position;
    p.y += Math.abs(Math.sin(time * 23)) * 0.15 * jerk;
    v.mesh.rotation.z = Math.sin(time * 31) * 0.1 * jerk;
    v.mesh.rotation.x += Math.sin(time * 19) * 0.06 * jerk;
    if (jerk > 0 && Math.random() < 0.3) soot.emit(p.x, p.y + 0.3, p.z, Math.random() - 0.5, 1.5, Math.random() - 0.5, 0.8, 0.9);
    v.drone.visible = droneY >= 0;
    if (v.drone.visible) {
      v.drone.position.set(p.x, p.y + droneY, p.z);
      v.drone.rotation.y = v.mesh.rotation.y;
      for (const rotor of v.drone.userData.rotors as THREE.Object3D[]) rotor.rotation.y += 0.9;
    }
    return v.drone.visible;
  }

  /** Splashes, drift smoke, spinning wheels, warning lights, drones, Batteries, Item Boxes and flying weapons. */
  function animate(dt: number, time: number) {
    if (!track || !look) return;
    let ownDrone = false;
    for (const v of views) {
      const p = v.mesh.position, yaw = v.mesh.rotation.y;
      const vel = v.mine ? v.car.rb.linvel() : { x: v.target.vx, z: v.target.vz };
      const speed = Math.hypot(vel.x, vel.z);
      const fx = Math.sin(yaw), fz = Math.cos(yaw), r = right(fx, fz);
      const forward = vel.x * fx + vel.z * fz, sideways = vel.x * r.x + vel.z * r.z;
      for (const w of v.mesh.userData.wheels as THREE.Object3D[]) w.rotateY((-forward * dt) / 0.44);
      const wet = inPuddle(track, p);
      if (speed > 3 && wet) {
        for (let k = 0; k < Math.ceil(speed / 5); k++) {
          splash.emit(p.x + (Math.random() - 0.5) * 2, v.roadY + 0.2, p.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 5 + vel.x * 0.3, 3 + Math.random() * 5, (Math.random() - 0.5) * 5 + vel.z * 0.3, 0.35 + Math.random() * 0.3, 0.7);
        }
        if (!v.wet) sound.splash(v.mine ? 1 : near(p.x, p.z));
      }
      v.wet = wet;
      if (Math.abs(sideways) > 3.5 && p.y > v.roadY - 0.2) smoke.emit(p.x - fx * 1.6 + (Math.random() - 0.5), v.roadY + 0.1, p.z - fz * 1.6 + (Math.random() - 0.5), 0, 0.5, 0, 0.7, 0.8);
      if (look.water && v.lastY > look.groundY && p.y <= look.groundY) {
        for (let k = 0; k < 50; k++) splash.emit(p.x, look.groundY, p.z, (Math.random() - 0.5) * 9, 5 + Math.random() * 8, (Math.random() - 0.5) * 9, 0.5 + Math.random() * 0.5, 1);
        sound.splash(v.mine ? 1.5 : near(p.x, p.z));
      }
      v.lastY = p.y;
      const flying = dronePose(v, time);
      if (v.mine) ownDrone = flying;
      // red roof light: slow below a quarter of the Energy, fast when nearly or completely empty
      const low = v.energy < 25 || v.mode === STRANDED;
      const urgent = v.energy < 10 || v.mode === STRANDED;
      const beacon = v.mesh.userData.beacon as THREE.Object3D;
      beacon.visible = low && v.mode !== RECHARGE;
      (v.mesh.userData.halo as THREE.Object3D).visible = Math.floor(time * (urgent ? 8 : 4)) % 2 === 0;
    }
    if (own && me) {
      const v = own.view.car.rb.linvel(), t = own.view.car.rb.translation();
      const yaw = yawOfBody(own.view.car.rb), r = right(Math.sin(yaw), Math.cos(yaw));
      const driving = me.mode === DRIVING && state?.phase !== 'grid';
      sound.drive(driving ? Math.hypot(v.x, v.z) : 0, driving ? controls.drive().throttle : 0, driving && t.y > own.view.roadY - 0.2 ? (Math.abs(v.x * r.x + v.z * r.z) - 3) / 4 : 0);
      sound.setDrone(ownDrone);
      if (driving && me.energy < 25 && time > nextBeep) {
        sound.lowBattery(me.energy < 10);
        nextBeep = time + (me.energy < 10 ? 0.35 : 0.8);
      }
    }
    for (const b of batteries.values()) { b.rotation.y = time * 2; b.position.y = b.userData.baseY + Math.sin(time * 3 + b.userData.phase) * 0.25; }
    boxes.forEach((b, i) => { b.rotation.y = time * 1.5 + i; b.rotation.x = Math.sin(time + i) * 0.3; b.position.y = b.userData.baseY + Math.sin(time * 2 + i) * 0.2; });
    for (const m of mines.values()) (m.userData.light as THREE.MeshBasicMaterial).color.setHex(Math.floor(time * 3) % 2 ? 0xff2020 : 0x441111);
    const now = performance.now();
    for (const b of bolts.values()) {
      const age = Math.min((now - b.at) / 1000, 0.2);
      b.mesh.position.set(b.s.x + b.s.vx * age, b.s.y + 0.45, b.s.z + b.s.vz * age);
      b.mesh.rotation.y = Math.atan2(b.s.vx, b.s.vz);
      if (b.s.kind === 'missile') smoke.emit(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z, 0, 0.3, 0, 0.5, 0.5);
    }
  }

  let raf = 0, acc = 0, last = performance.now();
  const focus = new THREE.Vector3(), lastTarget = new THREE.Vector3();
  function frame(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (acc += dt; acc >= DT; acc -= DT) tick();
    for (const v of views) {
      const p = v.mine ? v.car.rb.translation() : v.shown, yaw = v.mine ? yawOfBody(v.car.rb) : v.shown.yaw;
      const i = v.mine ? own!.progress.idx : nearestSample(track!, p.x, p.y, p.z), s = track!.samples[i];
      v.roadY = s.y;
      // the bodies stay level, so on a ramp tilt the model along it and set it down onto the road
      const along = p.y - s.y < HALF.y + 0.8 ? clamp(gradeAt(track!, i), -0.4, 0.4) * (Math.sin(yaw) * s.dx + Math.cos(yaw) * s.dz) : 0;
      v.mesh.position.set(p.x, p.y - Math.abs(along) * HALF.z, p.z);
      v.mesh.rotation.set(-Math.atan(along), yaw, 0, 'YXZ');
    }
    animate(dt, now / 1000);
    for (const p of allParticles) p.update(dt);
    look?.update(now / 1000);
    const target = own?.view.mesh ?? views[0]?.mesh;
    if (target) {
      const fx = Math.sin(target.rotation.y), fz = Math.cos(target.rotation.y);
      // portrait phones see little sideways, so look down more steeply
      const [back, up] = camera.aspect < 1 ? [9, 24] : [13, 14];
      const desired = new THREE.Vector3(target.position.x - fx * back, target.position.y + up, target.position.z - fz * back);
      // a far jump (a new Race) cuts instead of flying the camera across the Track
      if (lastTarget.distanceTo(target.position) > 25) camera.position.copy(desired);
      else camera.position.lerp(desired, 1 - Math.exp(-dt * 4));
      lastTarget.copy(target.position);
      camera.lookAt(focus.set(target.position.x + fx * 3, target.position.y, target.position.z + fz * 3));
      if (shake > 0) {
        shake = Math.max(0, shake - dt);
        camera.position.x += (Math.random() - 0.5) * shake * 1.5;
        camera.position.y += (Math.random() - 0.5) * shake * 1.5;
      }
    }
    effect.render(scene, camera);
    ui.update(now, state, me, status);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    sound.silenceLoops();
    dispose(scene);
    look?.background.dispose();
    world?.free();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

/** Bottom colour of the sky gradient, so the fog melts into it. */
function skyBottom(canvas: HTMLCanvasElement) {
  const [r, g, b] = canvas.getContext('2d')!.getImageData(0, canvas.height - 1, 1, 1).data;
  return `rgb(${r},${g},${b})`;
}
