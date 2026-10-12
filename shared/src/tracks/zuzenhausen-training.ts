import type { TrackDef } from '../track.ts';

export const zuzenhausenTraining: TrackDef = {
  id: 'zuzenhausen-training',
  name: 'Training Ground',
  theme: 'zuzenhausen',
  // round the training pitches and over the Elsenz
  pieces: 'S R S S L* S L S S* S* S* S L L S* R* S S S S L L S S',
  puddles: [2, 6],
  items: [8, 16],
};
