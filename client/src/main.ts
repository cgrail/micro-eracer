/// <reference types="vite/client" />
import '@fontsource/bangers';
import { Client } from '@colyseus/sdk';
import { type BodyKind, BODY_KINDS } from '../../shared/src/car.ts';
import { TRACKS } from '../../shared/src/track.ts';
import { Sound } from './audio.ts';
import { startGame } from './game.ts';
import { createGarage } from './garage.ts';
import { ITEM_ICONS } from './hud.ts';
import { createInput, isTouch, PAD_SIDES, type PadSide, type Steering, STEERINGS } from './input.ts';
import { offlineRace } from './offline.ts';
import { startPractice } from './practice.ts';
import { themeOf } from './props.ts';
import type { RaceLink } from './state.ts';
import { createCourse, trackFacts } from './trackmap.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>('start'), nameInput = $<HTMLInputElement>('name'), play = $<HTMLButtonElement>('play');
const error = $('error'), hudEl = $('hud'), touch = $('touch'), mute = $<HTMLButtonElement>('mute'), offline = $('offline');
const hud = {
  pos: $('pos'), lap: $('lap'), msg: $('msg'), results: $<HTMLOListElement>('results'),
  energy: $('energy'), energyFill: $('energy-fill'), popups: $('popups'), item: $('item'), danger: $('danger'), action: $('fire'), news: $('news'), map: $<HTMLCanvasElement>('map'),
};

// remembered per browser so the next visit is one tap; storage can be unavailable (private mode)
const load = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* not remembered */ } };

