import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TRACKS } from '../../shared/src/track.ts';
import { type RaceState, trackDefOf } from './state.ts';

const race = (trackId: string, track?: RaceState['track']) => ({ trackId, track }) as RaceState;

test('the game races the Track the room sends, even one it never came with', () => {
  const sent = { id: 'pier', name: 'Pier', theme: 'garden', pieces: 'S S R R S S R R S S', puddles: [1], items: [2, 6] };
  assert.deepEqual(trackDefOf(race('pier', sent)), sent);
  // a layout the server changed under a known id is the server's too
  const garden = TRACKS.find((t) => t.id === 'garden')!;
  assert.equal(trackDefOf(race('garden', { ...garden, pieces: sent.pieces })).pieces, sent.pieces);
  // a server from before it sent the Track: this game's own by its id
  assert.equal(trackDefOf(race('garden', { id: '', name: '', theme: '', pieces: '', puddles: [], items: [] })), garden);
  assert.equal(trackDefOf(race('garden')), garden);
});
