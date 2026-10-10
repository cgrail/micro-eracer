/// <reference types="vite/client" />
import '@fontsource/bangers';
import { Client } from '@colyseus/sdk';
import { type BodyKind, BODY_KINDS, initPhysics } from '../../shared/src/car.ts';
import { Sound } from './audio.ts';
import { startGame } from './game.ts';
import { createInput, isTouch } from './input.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>('start'), nameInput = $<HTMLInputElement>('name'), play = $<HTMLButtonElement>('play');
const error = $('error'), hudEl = $('hud'), touch = $('touch'), mute = $<HTMLButtonElement>('mute');
const hud = {
  pos: $('pos'), lap: $('lap'), msg: $('msg'), results: $<HTMLOListElement>('results'),
  energy: $('energy'), energyFill: $('energy-fill'), popups: $('popups'), item: $('item'), danger: $('danger'),
};

// remembered per browser so the next visit is one tap; storage can be unavailable (private mode)
const load = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* not remembered */ } };

let body: BodyKind = BODY_KINDS.find((b) => b === load('body')) ?? 'roadster';
nameInput.value = load('name') ?? '';
const bodyButtons = [...form.querySelectorAll<HTMLButtonElement>('[data-body]')];
const showBody = () => bodyButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.body === body)));
bodyButtons.forEach((b) => b.addEventListener('click', () => { body = b.dataset.body as BodyKind; showBody(); }));
showBody();

const controls = createInput({ steer: $('steer'), brake: $('brake'), fire: $('fire'), item: $('use') });
const sound = new Sound();
const showMute = () => { mute.textContent = sound.muted ? '🔇' : '🔊'; mute.setAttribute('aria-pressed', String(sound.muted)); };
sound.setMuted(load('muted') === '1');
showMute();
mute.addEventListener('click', () => { sound.setMuted(!sound.muted); save('muted', sound.muted ? '1' : '0'); showMute(); mute.blur(); });
const physics = initPhysics();
const serverUrl = import.meta.env.DEV ? `${location.protocol}//${location.hostname}:2567` : location.origin;

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
    await Promise.all([physics, document.fonts.load('40px Bangers').catch(() => undefined)]);
    const room = await new Client(serverUrl).joinOrCreate('race', { name, body });
    form.hidden = true;
    hudEl.hidden = mute.hidden = false;
    touch.hidden = !isTouch;
    // so Space shoots instead of pressing the (now hidden) Play button again
    (document.activeElement as HTMLElement | null)?.blur();
    const stop = startGame(room, controls, hud, sound);
    room.onLeave(() => {
      stop();
      form.hidden = false;
      hudEl.hidden = touch.hidden = mute.hidden = true;
      error.textContent = 'Connection lost.';
    });
  } catch {
    // shortcut: no Offline Race yet, that fallback is build step 5
    error.textContent = "Can't reach the server right now. Try again in a moment.";
  } finally {
    play.disabled = false;
  }
});
