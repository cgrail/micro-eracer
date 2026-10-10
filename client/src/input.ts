import type { Input } from '../../shared/src/car.ts';

export const isTouch = matchMedia('(pointer: coarse)').matches;

export interface Controls {
  drive(): Input;
  /** True while the fire key or button is held. */
  firing(): boolean;
  /** True once per press of the Item key or button. */
  takeItemPress(): boolean;
}

/** Desktop: arrows/WASD, Space shoots, E or Shift uses the Item. Mobile: auto-throttle, left thumb steers, right thumb brakes/shoots/uses. */
export function createInput(pad: { steer: HTMLElement; brake: HTMLElement; fire: HTMLElement; item: HTMLElement }): Controls {
  const keys = new Set<string>();
  let itemPressed = false;
  addEventListener('keydown', (e) => {
    if (['KeyE', 'ShiftLeft', 'ShiftRight'].includes(e.code) && !e.repeat) itemPressed = true;
    if (e.code === 'Space' && e.target === document.body) e.preventDefault();
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  let steerStart: number | null = null, touchSteer = 0, braking = false, firing = false;
  pad.steer.addEventListener('pointerdown', (e) => { steerStart = e.clientX; pad.steer.setPointerCapture(e.pointerId); });
  pad.steer.addEventListener('pointermove', (e) => { if (steerStart !== null) touchSteer = Math.max(-1, Math.min(1, (e.clientX - steerStart) / 60)); });
  for (const type of ['pointerup', 'pointercancel']) pad.steer.addEventListener(type, () => { steerStart = null; touchSteer = 0; });
  const hold = (el: HTMLElement, set: (on: boolean) => void) => {
    el.addEventListener('pointerdown', () => set(true));
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(type, () => set(false));
  };
  hold(pad.brake, (on) => (braking = on));
  hold(pad.fire, (on) => (firing = on));
  pad.item.addEventListener('pointerdown', () => (itemPressed = true));

  const key = (...codes: string[]) => (codes.some((c) => keys.has(c)) ? 1 : 0);
  return {
    drive: () => isTouch
      ? { throttle: braking ? -1 : 1, steer: touchSteer }
      : { throttle: key('ArrowUp', 'KeyW') - key('ArrowDown', 'KeyS'), steer: key('ArrowRight', 'KeyD') - key('ArrowLeft', 'KeyA') },
    firing: () => firing || keys.has('Space'),
    takeItemPress: () => { const p = itemPressed; itemPressed = false; return p; },
  };
}
