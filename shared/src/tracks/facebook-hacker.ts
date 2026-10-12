import type { TrackDef } from '../track.ts';

export const facebookHacker: TrackDef = {
  id: 'facebook-hacker',
  name: 'Hacker Way',
  theme: 'facebook',
  // a short climb over the courtyard, then the long main street
  pieces: 'S R L* U* R* S* D* R* S S S S S S R* S R L* L* S* R R* S* S S S',
  puddles: [12, 21],
  items: [9, 22],
};
