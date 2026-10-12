import type { TrackDef } from '../track.ts';

export const googleBallpit: TrackDef = {
  id: 'google-ballpit',
  name: 'Ball Pit Bends',
  theme: 'google',
  // round the ball pit and between the bean bags, hardly a straight to rest on
  pieces: 'R S R L* R* S R* L* R* S S S R S L R R* S* R* S L* L* S S',
  puddles: [9, 14],
  items: [5, 19],
};
