import type { TrackDef } from '../track.ts';

export const soccerLongball: TrackDef = {
  id: 'soccer-longball',
  name: 'Long Ball',
  theme: 'soccer',
  // a jump on the long straight down the wing
  pieces: 'S S R S L R* S R* S S S S S J* S* R S S S R* S S S S',
  puddles: [12, 15],
  items: [3, 18],
};
