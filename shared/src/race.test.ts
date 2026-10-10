import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DT, MAX_ENERGY, initPhysics } from './car.ts';
import { FIRST_GRID_TIME, RaceSim, STRANDED_TIME } from './race.ts';
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
    const st = sim.stats;
    console.log(`${def.id}: ${sim.time.toFixed(1)}s, ${fallOffs} Fall-offs, ${st.pickups} Batteries, ${st.airlifts} Airlifts (${st.leaderAirlifts} of the Leader), ${st.rams} Rams, ${st.hits} Hits`);
  });
}

test('either Body can win: half the field in Microbuses, half in Roadsters', async () => {
  await initPhysics();
  const wins = { microbus: 0, roadster: 0 };
  for (let k = 0; k < 12; k++) {
    const id = TRACKS[k % TRACKS.length].id, sim = new RaceSim(id);
    sim.seats.forEach((s, i) => (s.kind = (i + k) % 2 ? 'microbus' : 'roadster'));
    sim.newRace(FIRST_GRID_TIME, id);
    for (let t = 0; t < 240 && sim.results.length === 0; t += DT) sim.step(DT);
    // by now the next Race is set up; its Seats keep their names and Bodies
    wins[sim.seats.find((s) => s.name === sim.results[0])!.kind]++;
  }
  console.log('wins by Body:', wins);
  assert.ok(wins.microbus > 0 && wins.roadster > 0);
});

test('an empty E-Car is stranded, then airlifted behind the last Racer, on its Lap, with full Energy', async () => {
  await initPhysics();
  const sim = new RaceSim('kitchen');
  sim.phase = 'racing';
  for (let i = 0; i < 120; i++) sim.step(DT);
  const ranked = [...sim.seats].sort((a, b) => a.position - b.position);
  const leader = ranked[0];
  leader.energy = 0;
  sim.step(DT);
  assert.ok(sim.isStranded(leader));
  for (let t = 0; t <= STRANDED_TIME; t += DT) sim.step(DT);
  assert.ok(sim.isAirlifted(leader));
  assert.ok(leader.energy > MAX_ENERGY - 1);
  // the last Racer keeps driving while we are stranded, so check we landed behind everyone
  assert.ok(sim.seats.every((o) => o === leader || o.progress.u > leader.progress.u));
});

test('a Shield blocks the next Hit, then the Hit after it lands', async () => {
  await initPhysics();
  const sim = new RaceSim('garden');
  const [victim] = sim.seats;
  victim.shield = true;
  sim.combat.hit(victim, 'missile', 1, 0, 1);
  assert.equal(victim.energy, MAX_ENERGY);
  assert.equal(victim.shield, false);
  sim.combat.hit(victim, 'missile', 1, 0, 1);
  assert.ok(victim.energy < MAX_ENERGY);
});
