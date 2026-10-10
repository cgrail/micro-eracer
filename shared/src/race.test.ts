import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DT, MAX_ENERGY, createCar, createTrackWorld, driveCar, initPhysics, teleport } from './car.ts';
import { FIRST_GRID_TIME, RECHARGE_TIME, RaceSim, STRANDED_TIME } from './race.ts';
import { RISE, TRACKS, buildTrack, lapOf, nearestSample, poseAt, startProgress, updateProgress } from './track.ts';

test('every Track closes and its start grid sits behind the finish line', () => {
  for (const def of TRACKS) {
    const track = buildTrack(def);
    assert.ok(def.pieces.replace(/\s/g, '').endsWith('SS'), `${def.id} needs two straights for the grid`);
    assert.equal(track.checkpoints.length, def.pieces.replace(/[^SLRUDJ]/g, '').length);
  }
});

test('a Track may cross itself only over a bridge', () => {
  // the garden's figure of eight: up, over the start straight, and down again
  const garden = buildTrack(TRACKS.find((t) => t.id === 'garden')!);
  const under = garden.samples[40], over = nearestSample(garden, under.x, under.y + RISE + 0.5, under.z);
  assert.ok(garden.samples[over].y > under.y + RISE - 0.1, 'the bridge is above the road it crosses');
  assert.equal(nearestSample(garden, under.x, under.y + 0.5, under.z), 40);
  // the same loop on one level would be a shortcut
  assert.throws(() => buildTrack({ ...garden.def, pieces: garden.def.pieces.replace('U*', 'S*').replace('D*', 'S*') }), /runs into itself/);
});

test('a jump throws an E-Car into the air', async () => {
  await initPhysics();
  const track = buildTrack(TRACKS.find((t) => t.id === 'desk')!);
  const world = createTrackWorld(track), kick = track.samples.findIndex((s) => s.kick);
  const pose = poseAt(track, kick - 12), car = createCar(world, 'roadster', pose, true);
  teleport(car, pose, Math.sin(pose.yaw) * 20, Math.cos(pose.yaw) * 20);
  let air = 0;
  for (let i = 0; i < 90; i++) {
    driveCar(world, car, { throttle: 1, steer: 0 });
    world.step();
    const t = car.rb.translation();
    air = Math.max(air, t.y - track.samples[nearestSample(track, t.x, t.y, t.z)].y);
  }
  assert.ok(air > 1.5, `flew only ${air.toFixed(2)} m above the road`);
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
      sim.seats.forEach((s, i) => { if (s.progress.u < before[i] - 3) fallOffs++; });
    }
    assert.equal(sim.results.length, 8, 'Race should end within 4 minutes');
    assert.ok(sim.stats.pickups > 0, 'Bots should pick up Batteries');
    const st = sim.stats;
    console.log(`${def.id}: ${sim.time.toFixed(1)}s, ${fallOffs} Fall-offs, ${st.pickups} Batteries, ${st.recharges} Recharges (${st.leaderRecharges} of the Leader), ${st.rams} Rams, ${st.hits} Hits`);
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

test('an empty E-Car is Stranded, then Recharged where it stands to full Energy', async () => {
  await initPhysics();
  const sim = new RaceSim('kitchen');
  sim.phase = 'racing';
  for (let i = 0; i < 120; i++) sim.step(DT);
  const leader = sim.seats.find((s) => s.position === 1)!;
  leader.energy = 0;
  sim.step(DT);
  assert.ok(sim.isStranded(leader));
  const at = { ...leader.progress };
  for (let t = 0; t <= STRANDED_TIME; t += DT) sim.step(DT);
  assert.ok(sim.isRecharging(leader));
  assert.ok(leader.energy < MAX_ENERGY / 2, 'the battery fills up during the Recharge');
  for (let t = 0; t <= RECHARGE_TIME; t += DT) sim.step(DT);
  assert.ok(!sim.isRecharging(leader) && leader.energy > MAX_ENERGY - 1);
  // no trip to the back and no reversing; it brakes to a halt, though the pack behind may Ram it along a bit
  const moved = leader.progress.u - at.u;
  assert.ok(moved >= 0 && moved < 60, `moved ${moved} samples`);
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
