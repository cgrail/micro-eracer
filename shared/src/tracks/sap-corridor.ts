import type { TrackDef } from '../track.ts';

export const sapCorridor: TrackDef = {
  id: 'sap-corridor',
  name: 'Coffee Corridor',
  theme: 'sap',
  // down the corridor to the coffee bar and back past the desks
  pieces: 'S L R* R* S* S S S S R* S S S R* L* S S R S R* S L* S R* S S',
  puddles: [13, 23],
  items: [8, 22],
};
