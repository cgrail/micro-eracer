import { LAPS, type Phase, SEATS } from '../../shared/src/race.ts';
import { MAX_ENERGY } from '../../shared/src/car.ts';
import type { Sound } from './audio.ts';
import { AIRLIFT, type CarState, type RaceState, STRANDED } from './state.ts';

export interface Hud {
  pos: HTMLElement; lap: HTMLElement; msg: HTMLElement; results: HTMLOListElement; energy: HTMLElement; energyFill: HTMLElement;
  popups: HTMLElement; item: HTMLElement; danger: HTMLElement;
}

export const ITEM_ICONS: Record<string, string> = { missile: '🚀', mine: '💣', shield: '🛡️', '': '' };

/** The HUD over the game: Position, Lap, Energy, messages and results. It touches the DOM only when something changed. */
export function createHud(hud: Hud, sound: Sound) {
  let lastMsg = '', lastResults = '', goUntil = 0, lastPhase: Phase | undefined, lastCount = -1;
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
      else if (!msg && me?.mode === AIRLIFT) msg = 'Airlift!';
      else if (!msg && me?.finished) msg = `Finished P${me.position}!`;
      else if (!msg && state.phase === 'finishing') msg = `Race ends in ${left}`;
      else if (!msg && now < goUntil) msg = 'GO!';
      hud.pos.textContent = me ? `P${me.position}/${SEATS}` : '';
      hud.lap.textContent = me ? `Lap ${me.lap}/${LAPS}` : '';
      if (msg !== lastMsg) hud.msg.textContent = lastMsg = msg;
      const energy = me?.energy ?? MAX_ENERGY;
      hud.energyFill.style.width = `${energy}%`;
      if (hud.energy.getAttribute('aria-valuenow') !== String(energy)) hud.energy.setAttribute('aria-valuenow', String(energy));
      hud.energy.dataset.level = energy < 25 ? 'limp' : energy < 50 ? 'low' : 'ok';
      hud.danger.hidden = !(me && state.phase !== 'grid' && (energy < 15 || me.mode === STRANDED));
      const shown = state.phase === 'grid' ? names.join('\n') : '';
      if (shown !== lastResults) {
        lastResults = shown;
        hud.results.replaceChildren(...(shown ? names : []).map((n) => Object.assign(document.createElement('li'), { textContent: n })));
      }
    },

    popup(text: string, kind: 'gain' | 'loss') {
      const el = Object.assign(document.createElement('div'), { textContent: text, className: `popup ${kind}` });
      hud.popups.append(el);
      setTimeout(() => el.remove(), 1200);
    },
  };
}
