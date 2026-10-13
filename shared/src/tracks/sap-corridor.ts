import type { TrackDef } from '../track.ts';

export const sapCorridor: TrackDef = {
  id: 'sap-corridor', // its id from when it was Coffee Corridor, kept for saved picks and the wire
  name: 'Campus Loop',
  theme: 'sap',
  // the campus road round the three star buildings, as it runs on the map: from the charging station down along the
  // woods, round WDF19-21 and WDF18, and back through the dip between the stars
  pieces: 'S S L* S S S S L S S S L* R* S S S S L* S S L* S S S R* L* S S',
  puddles: [9, 22],
  items: [5, 14],
};
