import type { TrackDef } from '../track.ts';

export const anthropicReading: TrackDef = {
  id: 'anthropic-reading',
  name: 'Reading Room',
  theme: 'anthropic',
  // a small loop between the armchairs, tight at the far end
  pieces: 'S R L L* S* S S L S L* S R S S L* L* S S',
  puddles: [1, 8],
  items: [6, 12],
};
