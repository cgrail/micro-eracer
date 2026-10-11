import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { type BodyKind, type Input, HALT, NO_INPUT, createCar, createTrackWorld, driveCar, setKinematicPose, teleport } from './car.ts';
import { DT } from './physics.ts';
import { type Pose, type Track, TRACKS, buildTrack, poseAt } from './track.ts';

/**
 * How an E-Car drives and collides, as data: set-ups, and where every E-Car is after each 10 steps. The browsers and the
 * server run this TypeScript; a port (the iOS app) replays the same set-ups and has to end up in the same places. After a
 * deliberate change to the physics or the driving, `UPDATE_FIXTURE=1 npm test` writes the file anew, and the ports follow.
 */
const FIXTURE = new URL('./physics.fixture.json', import.meta.url);
const EVERY = 10, TOLERANCE = 1e-3;
const FIELDS = ['x', 'y', 'z', 'yaw', 'vx', 'vy', 'vz'];
const ABOUT = [
  'Set-ups and traces for porting shared/src/car.ts, physics.ts and collide.ts. Metres, seconds, radians; y is up, and an',
  'E-Car with yaw a faces (sin a, cos a) in x and z. Each car: createCar(body, pose, dynamic); a dynamic one starts moving at',
  '(vx, 0, vz). Each step: driveCar(input) for every dynamic car, the pose plus (vx, vz) times the time so far for every',
  'kinematic one (setKinematicPose), then world.step(). Every `every` steps the trace has [x, y, z, yaw, vx, vy, vz] per car.',
].join(' ');

interface CarSetup { body: BodyKind; dynamic: boolean; pose: Pose; vx: number; vz: number; input: Input }
interface Scenario { name: string; track: string; steps: number; cars: CarSetup[]; trace: number[][][] }

const trackOf = (id: string) => buildTrack(TRACKS.find((t) => t.id === id)!);
const car = (body: BodyKind, pose: Pose, speed = 0, input: Input = NO_INPUT, dynamic = true): CarSetup =>
  ({ body, dynamic, pose, vx: Math.sin(pose.yaw) * speed, vz: Math.cos(pose.yaw) * speed, input });
const turned = (pose: Pose, by: number) => ({ ...pose, yaw: pose.yaw + by });
/** On flat road `metres` before sample `i`, facing along the Track there. */
const before = (track: Track, i: number, metres: number): Pose => {
  const s = track.samples[i];
  return { x: s.x - s.dx * metres, y: s.y + 0.6, z: s.z - s.dz * metres, yaw: Math.atan2(s.dx, s.dz) };
};

/** What the fixture covers: driving, ramps, the jump, walls, Rams between all kinds of bodies, a roof, a slope, an edge. */
function setUps(): Omit<Scenario, 'trace'>[] {
  const kitchen = trackOf('kitchen'), desk = trackOf('desk'), garden = trackOf('garden');
  const full = { throttle: 1, steer: 0 }, kick = desk.samples.findIndex((s) => s.kick), side = poseAt(kitchen, 31, -3.6);
  return [
    { name: 'pulls away', track: 'kitchen', steps: 120, cars: [car('roadster', poseAt(kitchen, 2), 0, full)] },
    { name: 'steers into a Drift', track: 'kitchen', steps: 90, cars: [car('suv', poseAt(kitchen, 2), 20, { throttle: 1, steer: 1 })] },
    { name: 'climbs a ramp', track: 'kitchen', steps: 90, cars: [car('semi', before(kitchen, kitchen.checkpoints[4], 8), 15, full)] },
    { name: 'flies off the jump', track: 'desk', steps: 120, cars: [car('roadster', poseAt(desk, kick - 12), 20, full)] },
    { name: 'scrapes along a wall', track: 'garden', steps: 120, cars: [car('roadster', turned(poseAt(garden, garden.checkpoints[9]), -0.35), 18, full)] },
    { name: 'rams from behind', track: 'kitchen', steps: 60, cars: [car('pickup', poseAt(kitchen, 30)), car('roadster', poseAt(kitchen, 24), 15)] },
    { name: 'rams a side near the nose', track: 'kitchen', steps: 60, cars: [car('roadster', poseAt(kitchen, 30)), car('semi', turned(side, Math.PI / 2), 12)] },
    {
      name: 'drives into a kinematic E-Car', track: 'kitchen', steps: 60,
      cars: [car('semi', poseAt(kitchen, 30), 0, NO_INPUT, false), car('microbus', poseAt(kitchen, 24), 15)],
    },
    {
      name: 'is pushed by a kinematic E-Car', track: 'kitchen', steps: 60,
      cars: [car('semi', poseAt(kitchen, 20), 10, NO_INPUT, false), car('roadster', poseAt(kitchen, 28))],
    },
    { name: 'drops onto a roof', track: 'kitchen', steps: 60, cars: [car('roadster', poseAt(kitchen, 30)), car('roadster', { ...poseAt(kitchen, 30), y: poseAt(kitchen, 30).y + 1.5 })] },
    { name: 'held on a ramp', track: 'kitchen', steps: 120, cars: [car('roadster', poseAt(kitchen, kitchen.checkpoints[4] + 8), 0, HALT)] },
    { name: 'goes off the edge', track: 'kitchen', steps: 90, cars: [car('roadster', turned(poseAt(kitchen, 10), -0.52), 12)] },
  ];
}

