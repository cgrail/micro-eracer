import type { TrackDef } from '../track.ts';

export const newyorkBroadway: TrackDef = {
  id: 'newyork-broadway',
  name: 'Broadway',
  theme: 'newyork',
  // long avenues, a block at a time
  pieces: 'S R L* S L S S S S S L S S S S S S L S S S S L S S S',
  puddles: [10, 15],
  items: [3, 11],
};
