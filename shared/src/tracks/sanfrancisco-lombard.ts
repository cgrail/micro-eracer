import type { TrackDef } from '../track.ts';

export const sanfranciscoLombard: TrackDef = {
  id: 'sanfrancisco-lombard',
  name: 'Lombard Street',
  theme: 'sanfrancisco',
  // up two steep hills and down the crooked street
  pieces: 'S L U* U* S* R* S* R* D* D* S* S S R* L R S S S R L R S R S S',
  puddles: [10, 19],
  items: [11, 22],
};
