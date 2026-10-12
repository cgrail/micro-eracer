import type { TrackDef } from '../track.ts';

export const golfFairway: TrackDef = {
  id: 'golf-fairway',
  name: 'Fairway Drive',
  theme: 'golf',
  // long fairways and a dogleg round the clubhouse
  pieces: 'S S S S L S S S S L* L S* S* S R* S S R L S* S* L* S L S S',
  puddles: [19, 23],
  items: [6, 20],
};
