import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { BODIES, type BodyKind, type Car, DT, HALF, handleCar } from '../../shared/src/car.ts';
import { SHOT_EVERY, SHOT_LIFE, SHOT_SPEED } from '../../shared/src/combat.ts';
import { RigidBody } from '../../shared/src/physics.ts';
import { HALF_WIDTH, right } from '../../shared/src/track.ts';
import type { Sound } from './audio.ts';
import { makeCar } from './cars.ts';
import { Particles } from './effects.ts';
import type { Controls } from './input.ts';
import { angleDiff, chase } from './motion.ts';
import { makeBolt } from './scene.ts';
import { canvasTexture, dispose, mesh, rng, toon } from './toon.ts';

// The Practice Ground behind the start form's Controls button: the picked Body on an endless flat lawn with streets painted on
// it and nothing to bump into, driven by the touch controls as they are set right there, so each way of steering can be felt.

/** One block of the street grid, in metres: a street through its middle each way, as wide as a Track's road. */
const BLOCK = 64;
/** How many blocks the ground reaches across, centred on the E-Car: past the fog all round. Even, so the streets stay put. */
const BLOCKS = 12;
/** Texture pixels per metre. */
const PX = 16;

/** One block of the ground: a striped lawn, the two streets with white edges and dashed centre lines, and zebra crossings. */
function streets() {
  const size = BLOCK * PX, mid = size / 2, half = HALF_WIDTH * PX, m = (metres: number) => metres * PX;
  return canvasTexture(size, size, (g) => {
    for (let i = 0; i < BLOCK / 8; i++) { g.fillStyle = i % 2 ? '#6cc04a' : '#78cb55'; g.fillRect(0, m(i * 8), size, m(8)); }
    g.fillStyle = '#4f9e35';
    const r = rng('practice');
    for (let i = 0; i < 500; i++) { const x = Math.floor(r() * size), y = Math.floor(r() * size); g.fillRect(x, y, 3, 8); g.fillRect(x + 4, y + 2, 3, 6); }
    // drawn along x, then turned a quarter for the street along y
    const street = () => {
      g.fillStyle = '#51565f';
      g.fillRect(0, mid - half, size, 2 * half);
      g.fillStyle = '#ffffff';
      for (const y of [mid - half, mid + half - m(0.45)]) { g.fillRect(0, y, mid - half, m(0.45)); g.fillRect(mid + half, y, mid - half, m(0.45)); }
      // a zebra crossing each side of the crossroads
      for (const x of [mid - half - m(4.5), mid + half + m(1.5)]) for (let k = 0; k < 8; k++) g.fillRect(x, mid - half + m(0.75 + k), m(3), m(0.5));
      // 4 m on, 4 m off, so the dashes run on into the next block
      g.fillStyle = '#fff3b0';
      for (let k = 0; k < BLOCK / 8; k++) if (Math.abs(k * 8 + 4 - BLOCK / 2) > 8) g.fillRect(m(k * 8 + 2), mid - m(0.15), m(4), m(0.3));
    };
    street();
    g.translate(mid, mid);
    g.rotate(Math.PI / 2);
    g.translate(-mid, -mid);
    street();
  }, BLOCKS);
}

