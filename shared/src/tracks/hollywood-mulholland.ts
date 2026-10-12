import type { TrackDef } from '../track.ts';

export const hollywoodMulholland: TrackDef = {
  id: 'hollywood-mulholland',
  name: 'Mulholland Drive',
  theme: 'hollywood',
  // up into the hills under the sign and down over the boulevard
  pieces: 'S S S R S S U* R* R* S* U* S* S* L* S* S* S* S* D* L* D* L* L* R* S S',
  puddles: [7, 17],
  items: [2, 16],
};
