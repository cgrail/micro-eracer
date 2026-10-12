import type { TrackDef } from '../track.ts';

export const heidelbergHauptstrasse: TrackDef = {
  id: 'heidelberg-hauptstrasse',
  name: 'Hauptstrasse',
  theme: 'heidelberg',
  // along the main street of the old town and over the Neckar on the Alte Brücke
  pieces: 'S R* S* S* S* L* L* S S R L S S L* S S S L R S L* L* S S',
  puddles: [5, 19],
  items: [2, 11],
};
