import type { Input } from '../../shared/src/car.ts';

export const isTouch = matchMedia('(pointer: coarse)').matches;

/** Desktop: arrows/WASD. Mobile: auto-throttle, left thumb drags to steer, right thumb brakes. */
export function createInput(steerPad: HTMLElement, brakeButton: HTMLElement): () => Input {
  const keys = new Set<string>();
  addEventListener('keydown', (e) => keys.add(e.code));
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  let steerStart: number | null = null, touchSteer = 0, braking = false;
  steerPad.addEventListener('pointerdown', (e) => { steerStart = e.clientX; steerPad.setPointerCapture(e.pointerId); });
  steerPad.addEventListener('pointermove', (e) => { if (steerStart !== null) touchSteer = Math.max(-1, Math.min(1, (e.clientX - steerStart) / 60)); });
  for (const type of ['pointerup', 'pointercancel']) steerPad.addEventListener(type, () => { steerStart = null; touchSteer = 0; });
  brakeButton.addEventListener('pointerdown', () => (braking = true));
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) brakeButton.addEventListener(type, () => (braking = false));

  const key = (...codes: string[]) => (codes.some((c) => keys.has(c)) ? 1 : 0);
  return () => {
    if (isTouch) return { throttle: braking ? -1 : 1, steer: touchSteer };
    return {
      throttle: key('ArrowUp', 'KeyW') - key('ArrowDown', 'KeyS'),
      steer: key('ArrowRight', 'KeyD') - key('ArrowLeft', 'KeyA'),
    };
  };
}
