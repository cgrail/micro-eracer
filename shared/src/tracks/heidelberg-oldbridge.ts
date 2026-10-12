import type { TrackDef } from '../track.ts';

export const heidelbergOldbridge: TrackDef = {
  id: 'heidelberg-oldbridge',
  name: 'Old Bridge',
  theme: 'heidelberg',
  // up and over the Old Bridge and back along the Neckar
  pieces: 'S R U* S* D* R* S R L S S S R S R* S L* R* S S',
  puddles: [7, 11],
  items: [9, 15],
};
