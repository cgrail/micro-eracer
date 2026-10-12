import type { TrackDef } from '../track.ts';

export const lanCables: TrackDef = {
  id: 'lan-cables',
  name: 'Cable Chaos',
  theme: 'lan',
  // snaking between the tables and the cables under them
  pieces: 'S S R S R S L* R S* S* R* L* R* S S S R* R S* L* S S',
  puddles: [11, 14],
  items: [9, 18],
};
