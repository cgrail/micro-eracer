import type { TrackDef } from '../track.ts';

export const londonPiccadilly: TrackDef = {
  id: 'london-piccadilly',
  name: 'Piccadilly Circuit',
  theme: 'london',
  // down the long street and round the back of the square
  pieces: 'S S S L S L* S S S S L* R* S S L* S* S* L S L S R* S S',
  puddles: [6, 15],
  items: [4, 16],
};
