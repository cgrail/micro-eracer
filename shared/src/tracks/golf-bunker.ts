import type { TrackDef } from '../track.ts';

export const golfBunker: TrackDef = {
  id: 'golf-bunker',
  name: 'Bunker Hill',
  theme: 'golf',
  // up onto the tee, along the hill and down to the green
  pieces: 'S R U* S* S* R* U* S* D* S* R* D* S* S S S S S R R S* S* S L S S',
  puddles: [10, 16],
  items: [12, 21],
};
