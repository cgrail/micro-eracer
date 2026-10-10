import type { TrackDef } from '../track.ts';

export const desk: TrackDef = {
  id: 'desk',
  name: 'Office Desk',
  theme: 'desk',
  // a jump off a ruler on the long straight, landing in the Item Boxes
  pieces: 'S S S R* S S R* S J* S* S L R R* L R S S R* S S S',
  puddles: [10, 17],
  items: [4, 9, 19],
};
