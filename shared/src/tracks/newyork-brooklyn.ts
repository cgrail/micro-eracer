import type { TrackDef } from '../track.ts';

export const newyorkBrooklyn: TrackDef = {
  id: 'newyork-brooklyn',
  name: 'Brooklyn Bridge',
  theme: 'newyork',
  // over the bridge and back underneath it
  pieces: 'L R L S R S* R* S S U* S* R* R* S* S* S* L* S* S* S* D* L* S L* S S',
  puddles: [1, 18],
  items: [13, 22],
};
