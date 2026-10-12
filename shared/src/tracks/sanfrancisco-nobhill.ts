import type { TrackDef } from '../track.ts';

export const sanfranciscoNobhill: TrackDef = {
  id: 'sanfrancisco-nobhill',
  name: 'Nob Hill',
  theme: 'sanfrancisco',
  // up Nob Hill, round the top and down again
  pieces: 'U* S* R* S* U* R* S* S* S* R* R* D* R* S* R* S* D* R* S S S R S S',
  puddles: [8, 18],
  items: [1, 13],
};
