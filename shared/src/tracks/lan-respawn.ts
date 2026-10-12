import type { TrackDef } from '../track.ts';

export const lanRespawn: TrackDef = {
  id: 'lan-respawn',
  name: 'Respawn Jump',
  theme: 'lan',
  // a jump off a pizza box in the middle of a twisting hall
  pieces: 'S L L* S J* S* S S L* L R* S S S L S L S L R* S R S S',
  puddles: [11, 20],
  items: [7, 17],
};