/** Runs the Practice Ground until the returned function stops it. */
export function startPractice(body: BodyKind, controls: Controls, sound: Sound): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.body.prepend(renderer.domElement);
  const effect = new OutlineEffect(renderer, { defaultThickness: 0.0042, defaultColor: [0.07, 0.05, 0.05] });
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a7a5a, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(40, 80, 25);
  scene.add(sun);
  // the Garden's sky
  scene.background = canvasTexture(2, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#4fb3ff'); grad.addColorStop(1, '#c9ecff');
    g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
  });
  scene.fog = new THREE.Fog(0xc9ecff, 140, 320);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 600);
  const smoke = new Particles(0xf4f4f4, 300, 1.5, 2.2);
  scene.add(smoke.points);

  const tex = streets();
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const ground = mesh(new THREE.PlaneGeometry(BLOCK * BLOCKS, BLOCK * BLOCKS), toon(0xffffff, { outline: false, map: tex }));
  ground.rotation.x = -Math.PI / 2;
  const model = makeCar(body, 0x2f9bff);
  scene.add(ground, model);

  // on a street, heading for the crossroads
  const rb = new RigidBody({ x: HALF.x, y: HALF.y, z: BODIES[body].length }, BODIES[body].mass, true, { x: BLOCK / 2, y: HALF.y, z: 4, yaw: 0 });
  const car: Car = { rb, kind: body, drifting: false, spin: 0, slide: 0 };
  const shots: { mesh: THREE.Group; vx: number; vz: number; until: number }[] = [];
  let clock = 0, nextShot = 0;
  controls.takeItemPress();
  controls.showBack(false);

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    smoke.setScale(renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan((camera.fov * Math.PI) / 360)));
  };
  resize();
  addEventListener('resize', resize);

  /** One step, as in a Race but with the ground flat everywhere and nothing to meet: no gravity, no walls, no contacts. */
  function tick() {
    handleCar(car, controls.drive());
    rb.x += rb.vx * DT;
    rb.z += rb.vz * DT;
    rb.yaw = Math.atan2(Math.sin(rb.yaw + rb.yawRate * DT), Math.cos(rb.yaw + rb.yawRate * DT));
    clock += DT;
    // the action button fires Zap Shots, as many as you like
    const press = controls.takeItemPress();
    if ((press || controls.firing()) && clock >= nextShot) {
      nextShot = clock + SHOT_EVERY;
      const fx = Math.sin(rb.yaw), fz = Math.cos(rb.yaw), vx = fx * SHOT_SPEED + rb.vx, vz = fz * SHOT_SPEED + rb.vz, shot = makeBolt('shot');
      shot.position.set(rb.x + fx * 2.4, HALF.y + 0.45, rb.z + fz * 2.4);
      shot.rotation.y = Math.atan2(vx, vz);
      scene.add(shot);
      shots.push({ mesh: shot, vx, vz, until: clock + SHOT_LIFE });
      sound.shot();
    }
  }

  let raf = 0, acc = 0, last = performance.now();
  const before = { x: rb.x, z: rb.z, yaw: rb.yaw }, lastTarget = new THREE.Vector3(1e9, 0, 0);
  function frame(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (acc += dt; acc >= DT; acc -= DT) {
      Object.assign(before, { x: rb.x, z: rb.z, yaw: rb.yaw });
      tick();
    }
    // drawn between its last two steps, so it moves evenly at any frame rate
    const k = acc / DT;
    model.position.set(before.x + (rb.x - before.x) * k, HALF.y, before.z + (rb.z - before.z) * k);
    model.rotation.y = before.yaw + angleDiff(before.yaw, rb.yaw) * k;
    // the ground moves along a block at a time, so the streets stay where they are
    ground.position.set(Math.round(rb.x / BLOCK) * BLOCK, 0, Math.round(rb.z / BLOCK) * BLOCK);

    const fx = Math.sin(rb.yaw), fz = Math.cos(rb.yaw), r = right(fx, fz);
    const forward = rb.vx * fx + rb.vz * fz, sideways = rb.vx * r.x + rb.vz * r.z;
    for (const w of model.userData.wheels as THREE.Object3D[]) w.rotateY((-forward * dt) / 0.44);
    const p = model.position;
    if (Math.abs(sideways) > 3.5) smoke.emit(p.x - fx * 1.6 + (Math.random() - 0.5), 0.1, p.z - fz * 1.6 + (Math.random() - 0.5), 0, 0.5, 0, 0.7, 0.8);
    sound.drive(Math.hypot(rb.vx, rb.vz), controls.drive().throttle, (Math.abs(sideways) - 3) / 4);
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.z += s.vz * dt;
      if (s.until > clock) continue;
      scene.remove(s.mesh);
      dispose(s.mesh);
      shots.splice(i, 1);
    }
    smoke.update(dt);
    chase(camera, model, lastTarget, dt);
    effect.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    sound.silenceLoops();
    dispose(scene);
    (scene.background as THREE.Texture).dispose();
    renderer.dispose();
    // its WebGL context goes at once: opened again and again, the browser would otherwise drop the oldest, the turntable's
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
