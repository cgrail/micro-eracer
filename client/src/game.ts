import * as THREE from 'three';
import type { Room } from '@colyseus/sdk';
import type RAPIER from '@dimforge/rapier3d-compat';
import {
  type BodyKind, type Car, type Input, DT, NO_INPUT, createCar, createTrackWorld, driveCar, setKinematicPose, teleport, yawOfBody,
} from '../../shared/src/car.ts';
import { LAPS, type Phase, SEATS } from '../../shared/src/race.ts';
import {
  type Pose, type Progress, type Track, FALL_Y, TRACKS, buildTrack, nearestSample, resetToCheckpoint, startProgress, updateProgress,
} from '../../shared/src/track.ts';
import { SEAT_COLORS, buildTrackScene, makeCar, makeNameTag } from './scene.ts';

/** Mirrors server/src/RaceRoom.ts. */
interface CarState { name: string; body: BodyKind; owner: string; x: number; y: number; z: number; yaw: number; vx: number; vz: number; lap: number; position: number; finished: boolean; spawn: number }
interface RaceState { phase: Phase; timer: number; trackId: string; cars: { forEach(cb: (c: CarState, i: number) => void): void }; results: { forEach(cb: (name: string) => void): void } }

interface CarView {
  mesh: THREE.Group; tag: THREE.Sprite; name: string; kind: BodyKind; mine: boolean; car: Car;
  target: Pose & { vx: number; vz: number; at: number };
  shown: Pose;
}

export interface Hud { pos: HTMLElement; lap: HTMLElement; msg: HTMLElement; results: HTMLOListElement }

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function dispose(obj: THREE.Object3D) {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
      o.geometry.dispose();
      for (const m of [o.material].flat()) { (m as THREE.MeshLambertMaterial).map?.dispose(); m.dispose(); }
    }
  });
}

/** Runs one online session: our E-Car is simulated here, every other E-Car follows the server. Returns a stop function. */
export function startGame(room: Room, readInput: () => Input, hud: Hud): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.body.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3e9dc);
  scene.fog = new THREE.Fog(0xf3e9dc, 90, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a6a4a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(30, 60, 20);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 400);
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);

  let track: Track | undefined, world: RAPIER.World | undefined, trackGroup: THREE.Group | undefined;
  let state: RaceState | undefined, me: CarState | undefined;
  let own: { view: CarView; progress: Progress; spawn: number; lockedUntil: number } | undefined;
  const views: CarView[] = [];
  let clock = 0, ticks = 0, status = '';

  function loadTrack(id: string) {
    for (const v of views) { scene.remove(v.mesh); dispose(v.mesh); }
    views.length = 0;
    own = undefined;
    world?.free();
    if (trackGroup) { scene.remove(trackGroup); dispose(trackGroup); }
    track = buildTrack(TRACKS.find((t) => t.id === id) ?? TRACKS[0]);
    world = createTrackWorld(track);
    trackGroup = buildTrackScene(track);
    scene.add(trackGroup);
  }

  function syncCar(c: CarState, i: number) {
    const mine = c.owner === room.sessionId;
    const pose = { x: c.x, y: c.y, z: c.z, yaw: c.yaw };
    let v = views[i];
    if (!v || v.kind !== c.body || v.mine !== mine) {
      if (v) { scene.remove(v.mesh); dispose(v.mesh); world!.removeRigidBody(v.car.rb); }
      const mesh = makeCar(c.body, SEAT_COLORS[i]), tag = makeNameTag(c.name);
      mesh.add(tag);
      scene.add(mesh);
      v = views[i] = {
        mesh, tag, name: c.name, kind: c.body, mine, car: createCar(world!, c.body, pose, mine),
        target: { ...pose, vx: c.vx, vz: c.vz, at: performance.now() }, shown: { ...pose },
      };
      if (mine) own = { view: v, progress: startProgress(track!, 0), spawn: -1, lockedUntil: 0 };
    }
    if (v.name !== c.name) {
      v.mesh.remove(v.tag);
      dispose(v.tag);
      v.mesh.add((v.tag = makeNameTag(c.name)));
      v.name = c.name;
    }
    if (!mine) { v.target = { ...pose, vx: c.vx, vz: c.vz, at: performance.now() }; return; }
    me = c;
    if (own!.spawn !== c.spawn) {
      // the race moved our E-Car (new Race grid, or we just took over a Bot)
      teleport(v.car, pose, c.vx, c.vz);
      own!.spawn = c.spawn;
      own!.progress = startProgress(track!, nearestSample(track!, c.x, c.z));
    }
  }

  room.onStateChange((s: RaceState) => {
    state = s;
    if (s.trackId !== track?.def.id) loadTrack(s.trackId);
    s.cars.forEach(syncCar);
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
    if (own) driveCar(world, own.view.car, state.phase === 'grid' || clock < own.lockedUntil ? NO_INPUT : readInput());
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
    else if (!msg && me?.finished) msg = `Finished P${me.position}!`;
    else if (!msg && state.phase === 'finishing') msg = `Race ends in ${left}`;
    else if (!msg && now < goUntil) msg = 'GO!';
    hud.pos.textContent = me ? `P${me.position}/${SEATS}` : '';
    hud.lap.textContent = me ? `Lap ${me.lap}/${LAPS}` : '';
    if (msg !== lastMsg) hud.msg.textContent = lastMsg = msg;
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
    const target = own?.view.mesh ?? views[0]?.mesh;
    if (target) {
      const fx = Math.sin(target.rotation.y), fz = Math.cos(target.rotation.y);
      // portrait phones see little sideways, so look down more steeply
      const [back, up] = camera.aspect < 1 ? [9, 24] : [13, 14];
      const desired = new THREE.Vector3(target.position.x - fx * back, target.position.y + up, target.position.z - fz * back);
      camera.position.lerp(desired, 1 - Math.exp(-dt * 4));
      camera.lookAt(focus.set(target.position.x + fx * 3, target.position.y, target.position.z + fz * 3));
    }
    renderer.render(scene, camera);
    updateHud(now);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    dispose(scene);
    world?.free();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
