# Our own physics instead of Rapier

The E-Cars use our own physics (`shared/src/physics.ts` and `collide.ts`, about 300 lines) instead of the Rapier engine. Rapier's WASM was 3 MB, 1.2 MB of the game's 1.4 MB download (gzipped), and the game used little of it. The driving is arcade: `driveCar` sets each E-Car's speed and turning every step, bodies only turn about the vertical axis, nothing has friction, and Rams, Hits and getting off another E-Car's roof are worked out by hand. What was left for the physics fits in a small module: gravity, the road (a ribbon along the Track's samples), walls, and boxes bumping into each other. Plain arithmetic also ports to Swift for a native iOS app, which a WASM engine would not.

We compared the two before switching. Over 30 Bot Races per Track, Fall-offs and Rams come out the same within the noise (24.1 Fall-offs against 24.7 in total), as do Race times, Batteries and Recharges. Single moves agree too: pulling away, the jump (2.4 m high, 0.53 s in the air, against 2.5 m and 0.55 s), sliding along a wall, Rams between all kinds of Bodies, E-Cars bouncing off kinematic ones, resting on a roof, and reversing into the drop after a jump. A step for 8 Bots takes a quarter of the time Rapier needed.

## Considered Options

- **Keep Rapier, or an older and smaller version of it**: rejected. It is still about 1 MB of WASM, and it has no Swift version: a port would mean wrapping its Rust code ourselves.
- **Bounce** (a 3D engine in plain TypeScript, 73 kB gzipped): rejected. It can't lock rotations to the vertical axis, so we would have had to level the E-Cars every step ourselves. It only exists in TypeScript, so an iOS port would need a different engine that drives differently.
- **cannon-es**: rejected. It can't collide a box with a triangle mesh, so the road would have had to become hundreds of boxes.
- **A 2D engine (planck.js)** with our own heights: rejected. Heights, ramps, jumps and bridges would still have been ours to write, which is most of the work.

## Consequences

- Climbing a ramp at full throttle is about 10% quicker than it was. Rapier's E-Cars dug their front edge into the slope and lost speed getting pushed back out.
- A wall only pushes straight out of its face towards the road. A body is a sharp-cornered box (Rapier's had rounded edges). There is no protection against moving through something in one step. At 60 steps a second nothing is fast enough to pass through a wall or another E-Car.
- New kinds of obstacles (posts, loose objects, a different road shape) need their own code in `collide.ts`.
- `shared/src/physics.fixture.json` is how a port checks that it drives the same: set-ups and where each E-Car is after every 10 steps, replayed by `npm test`. A deliberate change to the physics or to `driveCar` means running `UPDATE_FIXTURE=1 npm test`, and the ports have to follow.
