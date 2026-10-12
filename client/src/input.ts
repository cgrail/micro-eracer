import type { Input } from '../../shared/src/car.ts';

export const isTouch = matchMedia('(pointer: coarse)').matches;

// iOS Safari ignores user-scalable=no and doesn't always honour touch-action, so pinches and double taps are cancelled here too.
// The controls run on pointer events, which this doesn't stop: two thumbs and a hammered action button still work
const inField = (e: Event) => e.target instanceof HTMLInputElement;
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
// a quick second tap zooms wherever it lands, not only on the element of the first (the pad's ◀ then its wheel, a button's label
// then its edge), so any is cancelled; a button tapped (not swiped over) still gets its click, so ▶ can be hammered through the Bodies
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
  if (from && Math.hypot(t.clientX - from.x, t.clientY - from.y) < 10) (e.target as Element).closest('button')?.click();
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

/** How the left thumb steers on touch: by dragging on the pad, or by holding its ◀ or ▶ half. */
export type Steering = 'slider' | 'buttons';
export const STEERINGS: readonly Steering[] = ['slider', 'buttons'];

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
 * itself, the left thumb steers (`Steering`), and the right thumb has one action button that uses the Item.
 */
export function createInput(pad: { steer: HTMLElement; action: HTMLElement; back: HTMLElement }): Controls {
  const keys = new Set<string>();
  let itemPressed = false;
  addEventListener('keydown', (e) => {
    if (['Space', 'KeyE', 'ShiftLeft', 'ShiftRight'].includes(e.code) && !e.repeat) itemPressed = true;
    if (e.code === 'Space' && e.target === document.body) e.preventDefault();
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  let steering: Steering = 'slider', steerStart: number | null = null, padMiddle = 0, touchSteer = 0, firing = false, reversing = false;
  // Buttons: the thumb can rock from one half to the other without lifting; the held half lights up
  const steerTo = (x: number) => {
    touchSteer = steering === 'slider' ? steerCurve(x - steerStart!) : x < padMiddle ? -1 : 1;
    const held = steering === 'slider' ? '' : touchSteer < 0 ? 'left' : 'right';
    if (pad.steer.dataset.held !== held) pad.steer.dataset.held = held;
    pad.steer.style.setProperty('--turn', `${touchSteer * 90}deg`);
  };
  pad.steer.addEventListener('pointerdown', (e) => {
    const r = pad.steer.getBoundingClientRect();
    steerStart = e.clientX;
    padMiddle = r.left + r.width / 2;
    pad.steer.setPointerCapture(e.pointerId);
    steerTo(e.clientX);
  });
  pad.steer.addEventListener('pointermove', (e) => { if (steerStart !== null) steerTo(e.clientX); });
  for (const type of ['pointerup', 'pointercancel']) pad.steer.addEventListener(type, () => { steerStart = null; touchSteer = 0; pad.steer.dataset.held = ''; pad.steer.style.setProperty('--turn', '0deg'); });
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
