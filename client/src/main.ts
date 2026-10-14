/// <reference types="vite/client" />
import '@fontsource/bangers';
import { Client } from '@colyseus/sdk';
import { type BodyKind, BODY_KINDS } from '../../shared/src/car.ts';
import { TRACKS, type TrackDef } from '../../shared/src/track.ts';
import { APP_STORE, OUTDATED, PROTOCOL, type VersionInfo } from '../../shared/src/version.ts';
import { Sound } from './audio.ts';
import { startGame } from './game.ts';
import { createGarage } from './garage.ts';
import { ITEM_ICONS } from './hud.ts';
import { createInput, isTouch, PAD_SIDES, type PadSide, type Steering, STEERINGS } from './input.ts';
import { offlineRace } from './offline.ts';
import { startPractice } from './practice.ts';
import { knowsTheme, themeOf } from './props.ts';
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
// at random. The Tracks to pick from are the server's once it has said which it races (`setTracks`), so one it added or
// changed is there too; until then, and for an Offline Race, the ones this game came with
const trackSelect = $<HTMLSelectElement>('track'), course = createCourse($<HTMLCanvasElement>('track-map')), facts = $('facts');
let tracks = TRACKS, trackIds = ['', ...tracks.map((t) => t.id)];
let track = pick(TRACKS).id;
const fillTracks = () => {
  trackSelect.replaceChildren(new Option('Any Track', ''));
  for (const theme of new Set(tracks.map((t) => t.theme))) {
    const places = document.createElement('optgroup');
    places.label = themeOf(theme).title;
    places.append(...tracks.filter((t) => t.theme === theme).map((t) => new Option(t.name, t.id)));
    trackSelect.append(places);
  }
};
fillTracks();
const sameTrack = (a: TrackDef, b: TrackDef) =>
  a.id === b.id && a.name === b.name && a.theme === b.theme && a.pieces === b.pieces && `${a.puddles}` === `${b.puddles}` && `${a.items}` === `${b.items}`;
/** Puts these Tracks up to pick from: this game's own where they are the same, so nothing is built twice. */
const setTracks = (list: TrackDef[]) => {
  tracks = list.map((d) => TRACKS.find((t) => sameTrack(t, d)) ?? d);
  trackIds = ['', ...tracks.map((t) => t.id)];
  // a Track no longer offered gives way to another at random
  if (track && !trackIds.includes(track)) track = pick(tracks).id;
  fillTracks();
  showTrack();
};
const line = (text: string, className = '') => Object.assign(document.createElement('p'), { textContent: text, className });
const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);
const showTrack = () => {
  trackSelect.value = track;
  const def = tracks.find((t) => t.id === track);
  course.show(def);
  $('course').classList.toggle('any', !def);
  if (!def) { facts.replaceChildren(line('A new Track every Race', 'place'), line(`${tracks.length} to race on`)); return; }
  const f = trackFacts(def), extras = [f.bridges && 'a bridge', f.climbs && count(f.climbs, 'a climb', 'climbs'), f.jumps && count(f.jumps, 'a jump', 'jumps')].filter(Boolean);
  facts.replaceChildren(line(`${themeOf(def.theme).title} · ${f.length} m, ${f.turns} turns`, 'place'), line(extras.join(', ') || 'all on one level'));
};
const stepTrack = (by: number) => { track = trackIds[(trackIds.indexOf(track) + by + trackIds.length) % trackIds.length]; showTrack(); };
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
// The game is an app for iPhone and iPad too, so there the first thing each visit offers it, over the start form, or play on
// in the browser. The App Store only has it for Apple's devices, so this asks for those, not for touch (`isTouch`); an iPad
// says it is a Mac, but one with a touch screen
const appOffer = $<HTMLDialogElement>('app');
$<HTMLAnchorElement>('app-store').href = APP_STORE;
$('app-web').addEventListener('click', () => appOffer.close());
const onAppleTouch = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
if (onAppleTouch) appOffer.showModal();
const serverUrl = import.meta.env.DEV ? `${location.protocol}//${location.hostname}:2567` : location.origin;
// waiting longer than this for the server, Play starts an Offline Race instead
const JOIN_TIMEOUT = 5000;

// A tab left open across a deploy runs the old game. The server says whether it still races with this one: if not, the
// update dialog offers a reload, and Play races offline (`outdated`); if so, it says which Tracks it races
const update = $<HTMLDialogElement>('update');
let outdated = false;
const showOutdated = () => {
  if (!outdated) setTracks(TRACKS);
  outdated = true;
  play.textContent = 'Play offline';
  if (!update.open) update.showModal();
};
$('update-now').addEventListener('click', () => location.reload());
$('update-later').addEventListener('click', () => update.close());
const isTrack = (d: any): d is TrackDef =>
  typeof d?.id === 'string' && typeof d.name === 'string' && typeof d.pieces === 'string' && knowsTheme(d.theme)
  && [d.puddles, d.items].every((l) => Array.isArray(l) && l.every(Number.isInteger));
(async () => {
  try {
    const info: VersionInfo = await (await fetch(`${serverUrl}/version?protocol=${PROTOCOL}`)).json();
    if (!info.compatible) { showOutdated(); return; }
    const list: unknown = await (await fetch(`${serverUrl}/tracks`)).json();
    // only the Tracks this game can draw: a newer server's may be set somewhere it doesn't know yet
    if (Array.isArray(list) && list.some(isTrack) && !outdated) setTracks(list.filter(isTrack));
  } catch {
    // no server, or one from before it answered: this game's own Tracks, and Play tries to join all the same
  }
})();

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
    let room: RaceLink | undefined;
    if (!outdated) {
      // `race2`: a picked Track joins a Race on it, any Track the fullest Race (`race` is left to apps from before the picker)
      const join = new Client(serverUrl).joinOrCreate('race2', track ? { name, body, track, protocol: PROTOCOL } : { name, body, protocol: PROTOCOL });
      try {
        room = await Promise.race([join, new Promise<never>((_, fail) => setTimeout(() => fail(new Error('timeout')), JOIN_TIMEOUT))]);
      } catch (err) {
        join.then((late) => late.leave(), () => {});
        // a server that no longer races with this game: the update dialog first, and Play then races offline
        if ((err as { code?: unknown }).code === OUTDATED) { showOutdated(); return; }
      }
    }
    if (!room) {
      // no server to be reached (or none to race with): race the Bots right here, on this game's own Tracks
      room = offlineRace(name, body, TRACKS.some((t) => t.id === track) ? track : undefined);
      offline.textContent = outdated ? 'Offline Race: reload to race online' : 'Offline Race: no server, just you and the Bots';
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
