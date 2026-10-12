import type { TrackDef } from '../track.ts';

export const indiaThali: TrackDef = {
  id: 'india-thali',
  name: 'Thali Ring',
  theme: 'india',
  // round the edge of the table, a chicane at the tandoor
  pieces: 'S L R S* R* S* S R S S S L* S R S S R R* L* S S R S S',
  puddles: [9, 13],
  items: [8, 19],
};
