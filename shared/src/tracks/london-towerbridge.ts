import type { TrackDef } from '../track.ts';

export const londonTowerbridge: TrackDef = {
  id: 'london-towerbridge',
  name: 'Tower Bridge',
  theme: 'london',
  // over the bridge and back under it along the river
  pieces: 'L* L* S S S S R S R L* R* S S R S R S U* L* S* L* D* S S',
  puddles: [5, 15],
  items: [3, 14],
};
