import type { TrackDef } from '../track.ts';

export const heidelbergOldbridge: TrackDef = {
  id: 'heidelberg-oldbridge',
  name: 'Alte Brücke',
  theme: 'heidelberg',
  // over the Neckar on the Alte Brücke, through its gate, and round under the castle
  pieces: 'S R U* S* D* R* S R L S S S R S R* S L* R* S S',
  puddles: [7, 11],
  items: [9, 15],
};
