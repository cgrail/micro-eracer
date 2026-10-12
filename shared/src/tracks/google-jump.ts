import type { TrackDef } from '../track.ts';

export const googleJump: TrackDef = {
  id: 'google-jump',
  name: 'Bean Bag Jump',
  theme: 'google',
  // a jump right after the start, then the long way round the campus
  pieces: 'J* S* S R S S S R* R* S* L* S* S* L* R* S S R* S S S R R* L* S S',
  puddles: [5, 23],
  items: [4, 12],
};
