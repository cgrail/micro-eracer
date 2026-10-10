import type { TrackDef } from '../track.ts';

export const garden: TrackDef = {
  id: 'garden',
  name: 'Garden',
  theme: 'garden',
  pieces: 'S S S R* S S R L R* S R L R L R L R* R* S S',
  puddles: [1, 5, 9, 13],
  items: [4, 11],
};
