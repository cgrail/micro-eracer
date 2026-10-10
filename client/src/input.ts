import type { Input } from '../../shared/src/car.ts';

export const isTouch = matchMedia('(pointer: coarse)').matches;

const STEER_DEAD = 6, STEER_FULL = 100;
/** Drag distance (px) to steering: a small dead zone, then gentle near the middle for small corrections, full lock at STEER_FULL. */
function steerCurve(dx: number) {
  const k = Math.min(1, Math.max(0, Math.abs(dx) - STEER_DEAD) / (STEER_FULL - STEER_DEAD));
  return Math.sign(dx) * k ** 1.4;
}

export interface Controls {
  drive(): Input;
  /** True while the fire key or the action button is held. */
  firing(): boolean;
  /** True once per press of the Item key or the action button. */
  takeItemPress(): boolean;
}

/**
 * Desktop: arrows/WASD, Space shoots, E or Shift uses the Item. Mobile: the E-Car accelerates by itself, the left thumb steers,
 * and the right thumb has one action button that shoots, or uses the Item when there is one (the game decides which).
 */
export function createInput(pad: { steer: HTMLElement; action: HTMLElement }): Controls {
  const keys = new Set<string>();
  let itemPressed = false;
  addEventListener('keydown', (e) => {
    if (['KeyE', 'ShiftLeft', 'ShiftRight'].includes(e.code) && !e.repeat) itemPressed = true;
    if (e.code === 'Space' && e.target === document.body) e.preventDefault();
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  let steerStart: number | null = null, touchSteer = 0, firing = false;
  pad.steer.addEventListener('pointerdown', (e) => { steerStart = e.clientX; pad.steer.setPointerCapture(e.pointerId); });
  pad.steer.addEventListener('pointermove', (e) => { if (steerStart !== null) touchSteer = steerCurve(e.clientX - steerStart); });
  for (const type of ['pointerup', 'pointercancel']) pad.steer.addEventListener(type, () => { steerStart = null; touchSteer = 0; });
  pad.action.addEventListener('pointerdown', () => { firing = true; itemPressed = true; });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) pad.action.addEventListener(type, () => (firing = false));

  const key = (...codes: string[]) => (codes.some((c) => keys.has(c)) ? 1 : 0);
  return {
    drive: () => isTouch
      ? { throttle: 1, steer: touchSteer }
      : { throttle: key('ArrowUp', 'KeyW') - key('ArrowDown', 'KeyS'), steer: key('ArrowRight', 'KeyD') - key('ArrowLeft', 'KeyA') },
    firing: () => firing || keys.has('Space'),
    takeItemPress: () => { const p = itemPressed; itemPressed = false; return p; },
  };
}
