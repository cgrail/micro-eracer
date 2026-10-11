/// <reference types="vite/client" />
import '@fontsource/bangers';
import { Client } from '@colyseus/sdk';
import { type BodyKind, BODY_KINDS } from '../../shared/src/car.ts';
import { Sound } from './audio.ts';
import { startGame } from './game.ts';
import { createGarage } from './garage.ts';
import { createInput, isTouch, type Steering, STEERINGS } from './input.ts';
import { offlineRace } from './offline.ts';
import type { RaceLink } from './state.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>('start'), nameInput = $<HTMLInputElement>('name'), play = $<HTMLButtonElement>('play');
const error = $('error'), hudEl = $('hud'), touch = $('touch'), mute = $<HTMLButtonElement>('mute'), offline = $('offline');
const hud = {
  pos: $('pos'), lap: $('lap'), msg: $('msg'), results: $<HTMLOListElement>('results'),
  energy: $('energy'), energyFill: $('energy-fill'), popups: $('popups'), item: $('item'), danger: $('danger'), action: $('fire'), news: $('news'),
};

// remembered per browser so the next visit is one tap; storage can be unavailable (private mode)
const load = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* not remembered */ } };

let body: BodyKind = BODY_KINDS.find((b) => b === load('body')) ?? 'roadster';
nameInput.value = load('name') ?? '';
const bodyButtons = [...form.querySelectorAll<HTMLButtonElement>('[data-body]')];
const garage = createGarage($('turntable'), $('stats'));
const showBody = () => { bodyButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.body === body))); garage.show(body); };
bodyButtons.forEach((b) => b.addEventListener('click', () => { body = b.dataset.body as BodyKind; showBody(); }));
showBody();
garage.run(true);

const controls = createInput({ steer: $('steer'), action: $('fire'), back: $('back') });
// touch only: steer by dragging on the pad, or with its ◀ and ▶ halves as two buttons
let steering: Steering = STEERINGS.find((s) => s === load('steer')) ?? 'slider';
const steerButtons = [...form.querySelectorAll<HTMLButtonElement>('[data-steer]')];
const showSteering = () => { steerButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.steer === steering))); controls.setSteering(steering); };
steerButtons.forEach((b) => b.addEventListener('click', () => { steering = b.dataset.steer as Steering; showSteering(); }));
$('steering').hidden = !isTouch;
showSteering();
const sound = new Sound();
const showMute = () => { mute.textContent = sound.muted ? '🔇' : '🔊'; mute.setAttribute('aria-pressed', String(sound.muted)); };
sound.setMuted(load('muted') === '1');
showMute();
mute.addEventListener('click', () => { sound.setMuted(!sound.muted); save('muted', sound.muted ? '1' : '0'); showMute(); mute.blur(); });
const serverUrl = import.meta.env.DEV ? `${location.protocol}//${location.hostname}:2567` : location.origin;
// waiting longer than this for the server, Play starts an Offline Race instead
const JOIN_TIMEOUT = 5000;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  save('name', name);
  save('body', body);
  if (isTouch) save('steer', steering);
  error.textContent = '';
  play.disabled = true;
  sound.unlock();
  try {
    // name tags and the banner are drawn on canvases, which need the comic font loaded first
    await document.fonts.load('40px Bangers').catch(() => undefined);
    const join = new Client(serverUrl).joinOrCreate('race', { name, body });
    let room: RaceLink;
    try {
      room = await Promise.race([join, new Promise<never>((_, fail) => setTimeout(() => fail(new Error('timeout')), JOIN_TIMEOUT))]);
    } catch {
      // no server to be reached: race the Bots right here
      join.then((late) => late.leave(), () => {});
      room = offlineRace(name, body);
      offline.hidden = false;
    }
    form.hidden = true;
    garage.run(false);
    hudEl.hidden = mute.hidden = false;
    touch.hidden = !isTouch;
    // so Space uses the Item instead of pressing the (now hidden) Play button again
    (document.activeElement as HTMLElement | null)?.blur();
    const stop = startGame(room, controls, hud, sound);
    room.onLeave(() => {
      stop();
      form.hidden = false;
      garage.run(true);
      hudEl.hidden = touch.hidden = mute.hidden = true;
      error.textContent = 'Connection lost.';
    });
  } catch {
    error.textContent = "The game couldn't start. Try reloading the page.";
  } finally {
    play.disabled = false;
  }
});
