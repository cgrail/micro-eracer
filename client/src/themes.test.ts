import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { HALF_WIDTH, TILE, TRACKS, buildTrack } from '../../shared/src/track.ts';
import { PROP_DATA, THEME_DATA, stagingOf, themesJson } from './themes/index.ts';

const CODE_THEMES = ['kitchen', 'garden', 'desk', 'bathtub'];

test('every Track has a theme, and every data theme its props', () => {
  for (const def of TRACKS) assert.ok(CODE_THEMES.includes(def.theme) || def.theme in THEME_DATA, `${def.id}: no theme ${def.theme}`);
  for (const [id, t] of Object.entries(THEME_DATA)) {
    for (const kind of [...t.props, ...t.landmarks, ...(t.big ?? []).map(([k]) => k)]) assert.ok(kind in PROP_DATA, `${id}: no prop ${kind}`);
    assert.ok(t.props.length && t.landmarks.length, `${id} needs props and landmarks`);
  }
});

test('props stay inside their tile, clear of the road', () => {
  const landmarks = new Set(Object.values(THEME_DATA).flatMap((t) => t.landmarks));
  const big = new Map(Object.values(THEME_DATA).flatMap((t) => t.big ?? []));
  for (const [kind, { reach }] of Object.entries(PROP_DATA)) {
    // a landmark has its tile (a big one its block of tiles) to itself; a small prop shares it and is moved about in it
    const room = big.has(kind) ? (big.get(kind)! * TILE) / 2 - 0.5 : landmarks.has(kind) ? TILE / 2 - 0.5 : TILE / 2 - 2;
    assert.ok(reach <= room, `${kind} reaches ${reach} m, more than ${room} m`);
  }
});

test("the apps' Themes.json is up to date with the data", () => {
  const file = readFileSync(new URL('../../ios/Shared/Resources/Themes.json', import.meta.url), 'utf8');
  assert.ok(file === themesJson(), 'client/src/themes changed: run `npx tsx ios/themes.ts`');
});

test('a river runs under a bridge on every Track of its theme, and every big landmark finds room', () => {
  for (const def of TRACKS.filter((t) => t.theme in THEME_DATA)) {
    const theme = THEME_DATA[def.theme as keyof typeof THEME_DATA], track = buildTrack(def), stage = stagingOf(track)!;
    if (theme.water) {
      assert.ok(stage.bridge && stage.river, `${def.id}: no bridge over the ${def.theme} water`);
      const { from, to } = stage.bridge!;
      // straight, and walled, so its railings are real walls
      assert.ok(track.samples.slice(from, to + 1).every((p) => !p.turn && p.walls), `${def.id}: the bridge (samples ${from} to ${to}) needs walls all along`);
    }
    for (const [kind] of theme.big ?? []) assert.ok(stage.landmarks.some((l) => l.kind === kind), `${def.id}: no room for ${kind}`);
    // nothing stands on the road
    for (const l of stage.landmarks) {
      const reach = PROP_DATA[l.kind].reach * (l.scale ?? 1);
      assert.ok(track.samples.every((p) => Math.hypot(p.x - l.x, p.z - l.z) > reach + HALF_WIDTH - 1), `${def.id}: ${l.kind} reaches the road`);
    }
  }
});
