import type { TrackDef } from '../track.ts';

export const berlinSpaeti: TrackDef = {
  id: 'berlin-spaeti',
  name: 'Späti Jump',
  theme: 'berlin',
  // a jump over the crates behind the Späti
  pieces: 'L S R S R* R* L* S J* S* L* S R R* S* S S S R S L R* S R* S S',
  puddles: [7, 23],
  items: [3, 16],
};
