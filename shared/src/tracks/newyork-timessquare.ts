import type { TrackDef } from '../track.ts';

export const newyorkTimessquare: TrackDef = {
  id: 'newyork-timessquare',
  name: 'Times Square',
  theme: 'newyork',
  // a jump on the avenue and a ramp up round the square
  pieces: 'R* S S S R* S J* S* S R* S S S U* S* S* R* S* R* S* D* L* S S',
  puddles: [15, 19],
  items: [1, 12],
};
