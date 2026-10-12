import type { TrackDef } from '../track.ts';

export const sapRing: TrackDef = {
  id: 'sap-ring',
  name: 'Walldorf Ring',
  theme: 'sap',
  // four long straights round the open-plan office, a ring for full speed
  pieces: 'S L* S S S L S S S S S L S S S L* S S S S',
  puddles: [2, 11],
  items: [7, 17],
};
