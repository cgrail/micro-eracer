import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BODIES, BODY_KINDS, DT, HALF, createCar, createTrackWorld, driveCar } from '../../shared/src/car.ts';
import { roadAt } from '../../shared/src/collide.ts';
import { TRACKS, buildTrack, nearestSample, poseAt, right, startProgress, updateProgress } from '../../shared/src/track.ts';
import { type CarView, glide, place } from './motion.ts';

test('a model never sinks into the road, over the top of a climb or at the foot of a descent, in any browser', () => {
  for (const def of TRACKS.filter((t) => /[UD]/.test(t.pieces))) {
    const track = buildTrack(def);
    for (const kind of BODY_KINDS) for (const mine of [true, false]) {
      const world = createTrackWorld(track), car = createCar(world, kind, poseAt(track, 0), true), progress = startProgress(track, 0);
      const drawn = { y: 0, pitch: 0 };
      const view = {
        kind, tilt: 0, roadY: 0, mine, target: { ...poseAt(track, 0), vx: 0, vz: 0, at: 0 }, shown: poseAt(track, 0),
        mesh: { position: { set: (_x: number, y: number) => (drawn.y = y) }, rotation: { set: (x: number) => (drawn.pitch = -x) } },
      } as unknown as CarView;
      let sunk = 0;
      for (let step = 0; step < 60 * 40 && progress.u < 0; step++) {
        // along the middle of the road, flat out
        const rb = car.rb, t = rb.translation(), fx = Math.sin(rb.yaw), fz = Math.cos(rb.yaw), r = right(fx, fz);
        const to = poseAt(track, progress.idx + 8), tx = to.x - t.x, tz = to.z - t.z;
        driveCar(world, car, { throttle: 1, steer: Math.max(-1, Math.min(1, 2.2 * Math.atan2(tx * r.x + tz * r.z, tx * fx + tz * fz))) });
        world.step();
        const body = rb.translation(), v = rb.linvel();
        updateProgress(track, progress, body.x, body.z);
        // another browser hears where it is 30 times a second and glides it there
        if (step % 2 === 0) Object.assign(view.target, { ...body, yaw: rb.yaw, vx: v.x, vz: v.z, at: performance.now() });
        if (!mine) glide([view], DT);
        const p = mine ? body : view.shown, yaw = mine ? rb.yaw : view.shown.yaw;
        place(view, track, mine ? progress.idx : nearestSample(track, p.x, p.y, p.z), p, yaw, DT);
        for (const k of [-1, -0.5, 0, 0.5, 1]) {
          const a = k * BODIES[kind].length, flat = Math.cos(drawn.pitch) * a;
          const road = roadAt(track, rb.idx, p.x + Math.sin(yaw) * flat, p.z + Math.cos(yaw) * flat);
          if (road) sunk = Math.max(sunk, road.y - (drawn.y + Math.sin(drawn.pitch) * a - Math.cos(drawn.pitch) * HALF.y));
        }
      }
      assert.ok(progress.u >= 0, `${kind} didn't get round ${def.id}`);
      assert.ok(sunk < 0.05, `${kind}'s model sank ${sunk.toFixed(2)} m into the road on ${def.id}${mine ? '' : ', seen from another browser'}`);
    }
  }
});
