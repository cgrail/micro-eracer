import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { TILE, TRACKS } from '../../shared/src/track.ts';
import { PROP_DATA, THEME_DATA, themesJson } from './themes/index.ts';

const CODE_THEMES = ['kitchen', 'garden', 'desk', 'bathtub'];

test('every Track has a theme, and every data theme its props', () => {
  for (const def of TRACKS) assert.ok(CODE_THEMES.includes(def.theme) || def.theme in THEME_DATA, `${def.id}: no theme ${def.theme}`);
  for (const [id, t] of Object.entries(THEME_DATA)) {
    for (const kind of [...t.props, ...t.landmarks]) assert.ok(kind in PROP_DATA, `${id}: no prop ${kind}`);
    assert.ok(t.props.length && t.landmarks.length, `${id} needs props and landmarks`);
  }
});

test('props stay inside their tile, clear of the road', () => {
  const landmarks = new Set(Object.values(THEME_DATA).flatMap((t) => t.landmarks));
  for (const [kind, { reach }] of Object.entries(PROP_DATA)) {
    // a landmark has its tile to itself; a small prop shares it and is moved about in it
    const room = landmarks.has(kind) ? TILE / 2 - 0.5 : TILE / 2 - 2;
    assert.ok(reach <= room, `${kind} reaches ${reach} m, more than ${room} m`);
  }
});

test("the apps' Themes.json is up to date with the data", () => {
  const file = readFileSync(new URL('../../ios/Shared/Resources/Themes.json', import.meta.url), 'utf8');
  assert.ok(file === themesJson(), 'client/src/themes changed: run `npx tsx ios/themes.ts`');
});
