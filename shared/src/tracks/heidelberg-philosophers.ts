import type { TrackDef } from '../track.ts';

export const heidelbergPhilosophers: TrackDef = {
  id: 'heidelberg-philosophers',
  name: 'Philosophers Walk',
  theme: 'heidelberg',
  // up the hill on the far bank and back over the Neckar
  pieces: 'S U* L* S* S* S* L* L* S* S* R* S* S* S* L* S* S* R* R* D* R* S S S',
  puddles: [13, 21],
  items: [4, 15],
};
