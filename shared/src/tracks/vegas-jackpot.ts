import type { TrackDef } from '../track.ts';

export const vegasJackpot: TrackDef = {
  id: 'vegas-jackpot',
  name: 'Jackpot Jump',
  theme: 'vegas',
  // a jump over the dice on the back straight
  pieces: 'S S L* S J* S* L L S* S* R* R S S L* S S S L* S S S L* S S S',
  puddles: [13, 23],
  items: [3, 12],
};
