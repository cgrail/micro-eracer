import type { TrackDef } from '../track.ts';

export const googleSlide: TrackDef = {
  id: 'google-slide',
  name: 'Slide Ride',
  theme: 'google',
  // up and over the corridor it comes back along, like the slide in the lobby
  pieces: 'S R L* L* S* S L S L* L* U* S* R* S* S* R* D* S* S S S R S R S S',
  puddles: [12, 23],
  items: [5, 22],
};
