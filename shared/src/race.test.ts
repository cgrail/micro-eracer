import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DT, MAX_ENERGY, initPhysics } from './car.ts';
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

for (const def of TRACKS) {
  test(`Bots finish a Race on their own: ${def.name}`, async () => {
    await initPhysics();
    const sim = new RaceSim(def.id);
    let fallOffs = 0;
    for (let t = 0; t < 240 && sim.results.length === 0; t += DT) {
      const before = sim.seats.map((s) => s.progress.u);
      sim.step(DT);
      sim.seats.forEach((s, i) => { if (s.progress.u < before[i] - 3 && !sim.isAirlifted(s)) fallOffs++; });
    }
    assert.equal(sim.results.length, 8, 'Race should end within 4 minutes');
    assert.ok(sim.stats.pickups > 0, 'Bots should pick up Batteries');
    console.log(`${def.id}: ${sim.time.toFixed(1)}s, ${fallOffs} Fall-offs, ${sim.stats.pickups} Batteries, ${sim.stats.airlifts} Airlifts, ${sim.stats.rams} Rams`);
  });
}

test('Airlift puts an empty E-Car behind the last Racer, on its Lap, with full Energy', async () => {
  await initPhysics();
  const sim = new RaceSim('kitchen');
  sim.phase = 'racing';
  for (let i = 0; i < 120; i++) sim.step(DT);
  const ranked = [...sim.seats].sort((a, b) => a.position - b.position);
  const [leader, last] = [ranked[0], ranked[ranked.length - 1]];
  leader.energy = 0;
  sim.step(DT);
  assert.equal(leader.energy, MAX_ENERGY);
  assert.equal(leader.progress.u, last.progress.u - 6);
  assert.ok(sim.isAirlifted(leader));
});
