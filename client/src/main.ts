/// <reference types="vite/client" />
import { Client } from '@colyseus/sdk';
import { type BodyKind, BODY_KINDS, initPhysics } from '../../shared/src/car.ts';
import { startGame } from './game.ts';
import { createInput, isTouch } from './input.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>('start'), nameInput = $<HTMLInputElement>('name'), play = $<HTMLButtonElement>('play');
const error = $('error'), hudEl = $('hud'), touch = $('touch');
const hud = { pos: $('pos'), lap: $('lap'), msg: $('msg'), results: $<HTMLOListElement>('results') };

// remembered per browser so the next visit is one tap; storage can be unavailable (private mode)
const load = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* not remembered */ } };

let body: BodyKind = BODY_KINDS.find((b) => b === load('body')) ?? 'roadster';
nameInput.value = load('name') ?? '';
const bodyButtons = [...form.querySelectorAll<HTMLButtonElement>('[data-body]')];
const showBody = () => bodyButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.body === body)));
bodyButtons.forEach((b) => b.addEventListener('click', () => { body = b.dataset.body as BodyKind; showBody(); }));
showBody();

const readInput = createInput($('steer'), $('brake'));
const physics = initPhysics();
const serverUrl = import.meta.env.DEV ? `${location.protocol}//${location.hostname}:2567` : location.origin;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  save('name', name);
  save('body', body);
  error.textContent = '';
  play.disabled = true;
  try {
    await physics;
    const room = await new Client(serverUrl).joinOrCreate('race', { name, body });
    form.hidden = true;
    hudEl.hidden = false;
    touch.hidden = !isTouch;
    const stop = startGame(room, readInput, hud);
    room.onLeave(() => {
      stop();
      form.hidden = false;
      hudEl.hidden = touch.hidden = true;
      error.textContent = 'Connection lost.';
    });
  } catch {
    // shortcut: no Offline Race yet, that fallback is build step 5
    error.textContent = "Can't reach the server right now. Try again in a moment.";
  } finally {
    play.disabled = false;
  }
});
