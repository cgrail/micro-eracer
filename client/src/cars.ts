import * as THREE from 'three';
import { BODIES, type BodyKind } from '../../shared/src/car.ts';
import { cyl, group, mesh, rbox, sph, toon } from './toon.ts';

type Mat = THREE.Material;
/** Each Body's look: the bodywork, where its axles sit and how high its roof is (for the warning light). */
const LOOKS: Record<BodyKind, { axles: number[]; roof: number; build: (paint: Mat, glass: Mat, white: Mat, lamp: Mat) => THREE.Object3D[] }> = {
  // a low generic Roadster
  roadster: {
    axles: [1.2, -1.2], roof: 0.55,
    build: (paint, glass) => [
      rbox(1.9, 0.5, 3.9, 0.22, paint, 0, -0.12, 0), rbox(1.45, 0.42, 1.3, 0.2, glass, 0, 0.3, -0.35), rbox(1.6, 0.12, 0.5, 0.05, paint, 0, 0.42, -1.75),
      cyl(0.08, 0.08, 0.4, paint, 0.6, 0.25, -1.75), cyl(0.08, 0.08, 0.4, paint, -0.6, 0.25, -1.75),
    ],
  },
  // a rounded family SUV
  suv: {
    axles: [1.25, -1.25], roof: 1.05,
    build: (paint, glass, white) => [
      rbox(1.95, 0.72, 3.9, 0.3, paint, 0, 0, 0), rbox(1.82, 0.62, 2.5, 0.32, paint, 0, 0.6, -0.25), rbox(1.86, 0.36, 2.3, 0.12, glass, 0, 0.64, -0.25),
      rbox(1.5, 0.08, 1.6, 0.03, white, 0, 0.95, -0.3),
    ],
  },
  // a two-tone retro Microbus
  microbus: {
    axles: [1.2, -1.2], roof: 1.3,
    build: (paint, glass, white) => [
      rbox(1.9, 0.8, 3.7, 0.3, paint, 0, -0.02, 0), rbox(1.85, 0.95, 3.3, 0.35, white, 0, 0.78, -0.12), rbox(1.92, 0.42, 2.9, 0.15, glass, 0, 0.86, -0.15),
      rbox(1.2, 0.5, 0.2, 0.1, paint, 0, 0.32, 1.85),
    ],
  },
  // a big pickup with its open bed and a light bar right across the front
  pickup: {
    axles: [1.45, -1.35], roof: 1.05,
    build: (paint, glass, _white, lamp) => [
      rbox(2, 0.72, 4.3, 0.22, paint, 0, -0.02, 0), rbox(1.9, 0.68, 1.6, 0.22, paint, 0, 0.62, 0.35), rbox(1.94, 0.34, 1.4, 0.1, glass, 0, 0.7, 0.35),
      rbox(1.7, 0.1, 1.9, 0.05, toon(0x2b2f36), 0, 0.36, -1.1), rbox(1.8, 0.1, 0.08, 0.04, lamp, 0, 0.24, 2.16),
    ],
  },
  // a truck cab pulling a box trailer with a stripe in the Racer's colour
  semi: {
    axles: [1.7, -0.6, -1.7], roof: 1.45,
    build: (paint, glass, white) => [
      rbox(1.95, 1.25, 1.5, 0.3, paint, 0, 0.35, 1.6), rbox(1.98, 0.45, 0.6, 0.1, glass, 0, 0.62, 2.05),
      rbox(1.95, 1.55, 3.2, 0.15, white, 0, 0.55, -0.8), rbox(1.99, 0.3, 3, 0.05, paint, 0, 0.3, -0.8),
    ],
  },
};

/** A generic look-alike of the Body, facing +z, origin at the physics body's centre. */
export function makeCar(kind: BodyKind, color: number): THREE.Group {
  const paint = toon(color), glass = toon(0x1d2b45), white = toon(0xfafafa), tyre = toon(0x1a1a1a), rim = toon(0xc9ced6), lamp = toon(0xfff6b0, { outline: false });
  const look = LOOKS[kind], length = BODIES[kind].length;
  const g = new THREE.Group().add(...look.build(paint, glass, white, lamp));
  g.add(sph(0.2, lamp, 0.6, 0.08, length + 0.08), sph(0.2, lamp, -0.6, 0.08, length + 0.08));
  // red warning light on the roof, flashing while the battery runs low
  const lampOn = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  const z = kind === 'semi' ? 1.6 : 0;
  const beacon = group(cyl(0.18, 0.22, 0.12, toon(0x333333), 0, look.roof, z, 10), sph(0.2, lampOn, 0, look.roof + 0.15, z));
  const halo = mesh(new THREE.SphereGeometry(0.9, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.35, depthWrite: false }), 0, look.roof + 0.15, z);
  for (const m of [lampOn, halo.material]) m.userData.outlineParameters = { visible: false };
  beacon.add(halo);
  beacon.visible = false;
  g.add(beacon);
  const bubble = mesh(new THREE.SphereGeometry(2.4, 20, 14), toon(0x7fd6ff, { outline: false, opacity: 0.3 }), 0, 0.2, 0);
  bubble.scale.set(0.9, 0.75, 1.25 * (length / 1.8));
  bubble.visible = false;
  g.add(bubble);
  g.userData.beacon = beacon;
  g.userData.halo = halo;
  g.userData.shield = bubble;
  const wheels: THREE.Object3D[] = [];
  for (const az of look.axles) for (const x of [0.88, -0.88]) {
    const w = group(cyl(0.44, 0.44, 0.34, tyre, 0, 0, 0, 14), cyl(0.22, 0.22, 0.36, rim, 0, 0, 0, 8));
    w.rotation.z = Math.PI / 2;
    w.position.set(x, -0.3, az);
    wheels.push(w);
    g.add(w);
  }
  const shadow = mesh(new THREE.CircleGeometry(2.2, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }), 0, -0.43, 0);
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(0.55, length / 1.8, 1);
  shadow.material.userData.outlineParameters = { visible: false };
  g.add(shadow);
  g.userData.wheels = wheels;
  return g;
}
