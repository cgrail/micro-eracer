import type { TrackDef } from '../track.ts';

export const kitchen: TrackDef = {
  id: 'kitchen',
  name: 'Kitchen Table',
  theme: 'kitchen',
  // up a ramp onto the chopping board, round it and back down
  pieces: 'S S S R* U* S* R* D* S R* L* R L S R* R* S S',
  puddles: [8],
  items: [5, 13],
};
