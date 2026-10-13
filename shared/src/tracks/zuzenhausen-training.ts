import type { TrackDef } from '../track.ts';

export const zuzenhausenTraining: TrackDef = {
  id: 'zuzenhausen-training',
  name: 'Training Ground',
  theme: 'zuzenhausen',
  // the paths round the TSG's training pitches, as they run on the map: up Horrenberger Straße past the pond, round the
  // top two pitches, down along the woods over the brook, round the training centre and back along the car park
  pieces: 'S S R L R S S R L S R* S S R S S L* U* D* L* R* S R S S R L R S S S S',
  puddles: [6, 23],
  items: [12, 21],
};
