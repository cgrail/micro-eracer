import type { TrackDef } from '../track.ts';

export const soccerTouchline: TrackDef = {
  id: 'soccer-touchline',
  name: 'Touchline',
  theme: 'soccer',
  // along the touchline, round the corner flags and back past the bench
  pieces: 'S L* S S S R* S R* S S S S S R S S S S S R* S R S S',
  puddles: [1, 19],
  items: [8, 17],
};
