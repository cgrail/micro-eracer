import { Client, type Room } from '@colyseus/sdk';
import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { RunningRace } from '../../shared/src/snapshot.ts';
import { SEATS } from '../../shared/src/race.ts';
import { TRACKS } from '../../shared/src/track.ts';
import { PROTOCOL, compatible, protocolOf } from '../../shared/src/version.ts';

// Players must meet online: whatever Track each of them has up, they race in the one Race that is running, and only the
// first Player picks its Track. Each visit starts on a Track at random, so a room that matched joins on their Tracks once
// left nearly everyone racing the Bots alone. This runs the server as production does (`node --import tsx`, the rooms
// of index.ts) on a free port, and joins it as the browsers and apps do.

let server: ChildProcess, url = '';
const rooms: Room[] = [];

before(async () => {
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = (probe.address() as { port: number }).port;
  probe.close();
  // the first Race's Track is the first Player's, not one set for working on a Track
  const { TRACK: _track, ...env } = process.env;
  server = spawn(process.execPath, ['--import', 'tsx', 'server/src/index.ts'], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)), env: { ...env, PORT: String(port), HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise<void>((up, fail) => {
    const timer = setTimeout(() => fail(new Error('the server did not start')), 20000);
    server.stdout!.on('data', (d: Buffer) => { if (d.includes('Micro E-Racer server on')) { clearTimeout(timer); up(); } });
    server.on('exit', (code) => fail(new Error(`the server stopped (${code})`)));
  });
  url = `http://127.0.0.1:${port}`;
});

after(async () => {
  await leaveAll();
  server.kill();
  if (server.exitCode === null) await once(server, 'exit');
});

/** Joins as the start screen does: `track` is the Track the Player has up (none for Any Track). */
async function join(name: string, options: Record<string, unknown> = {}) {
  const room = await new Client(url).joinOrCreate('race2', { name, body: 'roadster', protocol: PROTOCOL, ...options });
  room.onMessage('events', () => {});
  rooms.push(room);
  return room;
}

async function leaveAll() {
  await Promise.all(rooms.splice(0).map((r) => r.leave()));
  await until(async () => !(await race()).track);
}

/** What the start screen is told: the Race a join would take, or `{}`. */
const race = async (): Promise<Partial<RunningRace>> => (await fetch(`${url}/race`)).json();

async function until(ok: () => Promise<boolean>, ms = 5000) {
  for (const end = Date.now() + ms; !(await ok());) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 50));
  }
}

test('the Tracks these Players pick are real ones', () => {
  // an unknown id would start a Race on a Track at random, and the tests below would pass by chance or fail for nothing
  for (const id of ['garden', 'kitchen', 'desk', 'bathtub', 'paris-eiffel']) assert.ok(TRACKS.some((t) => t.id === id), id);
});

test('with nobody racing, the start screen offers the picker', async () => {
  assert.deepEqual(await race(), {});
});

test('Players who have different Tracks up race in the same Race, on the first Player\'s Track', async () => {
  const ann = await join('Ann', { track: 'garden' });
  const others = [await join('Bob', { track: 'kitchen' }), await join('Kim'), await join('Lou', { track: 'paris-eiffel' })];
  // an app from before the version check sends no protocol, and the server still races with it
  if (compatible(protocolOf(undefined))) others.push(await join('Old', { track: 'bathtub', protocol: undefined }));
  for (const room of others) assert.equal(room.roomId, ann.roomId, 'everyone joins the Race that is running');
  const now = await race();
  assert.equal(now.track?.id, 'garden');
  assert.deepEqual([...now.players!].sort(), ['Ann', 'Bob', 'Kim', 'Lou', ...others.length > 3 ? ['Old'] : []].sort());
  await leaveAll();
});

test('the start screen sees each Player come and go', async () => {
  await join('Ann', { track: 'desk' });
  await until(async () => (await race()).players?.length === 1);
  const bob = await join('Bob', { track: 'garden' });
  assert.deepEqual((await race()).players?.sort(), ['Ann', 'Bob']);
  await bob.leave();
  rooms.splice(rooms.indexOf(bob), 1);
  await until(async () => (await race()).players?.join() === 'Ann');
  assert.equal((await race()).track?.id, 'desk');
  await leaveAll();
});

test('once everyone has left, the next Player picks the Track again', async () => {
  await join('Ann', { track: 'garden' });
  await leaveAll();
  await join('Bob', { track: 'kitchen' });
  assert.deepEqual(await race().then((r) => [r.track?.id, r.players]), ['kitchen', ['Bob']]);
  await leaveAll();
});

test('a full Race leaves the next Player to start another, on their own pick', async () => {
  const full: Room[] = [];
  for (let i = 0; i < SEATS; i++) full.push(await join(`P${i}`, { track: 'garden' }));
  assert.equal(new Set(full.map((r) => r.roomId)).size, 1, `${SEATS} Players fill one Race`);
  const next = await join('Next', { track: 'kitchen' });
  assert.notEqual(next.roomId, full[0].roomId);
  // the full one has no Seat to offer, so the start screen shows the new one
  assert.deepEqual(await race().then((r) => [r.track?.id, r.players]), ['kitchen', ['Next']]);
  await leaveAll();
});
