import type { TrackDef } from '../track.ts';

export const sanfranciscoGoldengate: TrackDef = {
  id: 'sanfrancisco-goldengate',
  name: 'Golden Gate',
  theme: 'sanfrancisco',
  // the long way round to the bridge and over it
  pieces: 'S S R S S S L L* S S S U* S* S* L* S* S* S* S* D* L* S S L* S S',
  puddles: [14, 23],
  items: [3, 18],
};
