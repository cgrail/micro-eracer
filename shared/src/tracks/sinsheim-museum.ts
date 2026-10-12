import type { TrackDef } from '../track.ts';

export const sinsheimMuseum: TrackDef = {
  id: 'sinsheim-museum',
  name: 'Museum Mile',
  theme: 'sinsheim',
  // a jump by the museum and the long road round the stadium
  pieces: 'J* S* L S S S S R* R S* S* S S S R L R S S S S R S R* S S',
  puddles: [10, 23],
  items: [12, 22],
};
