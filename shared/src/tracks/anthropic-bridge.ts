import type { TrackDef } from '../track.ts';

export const anthropicBridge: TrackDef = {
  id: 'anthropic-bridge',
  name: 'Spark Bridge',
  theme: 'anthropic',
  // up past the bookshelf and over its own start, round the reading nook
  pieces: 'L* S R S R* S U* R* R* S* S* S* L* S* S* S* L* D* S* L* S S',
  puddles: [7, 12],
  items: [10, 18],
};
