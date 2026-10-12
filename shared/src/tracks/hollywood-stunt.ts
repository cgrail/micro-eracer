import type { TrackDef } from '../track.ts';

export const hollywoodStunt: TrackDef = {
  id: 'hollywood-stunt',
  name: 'Stunt Jump',
  theme: 'hollywood',
  // a stunt jump on the boulevard
  pieces: 'S L S J* S* R S R S S S S S S R R* L S* S* S S R* S R* S S',
  puddles: [2, 12],
  items: [10, 19],
};