let body: BodyKind = BODY_KINDS.find((b) => b === load('body')) ?? 'roadster';
// a new Player gets a name to race under right away (the same lists as AppModel.swift's `randomName`)
const FIRST_NAMES = ['Joe', 'Max', 'Kim', 'Lou', 'Ada', 'Sam', 'Zoe', 'Ben', 'Mia', 'Rex', 'Ivy', 'Gus', 'Lena', 'Otto', 'Rita', 'Finn'];
const LAST_NAMES = ['Ram', 'Volt', 'Watt', 'Amp', 'Spark', 'Drift', 'Zap', 'Skid', 'Turbo', 'Fuse', 'Bolt', 'Ohm', 'Plug', 'Dash', 'Coil', 'Charge'];
const pick = <T>(all: readonly T[]) => all[Math.floor(Math.random() * all.length)];
nameInput.value = load('name') || `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
const BODY_NAMES: Record<BodyKind, string> = { roadster: 'Roadster', suv: 'SUV', microbus: 'Microbus', pickup: 'Pickup', semi: 'Semi' };
const garage = createGarage($('turntable'), $('stats'));
const showBody = () => { $('body-name').textContent = BODY_NAMES[body]; garage.show(body); };
// ◀ and ▶ step through the Bodies, wrapping round
const stepBody = (by: number) => { body = BODY_KINDS[(BODY_KINDS.indexOf(body) + by + BODY_KINDS.length) % BODY_KINDS.length]; showBody(); };
$('prev-body').addEventListener('click', () => stepBody(-1));
$('next-body').addEventListener('click', () => stepBody(1));
showBody();
garage.run(true);

// the Track: any (''), which joins whatever Race is running, or one picked, raced again and again; each visit starts on one
// at random
const trackSelect = $<HTMLSelectElement>('track'), course = createCourse($<HTMLCanvasElement>('track-map')), facts = $('facts');
const TRACK_IDS = ['', ...TRACKS.map((t) => t.id)];
let track = pick(TRACKS).id;
trackSelect.append(new Option('Any Track', ''));
for (const theme of new Set(TRACKS.map((t) => t.theme))) {
  const places = document.createElement('optgroup');
  places.label = themeOf(theme).title;
  places.append(...TRACKS.filter((t) => t.theme === theme).map((t) => new Option(t.name, t.id)));
  trackSelect.append(places);
}
const line = (text: string, className = '') => Object.assign(document.createElement('p'), { textContent: text, className });
const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);
const showTrack = () => {
  trackSelect.value = track;
  const def = TRACKS.find((t) => t.id === track);
  course.show(def);
  $('course').classList.toggle('any', !def);
  if (!def) { facts.replaceChildren(line('A new Track every Race', 'place'), line(`${TRACKS.length} to race on`)); return; }
  const f = trackFacts(def), extras = [f.bridges && 'a bridge', f.climbs && count(f.climbs, 'a climb', 'climbs'), f.jumps && count(f.jumps, 'a jump', 'jumps')].filter(Boolean);
  facts.replaceChildren(line(`${themeOf(def.theme).title} · ${f.length} m, ${f.turns} turns`, 'place'), line(extras.join(', ') || 'all on one level'));
};
const stepTrack = (by: number) => { track = TRACK_IDS[(TRACK_IDS.indexOf(track) + by + TRACK_IDS.length) % TRACK_IDS.length]; showTrack(); };
// held, ◀ and ▶ keep stepping, faster and faster, through all the Tracks; a tap on the name lists them all
for (const [id, by] of [['prev-track', -1], ['next-track', 1]] as const) {
  const button = $(id);
  let timer = 0;
  button.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    stepTrack(by);
    let delay = 450;
    const again = () => { stepTrack(by); delay = Math.max(60, delay * 0.8); timer = window.setTimeout(again, delay); };
    timer = window.setTimeout(again, delay);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) button.addEventListener(type, () => clearTimeout(timer));
  // Enter or Space on the focused button clicks without a pointer
  button.addEventListener('click', (e) => { if (e.detail === 0) stepTrack(by); });
}
trackSelect.addEventListener('change', () => { track = trackSelect.value; showTrack(); trackSelect.blur(); });
showTrack();
course.run(true);

const controls = createInput({ touch, steer: $('steer'), action: $('fire'), back: $('back') });
// touch only, set on the Practice Ground behind the Controls button, which says how they are set
const STEER_HINTS: Record<Steering, string> = {
  buttons: "Hold a thumb anywhere left or right of the wheel's middle, and rock it across to turn the other way.",
  slider: 'Put a thumb down anywhere and drag it left or right: the further, the sharper.',
};
const showControls = () => {
  $('controls-now').textContent = `${steering === 'buttons' ? 'Buttons' : 'Slider'}, pad ${side}`;
  $('practice-hint').textContent = `${STEER_HINTS[steering]} The E-Car drives by itself, and the yellow button shoots.`;
};
// steer by dragging, or by holding left or right of the pad's middle
let steering: Steering = STEERINGS.find((s) => s === load('steer')) ?? 'buttons';
const steerButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-steer]')];
const showSteering = () => { steerButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.steer === steering))); controls.setSteering(steering); showControls(); };
steerButtons.forEach((b) => b.addEventListener('click', () => { steering = b.dataset.steer as Steering; save('steer', steering); showSteering(); }));
// the pad, with the action button above it, in the bottom-left or the bottom-right corner
let side: PadSide = PAD_SIDES.find((s) => s === load('side')) ?? 'left';
const sideButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-side]')];
const showSide = () => { sideButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.side === side))); touch.classList.toggle('right', side === 'right'); showControls(); };
sideButtons.forEach((b) => b.addEventListener('click', () => { side = b.dataset.side as PadSide; save('side', side); showSide(); }));
$('controls').hidden = !isTouch;
showSteering();
showSide();

// the whole form on one screen, never scrolled: scaled down where even its compact layout is too big for the window, and
// clear of the notch and the home bar
const safeArea = document.body.appendChild(document.createElement('div'));
safeArea.style.cssText = 'position: fixed; visibility: hidden; padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom)';
const fit = () => {
  // not while typing: a phone's keyboard shrinks the window
  if (form.hidden || document.activeElement === nameInput) return;
  const insets = getComputedStyle(safeArea), safe = parseFloat(insets.paddingTop) + parseFloat(insets.paddingBottom) || 0;
  form.style.setProperty('--fit', '1');
  const scale = Math.min(1, (innerHeight - safe - 20) / form.offsetHeight, (innerWidth - 20) / form.offsetWidth);
  form.style.setProperty('--fit', String(Math.floor(scale * 1000) / 1000));
};
addEventListener('resize', fit);
nameInput.addEventListener('blur', fit);
fit();
document.fonts.ready.then(fit);
const sound = new Sound();
const showMute = () => { mute.textContent = sound.muted ? '🔇' : '🔊'; mute.setAttribute('aria-pressed', String(sound.muted)); };
sound.setMuted(load('muted') === '1');
showMute();
mute.addEventListener('click', () => { sound.setMuted(!sound.muted); save('muted', sound.muted ? '1' : '0'); showMute(); mute.blur(); });
// the Practice Ground: the picked Body under the touch controls, with the settings over it
const practice = $('practice');
let stopPractice: (() => void) | undefined;
$('controls').addEventListener('click', () => {
  sound.unlock();
  form.hidden = true;
  garage.run(false);
  course.run(false);
  practice.hidden = touch.hidden = false;
  hud.action.textContent = ITEM_ICONS.zap;
  stopPractice = startPractice(body, controls, sound);
});
$('practice-done').addEventListener('click', () => {
  stopPractice?.();
  stopPractice = undefined;
  practice.hidden = touch.hidden = true;
  hud.action.textContent = '';
  form.hidden = false;
  fit();
  garage.run(true);
  course.run(true);
});
const serverUrl = import.meta.env.DEV ? `${location.protocol}//${location.hostname}:2567` : location.origin;
// waiting longer than this for the server, Play starts an Offline Race instead
const JOIN_TIMEOUT = 5000;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  save('name', name);
  save('body', body);
  error.textContent = '';
  play.disabled = true;
  sound.unlock();
  try {
    // name tags and the banner are drawn on canvases, which need the comic font loaded first
    await document.fonts.load('40px Bangers').catch(() => undefined);
    // `race2`: a picked Track joins a Race on it, any Track the fullest Race (`race` is left to apps from before the picker)
    const join = new Client(serverUrl).joinOrCreate('race2', track ? { name, body, track } : { name, body });
    let room: RaceLink;
    try {
      room = await Promise.race([join, new Promise<never>((_, fail) => setTimeout(() => fail(new Error('timeout')), JOIN_TIMEOUT))]);
    } catch {
      // no server to be reached: race the Bots right here
      join.then((late) => late.leave(), () => {});
      room = offlineRace(name, body, track || undefined);
      offline.hidden = false;
    }
    form.hidden = true;
    garage.run(false);
    course.run(false);
    hudEl.hidden = mute.hidden = false;
    touch.hidden = !isTouch;
    // so Space uses the Item instead of pressing the (now hidden) Play button again
    (document.activeElement as HTMLElement | null)?.blur();
    const stop = startGame(room, controls, hud, sound);
    room.onLeave(() => {
      stop();
      form.hidden = false;
      fit();
      showTrack();
      garage.run(true);
      course.run(true);
      hudEl.hidden = touch.hidden = mute.hidden = true;
      error.textContent = 'Connection lost.';
    });
  } catch {
    error.textContent = "The game couldn't start. Try reloading the page.";
  } finally {
    play.disabled = false;
  }
});
