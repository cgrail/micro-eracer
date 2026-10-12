import type { TrackDef } from '../track.ts';

export const sinsheimConcorde: TrackDef = {
  id: 'sinsheim-concorde',
  name: 'Concorde Jump',
  theme: 'sinsheim',
  // a take-off jump under the Concorde
  pieces: 'J* S* S R* R S* S* L* L* S S R* S R* S S S R* S L S R S R S S',
  puddles: [4, 20],
  items: [6, 22],
};
