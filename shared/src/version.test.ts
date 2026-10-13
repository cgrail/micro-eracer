import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIN_PROTOCOL, PROTOCOL, compatible, protocolOf } from './version.ts';

test('a client that sends no version is an app from before the check, and the server races with its own build', () => {
  assert.equal(protocolOf(undefined), 1);
  assert.equal(protocolOf(3), 3);
  // `/version?protocol=2` brings it as text
  assert.equal(protocolOf('2'), 2);
  for (const junk of [0, -1, 1.5, NaN, Infinity, '2x', '', '0', null, {}, [2]]) assert.equal(protocolOf(junk), 1, String(junk));
  assert.ok(MIN_PROTOCOL <= PROTOCOL, 'the server must race with clients of its own build');
  assert.ok(compatible(PROTOCOL));
  assert.equal(compatible(MIN_PROTOCOL - 1), false);
});
