import type { TrackDef } from '../track.ts';

export const londonBigben: TrackDef = {
  id: 'london-bigben',
  name: 'Big Ben Bends',
  theme: 'london',
  // twisting round the clock tower and the red phone boxes
  pieces: 'R L R S R S R* L S R L* R* S S S R R S* S* L S S',
  puddles: [7, 12],
  items: [8, 18],
};
