import type { Input } from '../../shared/src/car.ts';

export const isTouch = matchMedia('(pointer: coarse)').matches;

// iOS Safari ignores user-scalable=no and doesn't always honour touch-action, so pinches and double taps are cancelled here too.
// The controls run on pointer events, which this doesn't stop: two thumbs and a hammered action button still work
const inField = (e: Event) => e.target instanceof HTMLInputElement;
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
// a quick second tap zooms wherever it lands, not only on the element of the first (the pad then its wheel, a button's label
// then its edge), so any is cancelled; a button or link tapped (not swiped over) still gets its click, so ▶ can be hammered through the Bodies
const touchFrom = new Map<number, { x: number; y: number }>();
let lastTouchEnd = -1e9;
document.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) touchFrom.set(t.identifier, { x: t.clientX, y: t.clientY }); }, { passive: true });
document.addEventListener('touchend', (e) => {
  const quick = e.timeStamp - lastTouchEnd < 400;
  lastTouchEnd = e.timeStamp;
  const t = e.changedTouches[0], from = t && touchFrom.get(t.identifier);
  for (const c of e.changedTouches) touchFrom.delete(c.identifier);
  if (!quick || inField(e)) return;
  e.preventDefault();
  if (from && Math.hypot(t.clientX - from.x, t.clientY - from.y) < 10) (e.target as Element).closest<HTMLElement>('button, a')?.click();
}, { passive: false });
document.addEventListener('touchcancel', (e) => { for (const t of e.changedTouches) touchFrom.delete(t.identifier); });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
// no text selection and no long-press menu outside the name field, even where a browser lets user-select: none slip
for (const type of ['selectstart', 'contextmenu']) document.addEventListener(type, (e) => { if (!inField(e)) e.preventDefault(); });
// on a desktop, a trackpad pinch or Ctrl + wheel arrives as a wheel event with ctrlKey (Safari's pinch is the gesture above),
// and Ctrl or Cmd with + or − zooms from the keyboard (by key, not code: they sit elsewhere on a German keyboard); 0 still resets
addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '_'].includes(e.key)) e.preventDefault(); });

const STEER_DEAD = 6, STEER_FULL = 100;
/** Drag distance (px) to steering: a small dead zone, then gentle near the middle for small corrections, full lock at STEER_FULL. */
function steerCurve(dx: number) {
  const k = Math.min(1, Math.max(0, Math.abs(dx) - STEER_DEAD) / (STEER_FULL - STEER_DEAD));
  return Math.sign(dx) * k ** 1.4;
}

/** How the thumb steers on touch: by dragging, or by holding left or right of the pad's middle. */
export type Steering = 'slider' | 'buttons';
export const STEERINGS: readonly Steering[] = ['slider', 'buttons'];
/** Which bottom corner the steering pad, with the action button above it, sits in on touch. */
export type PadSide = 'left' | 'right';
export const PAD_SIDES: readonly PadSide[] = ['left', 'right'];

export interface Controls {
  drive(): Input;
  /** True while Space or the action button is held, for a Zap's rapid fire. */
  firing(): boolean;
  /** True once per press of the Item key or the action button. */
  takeItemPress(): boolean;
  /** On touch, shows the reverse button while the E-Car is stuck (there is no brake otherwise). */
  showBack(on: boolean): void;
  setSteering(mode: Steering): void;
}

/**
 * Desktop: arrows/WASD drive, Space, E or Shift uses the Item (held, a Zap keeps firing). Mobile: the E-Car accelerates by
 * itself, a thumb anywhere on the screen steers (`Steering`), and one action button above the pad uses the Item.
 */
export function createInput(pad: { touch: HTMLElement; steer: HTMLElement; action: HTMLElement; back: HTMLElement }): Controls {
  const keys = new Set<string>();
  let itemPressed = false;
  addEventListener('keydown', (e) => {
    if (['Space', 'KeyE', 'ShiftLeft', 'ShiftRight'].includes(e.code) && !e.repeat) itemPressed = true;
    if (e.code === 'Space' && e.target === document.body) e.preventDefault();
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  let steering: Steering = 'buttons', steerer: number | null = null, steerStart = 0, padMiddle = 0, touchSteer = 0, firing = false, reversing = false;
  // Buttons: the thumb can rock from one side to the other without lifting; the held half of the pad lights up
  const steerTo = (x: number) => {
    touchSteer = steering === 'slider' ? steerCurve(x - steerStart) : x < padMiddle ? -1 : 1;
    const held = steering === 'slider' ? '' : touchSteer < 0 ? 'left' : 'right';
    if (pad.steer.dataset.held !== held) pad.steer.dataset.held = held;
    pad.steer.style.setProperty('--turn', `${touchSteer * 90}deg`);
  };
  // the whole screen steers but for the buttons on it, one finger at a time; the pad's middle splits left from right
  pad.touch.addEventListener('pointerdown', (e) => {
    if (steerer !== null || (e.target as Element).closest('button')) return;
    const r = pad.steer.getBoundingClientRect();
    steerer = e.pointerId;
    steerStart = e.clientX;
    padMiddle = r.left + r.width / 2;
    pad.touch.setPointerCapture(e.pointerId);
    steerTo(e.clientX);
  });
  pad.touch.addEventListener('pointermove', (e) => { if (e.pointerId === steerer) steerTo(e.clientX); });
  const release = (e: PointerEvent) => {
    if (e.pointerId !== steerer) return;
    steerer = null;
    touchSteer = 0;
    pad.steer.dataset.held = '';
    pad.steer.style.setProperty('--turn', '0deg');
  };
  for (const type of ['pointerup', 'pointercancel'] as const) pad.touch.addEventListener(type, release);
  // the capture keeps the finger's events coming here, and if it is lost all the same (the Race ended under it), so is the
  // finger; not when the element it landed on loses its own capture to this one, which bubbles up here too
  pad.touch.addEventListener('lostpointercapture', (e) => { if (e.target === pad.touch) release(e); });
  pad.action.addEventListener('pointerdown', () => { firing = true; itemPressed = true; });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) pad.action.addEventListener(type, () => (firing = false));
  pad.back.addEventListener('pointerdown', () => (reversing = true));
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) pad.back.addEventListener(type, () => (reversing = false));

  const key = (...codes: string[]) => (codes.some((c) => keys.has(c)) ? 1 : 0);
  return {
    drive: () => isTouch
      ? { throttle: reversing ? -1 : 1, steer: touchSteer }
      : { throttle: key('ArrowUp', 'KeyW') - key('ArrowDown', 'KeyS'), steer: key('ArrowRight', 'KeyD') - key('ArrowLeft', 'KeyA') },
    firing: () => firing || keys.has('Space'),
    takeItemPress: () => { const p = itemPressed; itemPressed = false; return p; },
    showBack: (on) => { if (pad.back.hidden === on) pad.back.hidden = !on; if (!on) reversing = false; },
    setSteering: (mode) => {
      steering = mode;
      pad.steer.classList.toggle('buttons', mode === 'buttons');
      pad.steer.setAttribute('aria-label', mode === 'buttons' ? 'Steer: hold left or right' : 'Steer: drag left or right');
    },
  };
}
