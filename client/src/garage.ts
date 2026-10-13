import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { BODIES, BODY_KINDS, type BodyKind } from '../../shared/src/car.ts';
import { makeCar } from './cars.ts';

type Body = (typeof BODIES)[BodyKind];
/** The stats the start form shows per Body. Ruggedness is the weight: it wins Rams and softens Hits. */
const STATS: [string, (b: Body) => number][] = [
  ['Top speed', (b) => b.maxSpeed], ['Acceleration', (b) => b.accel], ['Grip', (b) => b.grip], ['Ruggedness', (b) => b.mass], ['Battery', (b) => b.tank],
];
// each bar runs from a fifth for the weakest Body to full for the strongest, so the small differences show
const bar = (stat: (b: Body) => number, kind: BodyKind) => {
  const all = BODY_KINDS.map((k) => stat(BODIES[k])), lo = Math.min(...all), hi = Math.max(...all);
  return Math.round(20 + (80 * (stat(BODIES[kind]) - lo)) / (hi - lo));
};

/** The start form's turntable: the picked Body turning slowly, with its stats as bars. It only renders while `run(true)`. */
export function createGarage(canvas: HTMLCanvasElement, stats: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const effect = new OutlineEffect(renderer, { defaultThickness: 0.008, defaultColor: [0.07, 0.05, 0.05] });
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a7a5a, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(4, 8, 3);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 40);
  // close enough that the Body fills its picture, with room for the Semi side on
  camera.position.set(0, 2.7, 6.9);
  camera.lookAt(0, 0, 0);
  const cars = new Map(BODY_KINDS.map((k) => [k, makeCar(k, 0x2f9bff)]));
  const turntable = new THREE.Group().add(...cars.values());
  turntable.rotation.y = 0.6;
  scene.add(turntable);

  stats.innerHTML = STATS.map(([label]) => `<dt>${label}</dt><dd role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100"><i></i></dd>`).join('');
  const meters = [...stats.querySelectorAll('dd')];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let speed = 0, raf = 0, last = 0, w = 0, h = 0;

  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    // a quick whirl on each pick, settling into a slow turn
    speed += ((still ? 0 : 0.8) - speed) * Math.min(1, 3 * dt);
    turntable.rotation.y += speed * dt;
    if (canvas.clientWidth !== w || canvas.clientHeight !== h) {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    effect.render(scene, camera);
  };

  return {
    show(kind: BodyKind) {
      for (const [k, car] of cars) car.visible = k === kind;
      if (!still) speed = 9;
      STATS.forEach(([, stat], i) => {
        const v = bar(stat, kind);
        meters[i].setAttribute('aria-valuenow', String(v));
        meters[i].firstElementChild!.setAttribute('style', `width: ${v}%`);
      });
    },
    run(on: boolean) {
      cancelAnimationFrame(raf);
      if (on) raf = requestAnimationFrame((t) => { last = t; frame(t); });
    },
  };
}
