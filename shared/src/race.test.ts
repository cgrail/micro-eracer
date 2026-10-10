import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DT, initPhysics } from './car.ts';
import { LAPS, RaceSim } from './race.ts';
import { TRACKS, buildTrack, lapOf, startProgress, updateProgress } from './track.ts';

test('every Track closes and its start grid sits behind the finish line', () => {
  for (const def of TRACKS) {
    const track = buildTrack(def);
    assert.ok(def.pieces.replace(/\s/g, '').endsWith('SS'), `${def.id} needs two straights for the grid`);
    assert.equal(track.checkpoints.length, def.pieces.replace(/[^SLR]/g, '').length);
  }
});

test('Laps count only when driven in order', () => {
  const track = buildTrack(TRACKS[0]);
  const p = startProgress(track, track.n - 5);
  assert.equal(lapOf(track, p), 0);
  for (let i = track.n - 4; i < track.n + 10; i++) updateProgress(track, p, track.samples[i % track.n].x, track.samples[i % track.n].z);
  assert.equal(lapOf(track, p), 1);

  // jumping straight to a far piece of the Track is a shortcut and does not count
  const before = p.u;
  const far = track.samples[Math.floor(track.n / 2)];
  updateProgress(track, p, far.x, far.z);
  assert.equal(p.u, before);
});

test('Bots finish a Race on their own', async () => {
  await initPhysics();
  const sim = new RaceSim();
  let fallOffs = 0;
  for (let t = 0; t < 240 && sim.results.length === 0; t += DT) {
    const before = sim.seats.map((s) => s.progress.u);
    sim.step(DT);
    sim.seats.forEach((s, i) => { if (s.progress.u < before[i] - 3) fallOffs++; });
  }
  assert.equal(sim.results.length, 8, 'Race should end within 4 minutes');
  console.log(`race took ${sim.time.toFixed(1)}s for ${LAPS} laps, ${fallOffs} Fall-offs`);
});
