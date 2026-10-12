import type { TrackDef } from '../track.ts';

export const zuzenhausenElsenz: TrackDef = {
  id: 'zuzenhausen-elsenz',
  name: 'Elsenz Valley',
  theme: 'zuzenhausen',
  // up the valley side, along the top and down to the village again
  pieces: 'L R U* S* R* U* S* S* S* R* S* S* R* S* L* S* L* R* R* D* D* R* S S',
  puddles: [4, 21],
  items: [3, 15],
};
