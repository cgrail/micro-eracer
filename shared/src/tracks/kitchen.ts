import type { TrackDef } from '../track.ts';

export const kitchen: TrackDef = {
  id: 'kitchen',
  name: 'Kitchen Table',
  theme: 'kitchen',
  pieces: 'S S S R* S S R S S R* L* R L S R* R* S S',
  puddles: [8],
  items: [4, 13],
};
