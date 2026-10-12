import type { TrackDef } from '../track.ts';

export const facebookLane: TrackDef = {
  id: 'facebook-lane',
  name: 'Like Lane',
  theme: 'facebook',
  // the long side of the campus and a quick chicane by the foosball table
  pieces: 'S R S S R S S S S L* R R* S* S S S S R S R S L S S',
  puddles: [4, 21],
  items: [7, 20],
};
