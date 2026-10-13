import * as THREE from 'three';
import { HALF_WIDTH, RISE, type Track, type TrackDef, buildTrack } from '../../shared/src/track.ts';
import { type TrackScene, buildTrackScene } from './scene.ts';
import { dispose } from './toon.ts';

// The start form's Track picker: the Track in 3D on its theme's ground, and what it has in store.

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

// how steeply the camera looks down on the Track; and how long a pick rests before its Track is built (◀ ▶ held step
// every 60 ms, far quicker than a Track builds)
const TILT = 0.95, SETTLE = 150;

/**
 * The start form's Track on its turntable: the picked Track with all its scenery, seen from above and turning slowly, with
 * a whirl as each one comes up. For none (any Track) it draws nothing, and the form shows a question mark instead. It only
 * renders while `run(true)`.
 */
export function createCourse(canvas: HTMLCanvasElement) {
  // no OutlineEffect: from this far away the outlines would be thinner than a pixel, as they are in the apps
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a7a5a, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(40, 80, 25);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 2000), centre = new THREE.Vector3();
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let wanted: TrackDef | undefined, shown: TrackDef | undefined, look: TrackScene | undefined;
  let pickedAt = 0, reach = 1, angle = 0, speed = 0, raf = 0, last = 0, w = 0, h = 0;

  const drop = () => {
    if (look) { scene.remove(look.group); dispose(look.group); look.background.dispose(); }
    look = shown = undefined;
  };
  const build = (def: TrackDef) => {
    drop();
    const track = trackOf(def), xs = track.samples.map((s) => s.x), zs = track.samples.map((s) => s.z), s0 = track.samples[0];
    look = buildTrackScene(track);
    shown = def;
    scene.add(look.group);
    scene.background = look.background;
    centre.set((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2);
    reach = Math.max(...track.samples.map((s) => Math.hypot(s.x - centre.x, s.z - centre.z))) + HALF_WIDTH + 2;
    // first from behind the start line, as the chase camera sees it
    angle = Math.atan2(-s0.dx, -s0.dz);
    if (!still) speed = 2;
  };

  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    if (wanted !== shown && t - pickedAt > SETTLE) { if (wanted) build(wanted); else drop(); }
    if (!look) return;
    speed += ((still ? 0 : 0.15) - speed) * Math.min(1, 3 * dt);
    angle += speed * dt;
    look.update(t / 1000);
    if (canvas.clientWidth !== w || canvas.clientHeight !== h) {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
    }
    // back far enough for the whole Track: across, and up and down, where the slant squashes it
    const half = Math.tan((camera.fov * Math.PI) / 360), dist = 1.1 * Math.max(reach / (half * camera.aspect), (reach * Math.sin(TILT)) / half);
    camera.near = dist / 4;
    camera.far = dist * 3;
    camera.updateProjectionMatrix();
    camera.position.set(centre.x + Math.sin(angle) * Math.cos(TILT) * dist, Math.sin(TILT) * dist, centre.z + Math.cos(angle) * Math.cos(TILT) * dist);
    camera.lookAt(centre);
    renderer.render(scene, camera);
  };

  return {
    show(def: TrackDef | undefined) {
      wanted = def;
      pickedAt = performance.now();
    },
    run(on: boolean) {
      cancelAnimationFrame(raf);
      // the Race builds its own Track: this one is freed meanwhile, and built again on the way back
      if (on) raf = requestAnimationFrame((t) => { last = t; frame(t); });
      else drop();
    },
  };
}
