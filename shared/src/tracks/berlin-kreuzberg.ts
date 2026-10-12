import type { TrackDef } from '../track.ts';

export const berlinKreuzberg: TrackDef = {
  id: 'berlin-kreuzberg',
  name: 'Kreuzberg Corners',
  theme: 'berlin',
  // round the corners of Kreuzberg, past the Späti
  pieces: 'S L* S L R R* S* R S S S S S R* R* L* S S S R* S R S S',
  puddles: [1, 4],
  items: [2, 20],
};
