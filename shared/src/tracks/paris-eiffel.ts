import type { TrackDef } from '../track.ts';

export const parisEiffel: TrackDef = {
  id: 'paris-eiffel',
  name: 'Eiffel Loop',
  theme: 'paris',
  // a long loop round the tower
  pieces: 'R* S L S S S L S S S S S L L* S R* S S S S S L* S L S S',
  puddles: [10, 21],
  items: [5, 19],
};
