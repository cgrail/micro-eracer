import type { TrackDef } from '../track.ts';

export const bathtub: TrackDef = {
  id: 'bathtub',
  name: 'Bathtub',
  theme: 'bathtub',
  // up onto the soap dish and round it, high over the water
  pieces: 'S L* R R* U* R* D* L R* S R L R* R* S S',
  puddles: [9, 11],
  items: [0, 7],
};
