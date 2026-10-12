import type { TrackDef } from '../track.ts';

export const berlinDoner: TrackDef = {
  id: 'berlin-doner',
  name: 'Döner Dash',
  theme: 'berlin',
  // from one Döner stand to the next and back
  pieces: 'R L R* S R L* L* S* S L* S S L* R* S L S S S S L L* S S',
  puddles: [3, 15],
  items: [8, 17],
};
