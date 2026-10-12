import type { TrackDef } from '../track.ts';

export const vegasHighroller: TrackDef = {
  id: 'vegas-highroller',
  name: 'High Roller',
  theme: 'vegas',
  // up to the high tables and over the casino floor
  pieces: 'S S L S L R L U* R* L* L* S* L* S* R* S* S* S* R* S* D* R* S R S S',
  puddles: [6, 10],
  items: [3, 19],
};