function run(s: Omit<Scenario, 'trace'>): number[][][] {
  const track = trackOf(s.track), world = createTrackWorld(track), trace: number[][][] = [];
  const cars = s.cars.map((c) => { const it = createCar(world, c.body, c.pose, c.dynamic); if (c.dynamic) teleport(it, c.pose, c.vx, c.vz); return it; });
  for (let step = 1; step <= s.steps; step++) {
    cars.forEach((it, k) => {
      const c = s.cars[k];
      if (c.dynamic) driveCar(world, it, c.input);
      else setKinematicPose(it, { ...c.pose, x: c.pose.x + c.vx * step * DT, z: c.pose.z + c.vz * step * DT });
    });
    world.step();
    if (step % EVERY === 0) trace.push(cars.map(({ rb }) => [rb.x, rb.y, rb.z, rb.yaw, rb.vx, rb.vy, rb.vz].map((v) => Math.round(v * 1e4) / 1e4)));
  }
  return trace;
}

/** One line per trace row, so a change shows up as a readable diff. */
function write(scenarios: Scenario[]) {
  const list = scenarios.map((s) => [
    `    {\n      "name": ${JSON.stringify(s.name)}, "track": ${JSON.stringify(s.track)}, "steps": ${s.steps},`,
    `      "cars": [\n${s.cars.map((c) => `        ${JSON.stringify(c)}`).join(',\n')}\n      ],`,
    `      "trace": [\n${s.trace.map((row) => `        ${JSON.stringify(row)}`).join(',\n')}\n      ]\n    }`,
  ].join('\n'));
  const fields = JSON.stringify(FIELDS);
  writeFileSync(FIXTURE, `{\n  "about": ${JSON.stringify(ABOUT)},\n  "dt": ${DT}, "every": ${EVERY}, "fields": ${fields},\n  "scenarios": [\n${list.join(',\n')}\n  ]\n}\n`);
}

test('the physics still drives its fixture the same way, as a port has to', () => {
  if (process.env.UPDATE_FIXTURE) write(setUps().map((s) => ({ ...s, trace: run(s) })));
  const { scenarios } = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { scenarios: Scenario[] };
  assert.equal(scenarios.length, setUps().length, 'the fixture is out of date: UPDATE_FIXTURE=1 npm test');
  for (const s of scenarios) {
    const trace = run(s);
    s.trace.forEach((row, i) => row.forEach((values, k) => values.forEach((want, j) => {
      const got = trace[i][k][j], off = j === 3 ? Math.abs(Math.atan2(Math.sin(got - want), Math.cos(got - want))) : Math.abs(got - want);
      assert.ok(off <= TOLERANCE, `${s.name}: car ${k} after ${(i + 1) * EVERY} steps has ${FIELDS[j]} ${got}, the fixture ${want}`);
    })));
  }
});
