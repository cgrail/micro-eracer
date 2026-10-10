import type { TrackDef } from '../track.ts';

export const garden: TrackDef = {
  id: 'garden',
  name: 'Garden',
  theme: 'garden',
  // a figure of eight: the second loop climbs onto a bridge over the start straight
  pieces: 'S S S S R S R U* R* S* S* S* L* D* S S S L S L S S',
  puddles: [1, 5, 15, 18],
  items: [3, 16],
};
