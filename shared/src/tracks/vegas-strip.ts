import type { TrackDef } from '../track.ts';

export const vegasStrip: TrackDef = {
  id: 'vegas-strip',
  name: 'The Strip',
  theme: 'vegas',
  // four long straights and a jump at the end of the Strip
  pieces: 'J* S* S S L* S S S S L S S S S S S S L* S S S S L* S S S',
  puddles: [4, 20],
  items: [7, 23],
};
