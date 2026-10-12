import type { TrackDef } from '../track.ts';

export const parisChamps: TrackDef = {
  id: 'paris-champs',
  name: 'Champs-Élysées',
  theme: 'paris',
  // the long avenue up to the arch and round the back
  pieces: 'S R* S S S R S S S S S R S S S R R* S L L* S* R S S',
  puddles: [10, 19],
  items: [9, 20],
};
