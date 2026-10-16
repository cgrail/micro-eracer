import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BODIES, DT, MAX_ENERGY, NO_INPUT, createCar, createTrackWorld, driveCar, teleport } from './car.ts';
import { GOODIES_FROM, ZAP_SHOTS } from './combat.ts';
import { give, ramResponse, shove } from './contact.ts';
import { batteryRank } from './energy.ts';
import { FIRST_GRID_TIME, MAX_SEATS, RECHARGE_TIME, RaceSim, SEATS, type Seat, STRANDED_TIME, WINS_TIME } from './race.ts';
import {
  PIT_SPEED, RISE, TRACKS, buildTrack, gridPose, inStation, lapOf, nearestSample, poseAt, resetToCheckpoint, startProgress, updateProgress,
} from './track.ts';

/** Runs `f` with the Race's dice (`Math.random`: the grid, the Bodies, Batteries, Items) seeded, so it rolls the same every time. */
function seeded<T>(seed: number, f: () => T): T {
  const random = Math.random;
  // mulberry32
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try { return f(); } finally { Math.random = random; }
}

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

test('a jump throws an E-Car into the air', () => {
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

test('a Fall-off never puts an E-Car on top of another', () => {
  const track = buildTrack(TRACKS[0]), cp = track.checkpoints[3];
  const blocker = poseAt(track, cp);
  const pose = resetToCheckpoint(track, startProgress(track, cp + 5), [blocker]);
  assert.ok(Math.hypot(pose.x - blocker.x, pose.z - blocker.z) > 5);
  // with nobody in the way it's the Checkpoint itself
  assert.deepEqual(resetToCheckpoint(track, startProgress(track, cp + 5)), blocker);
});

test('an E-Car that ends up on another is put down beside it', () => {
  const sim = new RaceSim('kitchen');
  const [a, b, ...rest] = sim.seats;
  rest.forEach((s, i) => teleport(s.car, poseAt(sim.track, 100 + i * 15)));
  const pose = poseAt(sim.track, 30);
  teleport(a.car, pose);
  teleport(b.car, { ...pose, y: pose.y + 1 });
  for (let t = 0; t < 1.5; t += DT) sim.step(DT);
  const pa = a.car.rb.translation(), pb = b.car.rb.translation();
  assert.ok(Math.hypot(pa.x - pb.x, pa.z - pb.z) > 2.5 && Math.abs(pa.y - pb.y) < 0.5, `still stacked: ${pb.y - pa.y} m apart in height`);
});

test('a side Ram shoves the victim away, harder from a heavier rammer, and makes it skid; a lighter one barely moves it', () => {
  const track = buildTrack(TRACKS[0]), world = createTrackWorld(track), at = poseAt(track, 40);
  const car = (kind: 'roadster' | 'microbus' | 'semi', lateral: number) => createCar(world, kind, poseAt(track, 40, lateral), true);
  const victim = car('roadster', 0), n = { x: -Math.cos(at.yaw), z: Math.sin(at.yaw) }; // from the rammer on its left, across it
  const even = ramResponse(car('roadster', 3), victim, n, 10), heavy = ramResponse(car('semi', 3), victim, n, 10);
  assert.ok(Math.abs(even.kick - 6.5) < 0.01 && Math.abs(even.keep - 3.5) < 0.01, 'equal weights share the speed, with a bounce');
  assert.ok(heavy.kick > 9 && heavy.keep > even.keep);
  shove(victim, n.x * even.kick, n.z * even.kick, 0, give('roadster', 'roadster'));
  const v = victim.rb.linvel();
  assert.ok(Math.hypot(v.x, v.z) > 6 && victim.slide > 0);
  // a Roadster flat out into a Semi or a Microbus hardly shoves it, nor sets it skidding
  for (const kind of ['semi', 'microbus'] as const) {
    const big = car(kind, 0), { kick } = ramResponse(car('roadster', 3), big, n, 22);
    shove(big, n.x * kick, n.z * kick, 0, give('roadster', kind));
    assert.ok(kick < 2 && big.slide < 0.15, `${kind}: shoved ${kick.toFixed(1)} m/s, skidding ${big.slide.toFixed(2)} s`);
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

/** Batteries picked up by Position, over the Races below on every Track. */
const byPosition = Array(8).fill(0);
for (const def of TRACKS) {
  test(`Bots finish a Race on their own: ${def.name}`, () => {
    const sim = new RaceSim(def.id), emit = sim.emit;
    sim.emit = (e) => { if (e.t === 'battery') byPosition[sim.seats[e.s].position - 1]++; emit(e); };
    let fallOffs = 0;
    for (let t = 0; t < 240 && sim.results.length === 0; t += DT) {
      const before = sim.seats.map((s) => s.progress.u);
      sim.step(DT);
      sim.seats.forEach((s, i) => { if (s.progress.u < before[i] - 3) fallOffs++; });
    }
    assert.equal(sim.results.length, 8, 'Race should end within 4 minutes');
    assert.ok(sim.finishers >= 1 && sim.finishers <= 8, 'the results should count who finished');
    assert.ok(sim.stats.pickups > 0, 'Bots should pick up Batteries');
    const st = sim.stats;
    console.log(`${def.id}: ${sim.time.toFixed(1)}s, ${sim.finishers} finished, ${fallOffs} Fall-offs, ${st.pickups} Batteries, ${st.recharges} Recharges (${st.leaderRecharges} of the Leader), ${st.rams} Rams, ${st.hits} Hits`);
  });
}

test('Batteries are plentiful at the back and scarce at the front', () => {
  // counted in the Races on every Track above
  const front = byPosition[0] + byPosition[1], back = byPosition.slice(4).reduce((a, b) => a + b);
  assert.ok(back > 2 * front, `Batteries by Position: ${byPosition}`);
  assert.equal(byPosition[0], 0, 'the Leader never picks up a Battery');
});

test('a Race goes on to another Track from its pool at random, none of the last 10 raced', () => {
  const sim = new RaceSim(undefined, ['kitchen', 'garden']);
  assert.ok(['kitchen', 'garden'].includes(sim.track.def.id));
  for (let i = 0; i < 4; i++) {
    const was = sim.track.def.id;
    sim.newRace(FIRST_GRID_TIME);
    assert.ok(['kitchen', 'garden'].includes(sim.track.def.id) && sim.track.def.id !== was, `${was} then ${sim.track.def.id}`);
  }
  const picked = new RaceSim(TRACKS[0].id), raced = [picked.track.def.id];
  for (let i = 0; i < 200; i++) {
    picked.newRace(FIRST_GRID_TIME);
    assert.ok(!raced.slice(-10).includes(picked.track.def.id), `${picked.track.def.id} again after ${raced.slice(-10)}`);
    raced.push(picked.track.def.id);
  }
  // after a picked Track, not the next one in the list every time
  const seconds = new Set(Array.from({ length: 10 }, () => { const s = new RaceSim(TRACKS[0].id); s.newRace(FIRST_GRID_TIME); return s.track.def.id; }));
  assert.ok(seconds.size > 1, `always ${[...seconds]} after ${TRACKS[0].id}`);
});

// the slowest Body against the quickest: if the Semi can beat Roadsters, the Bodies in between can too
test('the winner of each Race goes on the tally, and comes off it 20 minutes later', () => {
  const sim = new RaceSim(TRACKS[0].id);
  const race = () => { sim.results = []; for (let t = 0; t < 240 && sim.results.length === 0; t += DT) sim.step(DT); return sim.results[0]; };
  const first = race();
  assert.deepEqual(sim.wins.map((w) => w.name), [first]);
  const second = race();
  assert.deepEqual(sim.wins.map((w) => w.name), [first, second]);
  sim.wins[0].at -= WINS_TIME;
  const third = race();
  assert.deepEqual(sim.wins.map((w) => w.name), [second, third], 'the win from 20 minutes ago is off the tally');
});

test('every Body can win: half the field in Semis, half in Roadsters', () => {
  const wins: Record<string, number> = { semi: 0, roadster: 0 };
  // the Semi wins about 30% of these, so 20 Races leave it no win less than once in a thousand runs
  for (let k = 0; k < 20; k++) {
    const id = TRACKS[k % TRACKS.length].id, sim = new RaceSim(id);
    sim.seats.forEach((s, i) => (s.kind = (i + k) % 2 ? 'semi' : 'roadster'));
    sim.newRace(FIRST_GRID_TIME, id);
    for (let t = 0; t < 240 && sim.results.length === 0; t += DT) sim.step(DT);
    // by now the next Race is set up; its Seats keep their names and Bodies
    wins[sim.seats.find((s) => s.name === sim.results[0])!.kind]++;
  }
  console.log('wins by Body:', wins);
  assert.ok(wins.semi > 0 && wins.roadster > 0);
});

test('an empty E-Car is Stranded, then Recharged where it stands to full Energy', () => {
  const sim = new RaceSim('kitchen');
  sim.phase = 'racing';
  for (let i = 0; i < 120; i++) sim.step(DT);
  const leader = sim.seats.find((s) => s.position === 1)!;
  // alone, so no Ram gives it Energy back, takes some away or shoves it along: the others are parked far away
  sim.seats.forEach((s, i) => { if (s !== leader) { teleport(s.car, poseAt(sim.track, 120 + i * 15)); s.lockedUntil = Infinity; } });
  leader.energy = 0;
  sim.step(DT);
  assert.ok(sim.isStranded(leader));
  const at = { ...leader.progress };
  for (let t = 0; t <= STRANDED_TIME; t += DT) sim.step(DT);
  assert.ok(sim.isRecharging(leader));
  assert.ok(leader.energy < MAX_ENERGY / 2, 'the battery fills up during the Recharge');
  // at least RECHARGE_TIME; a Leader waits on the drone until the Racers behind could get past
  for (let t = 0; t < 10 && sim.isRecharging(leader); t += DT) sim.step(DT);
  assert.ok(!sim.isRecharging(leader) && leader.energy > MAX_ENERGY - 1);
  // no trip to the back and no reversing: it brakes to a halt just past where it ran dry
  const moved = leader.progress.u - at.u;
  assert.ok(moved >= 0 && moved < 12, `moved ${moved} samples`);
});

test('a Bot low on Energy pulls into the Charging Station, is stuck to its speed limit there and leaves charged', () => {
  const sim = new RaceSim('desk');
  sim.phase = 'racing';
  const { n } = sim.track, [bot, ...others] = sim.seats;
  // alone on the last straights, with a fifth of a battery left; the others parked, or they lap round into the bay and bump it
  const park = () => others.forEach((s, i) => teleport(s.car, poseAt(sim.track, 60 + i * 15)));
  park();
  const pose = poseAt(sim.track, n - 50);
  teleport(bot.car, pose, Math.sin(pose.yaw) * 15, Math.cos(pose.yaw) * 15);
  bot.progress = startProgress(sim.track, n - 50);
  bot.energy = 20;
  let inBay = 0, fastest = 0;
  for (let t = 0; t < 10 && bot.progress.u < 0; t += DT) {
    sim.step(DT);
    park();
    // a Battery on the way would charge it enough to skip the station
    sim.batteries = [];
    inBay = inStation(sim.track, bot.progress.idx, bot.car.rb.translation()) ? inBay + DT : inBay;
    const v = bot.car.rb.linvel();
    // glue: half a second in, it has lost all its speed above the limit
    if (inBay > 0.5 && inStation(sim.track, bot.progress.idx, bot.car.rb.translation())) fastest = Math.max(fastest, Math.hypot(v.x, v.z));
  }
  assert.ok(inBay > 0, 'went through the bay');
  assert.ok(fastest <= BODIES[bot.kind].maxSpeed * PIT_SPEED + 0.1, `${fastest.toFixed(1)} m/s in the bay`);
  // how full depends on where along the bay it got in; it always gains a lot more than a Battery's worth of driving
  assert.ok(bot.energy > 45, `left with ${bot.energy.toFixed(0)} Energy`);
});

test('Bots keep shooting at a Player in the lead', () => {
  const sim = new RaceSim('kitchen');
  sim.phase = 'racing';
  sim.startedAt = -10;
  const player = sim.join('p', 'Player', 'roadster')!;
  const bot = sim.seats.find((s) => !s.owner)!;
  // a Bot back in the field with a big Zap
  Object.assign(bot, { item: 'zap', ammo: 50 });
  // the Player leads on the first straight with one Bot 15 m behind; the other Bots are far away
  sim.seats.forEach((s, i) => { s.position = s === player ? 1 : s === bot ? 2 : i + 3; teleport(s.car, poseAt(sim.track, s === player ? 40 : s === bot ? 25 : 150 + i * 12)); });
  let shots = 0, hits = 0;
  for (let t = 0; t < 3; t += DT) {
    sim.time += DT;
    sim.combat.botTurn(bot);
    sim.combat.step(DT);
    for (const e of sim.events) { if (e.t === 'shot' && e.s === bot.index) shots++; if (e.t === 'hit' && e.s === player.index) hits++; }
    sim.events = [];
  }
  assert.ok(shots >= 2 && hits >= 1, `${shots} Shots, ${hits} Hits`);
});

test('with a Player in the Race, Bots shoot and drop Mines for them, not for each other', () => {
  const sim = new RaceSim('kitchen');
  sim.phase = 'racing';
  sim.startedAt = -10;
  const player = sim.join('p', 'Player', 'roadster')!, [bot, other] = sim.seats.filter((s) => !s.owner);
  // `bot` on the first straight with `who` lined up 12 m ahead, or 10 m behind; everyone else far away
  const lineUp = (who: Seat, gap: number) => sim.seats.forEach((s, i) => {
    s.position = s === bot ? 2 : i + 3;
    teleport(s.car, poseAt(sim.track, s === bot ? 30 : s === who ? 30 + gap : 150 + i * 12));
    s.progress = startProgress(sim.track, s === bot ? 30 : s === who ? 30 + gap : 150 + i * 12);
  });
  const shoots = (who: Seat) => {
    lineUp(who, 12);
    Object.assign(bot, { item: 'zap', ammo: 5, nextShotAt: 0 });
    sim.events = [];
    for (let i = 0; i < 20; i++) { sim.time += 0.1; sim.combat.botTurn(bot); }
    return sim.events.some((e) => e.t === 'shot');
  };
  assert.ok(shoots(player) && !shoots(other));
  const drops = (who: Seat) => { lineUp(who, -10); Object.assign(bot, { item: 'mine' }); sim.combat.botTurn(bot); return !bot.item; };
  assert.ok(drops(player) && !drops(other));
});

test('a Player taking over a Bot is announced, and only Bots wear the robot', () => {
  const sim = new RaceSim('kitchen');
  const seat = sim.join('p', '🤖 Sneaky', 'roadster')!;
  assert.equal(seat.name, 'Sneaky');
  const joined = sim.events.find((e) => e.t === 'join');
  assert.ok(joined?.t === 'join' && joined.name === 'Sneaky' && joined.was.startsWith('🤖'));
  sim.leave('p');
  assert.ok(!seat.owner && seat.name.startsWith('🤖'));
  assert.ok(sim.events.some((e) => e.t === 'leave' && e.was === 'Sneaky'));
});

test('Players past the field bring Seats of their own, up to MAX_SEATS, and the next grid is back to SEATS without them', () => {
  const sim = new RaceSim('kitchen');
  for (let i = 0; i < MAX_SEATS; i++) assert.ok(sim.join(`p${i}`, `P${i}`, 'roadster'), `Player ${i + 1} gets a Seat`);
  assert.equal(sim.seats.length, MAX_SEATS);
  assert.equal(sim.join('one-more', 'Late', 'roadster'), null);
  assert.ok(sim.events.some((e) => e.t === 'join' && e.s === SEATS && e.was === ''), 'a Seat of their own is nobody\'s');
  sim.newRace(FIRST_GRID_TIME);
  assert.equal(sim.seats.length, MAX_SEATS);
  for (let i = 0; i < 15; i++) sim.leave(`p${i}`);
  sim.newRace(FIRST_GRID_TIME);
  assert.equal(sim.seats.length, SEATS);
  assert.equal(sim.seats.filter((s) => s.owner).length, 5);
  assert.deepEqual(sim.seats.map((s) => s.index), [...Array(SEATS).keys()]);
});

test('a Player who joins a running Race with no Bot left starts behind the last Racer', () => {
  const sim = new RaceSim('garden');
  for (let i = 0; i < SEATS; i++) sim.join(`p${i}`, `P${i}`, 'roadster');
  while (sim.phase === 'grid') sim.step(DT);
  const late = sim.join('late', 'Late', 'semi')!;
  sim.step(DT);
  assert.equal(late.position, SEATS + 1);
  const t = late.car.rb.translation();
  for (const s of sim.seats) if (s !== late) { const o = s.car.rb.translation(); assert.ok(Math.hypot(o.x - t.x, o.z - t.z) > 3, `clear of ${s.name}`); }
});

test('every grid slot of a full field is level road where an E-Car stands still', () => {
  for (const def of TRACKS) {
    const track = buildTrack(def), world = createTrackWorld(track);
    const cars = [...Array(MAX_SEATS).keys()].map((slot) => ({ slot, at: gridPose(track, slot), car: createCar(world, 'semi', gridPose(track, slot), true) }));
    for (let k = 0; k < 180; k++) { for (const c of cars) driveCar(world, c.car, NO_INPUT, 1, false); world.step(); }
    for (const { slot, at, car } of cars) {
      const t = car.rb.translation();
      assert.ok(Math.hypot(t.x - at.x, t.z - at.z) < 1 && t.y > at.y - 1.5, `${def.id}: slot ${slot} rolled away`);
    }
  }
});

test('Batteries reach the back of a field of MAX_SEATS as of SEATS', () => {
  const big = Array<number>(MAX_SEATS).fill(0), field = Array<number>(SEATS).fill(0);
  for (let i = 0; i < 20000; i++) { big[batteryRank(MAX_SEATS)]++; field[batteryRank(SEATS)]++; }
  const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);
  assert.ok(big[0] === 0 && field[0] === 0, 'none for the Leader');
  assert.ok(big.slice(1).every((n) => n > 0), `by Position: ${big}`);
  // about twice as many, the Leader's share having gone to those behind them
  assert.ok(sum(big.slice(MAX_SEATS / 2)) > 1.8 * sum(big.slice(0, MAX_SEATS / 2)), `by Position: ${big}`);
  assert.equal(field.length, SEATS, 'a field of SEATS only picks from it');
});

test('Item Boxes come out behind third place, go after the last Racer, only give from fourth back; a Zap holds five Shots', () => {
  const sim = new RaceSim('kitchen');
  sim.phase = 'racing';
  const at = (p: number) => sim.seats.find((o) => o.position === p)!;
  const s = at(GOODIES_FROM), box = sim.track.itemBoxes[0];
  const passed = (upTo: number) => sim.seats.forEach((o) => { if (o.position <= upTo) o.progress.u = box.idx + 1; });
  const atBox = () => { teleport(s.car, { ...box, y: box.y - 0.15 }); sim.combat.step(DT); };
  atBox();
  assert.ok(!sim.combat.out[0] && s.item === '', 'not out before third place has passed it');
  passed(GOODIES_FROM - 1);
  atBox();
  assert.notEqual(s.item, '');
  assert.ok(!sim.combat.out[0], 'taken');
  Object.assign(s, { item: '', position: GOODIES_FROM - 1 });
  sim.time += 5;
  atBox();
  assert.ok(sim.combat.out[0] && s.item === '', 'back, but the top three get nothing');
  passed(sim.seats.length);
  sim.combat.step(DT);
  assert.ok(!sim.combat.out[0], 'gone once the last Racer has passed it');
  Object.assign(s, { item: 'zap', ammo: ZAP_SHOTS });
  let shots = 0;
  for (let i = 0; i < 20; i++) { sim.time += 0.4; sim.combat.useItem(s); shots += sim.events.filter((e) => e.t === 'shot').length; sim.events = []; }
  assert.equal(shots, ZAP_SHOTS);
  assert.equal(s.item, '');
});

test('a Leader who runs dry stays on the drone until three Racers have got past', () => seeded(1, () => {
  // seeded: the drone's time is a guess from the gaps behind, and in the pack just after GO the Racers behind now and then
  // Ram the halted Leader along ahead of them, so on some grids (about one in thirty) it came back in P3
  const sim = new RaceSim('kitchen');
  sim.phase = 'racing';
  for (let i = 0; i < 240; i++) sim.step(DT);
  const leader = sim.seats.find((s) => s.position === 1)!;
  leader.energy = 0;
  sim.step(DT);
  while (sim.isStranded(leader) || sim.isRecharging(leader)) sim.step(DT);
  assert.ok(leader.position >= 4, `back in P${leader.position} after its Recharge`);
}));

test('the front three are held together: the Leader slowed, second towed', () => {
  const sim = new RaceSim('kitchen');
  sim.phase = 'racing';
  // first 5 m ahead of second, second 15 m ahead of third, the rest further back
  sim.seats.forEach((s, i) => (s.progress = startProgress(sim.track, [60, 55, 40][i] ?? 10 - i)));
  sim.step(DT);
  const [first, second, third, fourth] = [1, 2, 3, 4].map((p) => sim.seats.find((s) => s.position === p)!);
  assert.ok(first.pace < 1, 'even a small lead slows the Leader a little');
  assert.ok(third.pace > 1, 'third gets a tow once second pulls away');
  assert.ok(second.pace < 1 && fourth.pace === 1);
  // far ahead, the Leader is slowed a lot
  first.progress.u += 60;
  sim.step(DT);
  assert.ok(first.pace < 0.8);
});

test('a Shield blocks the next Hit, then the Hit after it lands', () => {
  const sim = new RaceSim('garden');
  const [victim] = sim.seats;
  victim.shield = true;
  sim.combat.hit(victim, 'missile', 1, 0, 1);
  assert.equal(victim.energy, MAX_ENERGY);
  assert.equal(victim.shield, false);
  sim.combat.hit(victim, 'missile', 1, 0, 1);
  assert.ok(victim.energy < MAX_ENERGY);
});
