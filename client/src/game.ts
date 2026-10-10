import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import type { Room } from '@colyseus/sdk';
import type RAPIER from '@dimforge/rapier3d-compat';
import {
  type BodyKind, type Car, type Input, DT, MAX_ENERGY, NO_INPUT, createCar, createTrackWorld, driveCar, limpScale, setKinematicPose,
  teleport, yawOfBody,
} from '../../shared/src/car.ts';
import { LAPS, type Phase, SEATS } from '../../shared/src/race.ts';
import {
  type Pose, type Progress, type Track, FALL_Y, TRACKS, buildTrack, inPuddle, nearestSample, resetToCheckpoint, right, startProgress,
  updateProgress,
} from '../../shared/src/track.ts';
import { Particles } from './effects.ts';
import { SEAT_COLORS, type TrackScene, buildTrackScene, makeBattery, makeCar, makeDrone, makeNameTag } from './scene.ts';

/** Mirrors server/src/RaceRoom.ts. */
interface CarState {
  name: string; body: BodyKind; owner: string; x: number; y: number; z: number; yaw: number; vx: number; vz: number;
  lap: number; position: number; finished: boolean; spawn: number; energy: number; airlifted: boolean;
}
interface BatteryState { id: number; x: number; z: number }
interface List<T> { forEach(cb: (item: T, i: number) => void): void }
interface RaceState { phase: Phase; timer: number; trackId: string; cars: List<CarState>; results: List<string>; batteries: List<BatteryState> }

interface CarView {
  mesh: THREE.Group; tag: THREE.Sprite; drone: THREE.Group; name: string; kind: BodyKind; mine: boolean; car: Car;
  target: Pose & { vx: number; vz: number; at: number };
  shown: Pose;
  airlifted: boolean;
  lastY: number;
}

export interface Hud { pos: HTMLElement; lap: HTMLElement; msg: HTMLElement; results: HTMLOListElement; energy: HTMLElement; energyFill: HTMLElement; popups: HTMLElement }

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function dispose(obj: THREE.Object3D) {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Sprite || o instanceof THREE.Points) {
      o.geometry.dispose();
      for (const m of [o.material].flat()) { (m as THREE.MeshToonMaterial).map?.dispose(); m.dispose(); }
    }
  });
}

