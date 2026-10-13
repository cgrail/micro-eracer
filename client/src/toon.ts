import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// The comic look: cel shading in three flat tones, and textures drawn in code.

// three flat tones: the cel-shaded comic look
export const GRADIENT = new THREE.DataTexture(new Uint8Array([120, 195, 255]), 3, 1, THREE.RedFormat);
GRADIENT.minFilter = GRADIENT.magFilter = THREE.NearestFilter;
GRADIENT.needsUpdate = true;

export function toon(color: number, { outline = true, map, opacity }: { outline?: boolean; map?: THREE.Texture; opacity?: number } = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT, map: map ?? null, transparent: opacity !== undefined, opacity: opacity ?? 1 });
  if (!outline) m.userData.outlineParameters = { visible: false };
  if (opacity !== undefined) m.depthWrite = false;
  return m;
}

/** Frees the GPU memory of everything under `obj`: geometries, materials and their textures. */
export function dispose(obj: THREE.Object3D) {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Sprite || o instanceof THREE.Points) {
      o.geometry.dispose();
      for (const m of [o.material].flat()) { (m as THREE.MeshToonMaterial).map?.dispose(); m.dispose(); }
    }
  });
}

export const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};
export const rbox = (w: number, h: number, d: number, r: number, mat: THREE.Material, x = 0, y = 0, z = 0) => mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat, x, y, z);
export const cyl = (rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 16) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);
export const sph = (r: number, mat: THREE.Material, x = 0, y = 0, z = 0) => mesh(new THREE.SphereGeometry(r, 16, 12), mat, x, y, z);
export const group = (...children: THREE.Object3D[]) => new THREE.Group().add(...children);

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}

/** Small deterministic random, so every browser decorates a Track the same way. */
export function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
