import type { TrackDef } from '../track.ts';

export const sapCorridor: TrackDef = {
  id: 'sap-corridor', // its id from when it was Coffee Corridor, kept for saved picks and the wire
  name: 'Campus Loop',
  theme: 'sap',
  // round the campus past WDF01, the star buildings, the logo and the marble ball
  pieces: 'S L R* R* S* S S S S R* S S S R* L* S S R S R* S L* S R* S S',
  puddles: [13, 23],
  items: [8, 22],
};
