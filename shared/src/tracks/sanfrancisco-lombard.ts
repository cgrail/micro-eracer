import type { TrackDef } from '../track.ts';

export const sanfranciscoLombard: TrackDef = {
  id: 'sanfrancisco-lombard', // its id from when it was Lombard Street, kept for saved picks and the wire
  name: 'Pier 39',
  theme: 'sanfrancisco',
  // up on the hills, then high over the bay on the Golden Gate and back along the piers
  pieces: 'S L U* U* S* R* S* R* D* D* S* S S R* L R S S S R L R S R S S',
  puddles: [10, 19],
  items: [11, 22],
};
