import type { TrackDef } from '../track.ts';

export const heidelbergCastle: TrackDef = {
  id: 'heidelberg-castle',
  name: 'Castle Climb',
  theme: 'heidelberg',
  // up the castle hill, round the terrace and over the old town
  pieces: 'S S U* R* S* S* S* R* S* R* R* L* S* L* R* S* L* R* L* S* D* L* S L S S',
  puddles: [4, 7],
  items: [8, 19],
};
