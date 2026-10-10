import { LAPS, type Phase, SEATS } from '../../shared/src/race.ts';
import { MAX_ENERGY } from '../../shared/src/car.ts';
import type { Sound } from './audio.ts';
import { RECHARGE, type CarState, type RaceState, STRANDED } from './state.ts';

export interface Hud {
  pos: HTMLElement; lap: HTMLElement; msg: HTMLElement; results: HTMLOListElement; energy: HTMLElement; energyFill: HTMLElement;
  popups: HTMLElement; item: HTMLElement; danger: HTMLElement;
  /** The touch action button: it says what a press does. */
  action: HTMLElement;
  /** A line for news such as who just joined. */
  news: HTMLElement;
}

export const ITEM_ICONS: Record<string, string> = { zap: '⚡', missile: '🚀', mine: '💣', shield: '🛡️', '': '' };
/** The Item an E-Car holds, with the Shots left in a Zap. */
export const itemLabel = (c: CarState) => `${ITEM_ICONS[c.item] ?? ''}${c.item === 'zap' ? c.ammo : ''}`;

/**
 * The HUD over the game: Position, Lap, Energy, messages and results. It touches the DOM only when something changed.
 * Running dry turns the game view (`view`) black and white, and the colour comes back as the drone Recharges the battery.
 */
export function createHud(hud: Hud, sound: Sound, view: HTMLElement) {
  let lastMsg = '', lastResults = '', goUntil = 0, lastPhase: Phase | undefined, lastCount = -1, lastFilter = '';
  let newsTimer: ReturnType<typeof setTimeout> | undefined;
  return {
    /** `me` is our own E-Car; `status` a connection message that wins over everything else. */
    update(now: number, state: RaceState | undefined, me: CarState | undefined, status: string) {
      if (!state) return;
      if (lastPhase === 'grid' && state.phase === 'racing') { goUntil = now + 1000; sound.countdown(true); }
      lastPhase = state.phase;
      const left = Math.ceil(state.timer);
      if (state.phase === 'grid' && left !== lastCount && left > 0 && left <= 3) sound.countdown(false);
      lastCount = state.phase === 'grid' ? left : -1;
      const names: string[] = [];
      state.results.forEach((n) => names.push(n));
      let msg = status;
      if (!msg && state.phase === 'grid') msg = names.length ? `Next race in ${left}` : String(left);
      else if (!msg && me?.mode === STRANDED) msg = 'Battery empty!';
      else if (!msg && me?.mode === RECHARGE) msg = 'Recharging…';
      else if (!msg && me?.finished) msg = `Finished P${me.position}!`;
      else if (!msg && state.phase === 'finishing') msg = `Race ends in ${left}`;
      else if (!msg && now < goUntil) msg = 'GO!';
      hud.pos.textContent = me ? `P${me.position}/${SEATS}` : '';
      hud.lap.textContent = me ? `Lap ${me.lap}/${LAPS}` : '';
      const action = me ? itemLabel(me) : '';
      if (hud.action.textContent !== action) hud.action.textContent = action;
      if (msg !== lastMsg) hud.msg.textContent = lastMsg = msg;
      const energy = me?.energy ?? MAX_ENERGY;
      hud.energyFill.style.width = `${energy}%`;
      if (hud.energy.getAttribute('aria-valuenow') !== String(energy)) hud.energy.setAttribute('aria-valuenow', String(energy));
      hud.energy.dataset.level = energy < 25 ? 'limp' : energy < 50 ? 'low' : 'ok';
      hud.danger.hidden = !(me && state.phase !== 'grid' && (energy < 15 || me.mode === STRANDED));
      const grey = me?.mode === STRANDED ? 1 : me?.mode === RECHARGE ? 1 - energy / MAX_ENERGY : 0;
      // no filter at all otherwise: a full-screen filter costs phones a pass every frame
      const filter = grey > 0.02 ? `grayscale(${grey.toFixed(2)}) contrast(${(1 + grey * 0.2).toFixed(2)})` : '';
      if (filter !== lastFilter) view.style.filter = lastFilter = filter;
      // once someone has finished, the standings fill up as each Racer crosses the line; on the grid, the last Race's final order
      const board: string[] = [];
      if (state.phase === 'grid') board.push(...names);
      else if (state.phase === 'finishing') {
        const done: CarState[] = [];
        state.cars.forEach((c) => { if (c.finished) done.push(c); });
        board.push(...done.sort((a, b) => a.position - b.position).map((c) => c.name));
      }
      const shown = `${state.phase}:${board.join('\n')}`;
      if (shown !== lastResults) {
        lastResults = shown;
        hud.results.classList.toggle('live', state.phase === 'finishing');
        hud.results.replaceChildren(...board.map((n) => Object.assign(document.createElement('li'), { textContent: n, className: n === me?.name ? 'me' : '' })));
      }
    },

    /** Shows a line of news for a few seconds; a newer one replaces it. */
    announce(text: string) {
      hud.news.textContent = text;
      clearTimeout(newsTimer);
      newsTimer = setTimeout(() => (hud.news.textContent = ''), 3500);
    },

    popup(text: string, kind: 'gain' | 'loss') {
      const el = Object.assign(document.createElement('div'), { textContent: text, className: `popup ${kind}` });
      hud.popups.append(el);
      setTimeout(() => el.remove(), 1200);
    },
  };
}
