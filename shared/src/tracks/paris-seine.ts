import type { TrackDef } from '../track.ts';

export const parisSeine: TrackDef = {
  id: 'paris-seine',
  name: 'Seine Crossing',
  theme: 'paris',
  // up onto the bridge and across the river, twice
  pieces: 'R S L U* R* S* R* R* L* S* L* R* S* R* S* S* S* S* L* D* L* L* S S S S',
  puddles: [14, 20],
  items: [1, 15],
};
