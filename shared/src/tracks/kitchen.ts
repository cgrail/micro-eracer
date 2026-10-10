import type { TrackDef } from '../track.ts';

export const kitchen: TrackDef = {
  id: 'kitchen',
  name: 'Kitchen Table',
  pieces: 'S S S R* S S R S S R* L* R L S R* R* S S',
  props: [
    { kind: 'toaster', x: -40, z: -32 },
    { kind: 'mug', x: -24, z: 32 },
    { kind: 'plate', x: -16, z: 8 },
    { kind: 'plate', x: -48, z: -8 },
  ],
};