/** Runs one online session: our E-Car is simulated here, every other E-Car follows the server. Returns a stop function. */
export function startGame(room: Room, readInput: () => Input, hud: Hud): () => void {
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
  scene.add(splash.points, smoke.points, sparks.points);
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    const scale = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan((camera.fov * Math.PI) / 360));
    for (const p of [splash, smoke, sparks]) p.setScale(scale);
  };
  resize();
  addEventListener('resize', resize);

  let track: Track | undefined, world: RAPIER.World | undefined, look: TrackScene | undefined;
  let state: RaceState | undefined, me: CarState | undefined;
  let own: { view: CarView; progress: Progress; spawn: number; lockedUntil: number } | undefined;
  const views: CarView[] = [];
  const batteries = new Map<number, THREE.Group>();
  let clock = 0, ticks = 0, status = '';

  function loadTrack(id: string) {
    for (const v of views) { scene.remove(v.mesh, v.drone); dispose(v.mesh); dispose(v.drone); }
    views.length = 0;
    for (const b of batteries.values()) { scene.remove(b); dispose(b); }
    batteries.clear();
    own = undefined;
    world?.free();
    if (look) { scene.remove(look.group); dispose(look.group); look.background.dispose(); }
    track = buildTrack(TRACKS.find((t) => t.id === id) ?? TRACKS[0]);
    world = createTrackWorld(track);
    look = buildTrackScene(track);
    scene.add(look.group);
    scene.background = look.background;
    const img = look.background.image as HTMLCanvasElement;
    scene.fog = new THREE.Fog(new THREE.Color().setStyle(skyBottom(img)), 140, 320);
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
        target: { ...pose, vx: c.vx, vz: c.vz, at: performance.now() }, shown: { ...pose }, airlifted: false, lastY: c.y,
      };
      if (mine) own = { view: v, progress: startProgress(track!, 0), spawn: -1, lockedUntil: 0 };
    }
    if (v.name !== c.name) {
      v.mesh.remove(v.tag);
      dispose(v.tag);
      v.mesh.add((v.tag = makeNameTag(c.name)));
      v.name = c.name;
    }
    v.airlifted = c.airlifted;
    if (!mine) { v.target = { ...pose, vx: c.vx, vz: c.vz, at: performance.now() }; return; }
    // Battery pickups and Rams show up as jumps; driving drains too slowly to trigger this
    const gained = me && !c.airlifted ? c.energy - me.energy : 0;
    if (Math.abs(gained) > 4) popup(`${gained > 0 ? '+' : ''}${Math.round(gained)}`, gained > 0 ? 'gain' : 'loss');
    me = { ...c };
    if (own!.spawn !== c.spawn) {
      // the race moved our E-Car (new Race grid, Airlift, or we just took over a Bot)
      teleport(v.car, pose, c.vx, c.vz);
      own!.spawn = c.spawn;
      own!.progress = startProgress(track!, nearestSample(track!, c.x, c.z));
    }
  }

  function syncBatteries(list: List<BatteryState>) {
    const seen = new Set<number>();
    list.forEach((b) => {
      seen.add(b.id);
      if (batteries.has(b.id)) return;
      const mesh = makeBattery();
      mesh.position.set(b.x, 1.1, b.z);
      mesh.userData.phase = b.id;
      batteries.set(b.id, mesh);
      scene.add(mesh);
    });
    for (const [id, mesh] of batteries) {
      if (seen.has(id)) continue;
      for (let k = 0; k < 18; k++) sparks.emit(mesh.position.x, mesh.position.y, mesh.position.z, (Math.random() - 0.5) * 8, Math.random() * 7, (Math.random() - 0.5) * 8, 0.5, 0.6);
      scene.remove(mesh);
      dispose(mesh);
      batteries.delete(id);
    }
  }

  function popup(text: string, kind: 'gain' | 'loss') {
    const el = Object.assign(document.createElement('div'), { textContent: text, className: `popup ${kind}` });
    hud.popups.append(el);
    setTimeout(() => el.remove(), 1200);
  }

  room.onStateChange((s: RaceState) => {
    state = s;
    if (s.trackId !== track?.def.id) loadTrack(s.trackId);
    s.cars.forEach(syncCar);
    syncBatteries(s.batteries);
  });
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
      const locked = state.phase === 'grid' || clock < own.lockedUntil || me.airlifted;
      driveCar(world, own.view.car, locked ? NO_INPUT : readInput(), limpScale(me.energy), inPuddle(track, t.x, t.z));
    }
    world.step();
    clock += DT;
    if (!own) return;
    const rb = own.view.car.rb, t = rb.translation();
    if (t.y < FALL_Y) {
      teleport(own.view.car, resetToCheckpoint(track, own.progress));
      own.lockedUntil = clock + 1;
    } else updateProgress(track, own.progress, t.x, t.z);
    if (++ticks % 3 === 0) {
      const v = rb.linvel();
      room.send('pose', { x: t.x, y: t.y, z: t.z, yaw: yawOfBody(rb), vx: v.x, vz: v.z, spawn: own.spawn });
    }
  }

  /** Splashes in Puddles and bath water, smoke while drifting, spinning wheels, hovering drones. */
  function animateCars(dt: number, time: number) {
    if (!track || !look) return;
    for (const v of views) {
      const p = v.mesh.position, yaw = v.mesh.rotation.y;
      const vel = v.mine ? v.car.rb.linvel() : { x: v.target.vx, z: v.target.vz };
      const speed = Math.hypot(vel.x, vel.z);
      const fx = Math.sin(yaw), fz = Math.cos(yaw), r = right(fx, fz);
      const forward = vel.x * fx + vel.z * fz, sideways = vel.x * r.x + vel.z * r.z;
      for (const w of v.mesh.userData.wheels as THREE.Object3D[]) w.rotateY((-forward * dt) / 0.44);
      if (speed > 3 && inPuddle(track, p.x, p.z)) {
        for (let k = 0; k < Math.ceil(speed / 5); k++) {
          splash.emit(p.x + (Math.random() - 0.5) * 2, 0.2, p.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 5 + vel.x * 0.3, 3 + Math.random() * 5, (Math.random() - 0.5) * 5 + vel.z * 0.3, 0.35 + Math.random() * 0.3, 0.7);
        }
      }
      if (Math.abs(sideways) > 3.5 && p.y > -0.2) {
        smoke.emit(p.x - fx * 1.6 + (Math.random() - 0.5), 0.1, p.z - fz * 1.6 + (Math.random() - 0.5), 0, 0.5, 0, 0.7, 0.8);
      }
      if (look.water && v.lastY > look.groundY && p.y <= look.groundY) {
        for (let k = 0; k < 50; k++) splash.emit(p.x, look.groundY, p.z, (Math.random() - 0.5) * 9, 5 + Math.random() * 8, (Math.random() - 0.5) * 9, 0.5 + Math.random() * 0.5, 1);
      }
      v.lastY = p.y;
      v.drone.visible = v.airlifted;
      if (v.airlifted) {
        v.drone.position.set(p.x, p.y + 2.4 + Math.sin(time * 6) * 0.15, p.z);
        for (const rotor of v.drone.userData.rotors as THREE.Object3D[]) rotor.rotation.y += dt * 40;
      }
    }
    for (const b of batteries.values()) {
      b.rotation.y = time * 2;
      b.position.y = 1.1 + Math.sin(time * 3 + b.userData.phase) * 0.25;
    }
  }

  let lastMsg = '', lastResults = '', goUntil = 0, lastPhase: Phase | undefined;
  function updateHud(now: number) {
    if (!state) return;
    if (lastPhase === 'grid' && state.phase === 'racing') goUntil = now + 1000;
    lastPhase = state.phase;
    const left = Math.ceil(state.timer);
    const names: string[] = [];
    state.results.forEach((n) => names.push(n));
    let msg = status;
    if (!msg && state.phase === 'grid') msg = names.length ? `Next race in ${left}` : String(left);
    else if (!msg && me?.airlifted) msg = 'Airlift!';
    else if (!msg && me?.finished) msg = `Finished P${me.position}!`;
    else if (!msg && state.phase === 'finishing') msg = `Race ends in ${left}`;
    else if (!msg && now < goUntil) msg = 'GO!';
    hud.pos.textContent = me ? `P${me.position}/${SEATS}` : '';
    hud.lap.textContent = me ? `Lap ${me.lap}/${LAPS}` : '';
    if (msg !== lastMsg) hud.msg.textContent = lastMsg = msg;
    const energy = me?.energy ?? MAX_ENERGY;
    hud.energyFill.style.width = `${energy}%`;
    if (hud.energy.getAttribute('aria-valuenow') !== String(energy)) hud.energy.setAttribute('aria-valuenow', String(energy));
    hud.energy.dataset.level = energy < 25 ? 'limp' : energy < 50 ? 'low' : 'ok';
    const shown = state.phase === 'grid' ? names.join('\n') : '';
    if (shown !== lastResults) {
      lastResults = shown;
      hud.results.replaceChildren(...(shown ? names : []).map((n) => Object.assign(document.createElement('li'), { textContent: n })));
    }
  }

  let raf = 0, acc = 0, last = performance.now();
  const focus = new THREE.Vector3();
  function frame(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (acc += dt; acc >= DT; acc -= DT) tick();
    for (const v of views) {
      const p = v.mine ? v.car.rb.translation() : v.shown;
      v.mesh.position.set(p.x, p.y, p.z);
      v.mesh.rotation.y = v.mine ? yawOfBody(v.car.rb) : v.shown.yaw;
    }
    animateCars(dt, now / 1000);
    for (const p of [splash, smoke, sparks]) p.update(dt);
    look?.update(now / 1000);
    const target = own?.view.mesh ?? views[0]?.mesh;
    if (target) {
      const fx = Math.sin(target.rotation.y), fz = Math.cos(target.rotation.y);
      // portrait phones see little sideways, so look down more steeply
      const [back, up] = camera.aspect < 1 ? [9, 24] : [13, 14];
      const desired = new THREE.Vector3(target.position.x - fx * back, target.position.y + up, target.position.z - fz * back);
      camera.position.lerp(desired, 1 - Math.exp(-dt * 4));
      camera.lookAt(focus.set(target.position.x + fx * 3, target.position.y, target.position.z + fz * 3));
    }
    effect.render(scene, camera);
    updateHud(now);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
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
