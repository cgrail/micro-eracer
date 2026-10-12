import { type Theme, type Track, TRACKS, buildTrack } from '../../../shared/src/track.ts';
import { type PropData, type ThemeData, reach } from './kit.ts';
import * as offices from './offices.ts';
import * as europe from './europe.ts';
import * as india from './india.ts';
import * as rhineNeckar from './rhine-neckar.ts';
import * as sports from './sports.ts';
import { type Staging, staging } from './staging.ts';
import * as usa from './usa.ts';

// Every theme beyond the first four, as data: what props.ts builds in the browser and ios/themes.ts writes for the apps.

export type DataTheme = Exclude<Theme, 'kitchen' | 'garden' | 'desk' | 'bathtub'>;

export const THEME_DATA = { ...offices.themes, ...rhineNeckar.themes, ...sports.themes, ...europe.themes, ...usa.themes, ...india.themes } as Record<DataTheme, ThemeData>;

const props: Record<string, PropData> = { ...offices.props, ...rhineNeckar.props, ...sports.props, ...europe.props, ...usa.props, ...india.props };

/** Every data prop with how far it reaches from its middle. */
export const PROP_DATA: Record<string, { prop: PropData; reach: number }> = Object.fromEntries(Object.entries(props).map(([k, prop]) => [k, { prop, reach: reach(prop) }]));

const staged = new Map<string, Staging>();
/** A Track's river, bridge and landmarks, if its theme is data (staging.ts). */
export function stagingOf(track: Track): Staging | undefined {
  const theme = THEME_DATA[track.def.theme as DataTheme];
  if (!theme) return undefined;
  if (!staged.has(track.def.id)) staged.set(track.def.id, staging(track, theme));
  return staged.get(track.def.id);
}

/** What ios/Shared/Resources/Themes.json holds (`npx tsx ios/themes.ts`): every data theme and prop, and every Track's staging, one per line. */
export function themesJson() {
  const lines = (o: Record<string, unknown>) => Object.entries(o).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n');
  const withReach = Object.fromEntries(Object.entries(PROP_DATA).map(([k, { prop, reach }]) => [k, { ...prop, reach }]));
  const tracks = Object.fromEntries(TRACKS.filter((t) => t.theme in THEME_DATA).map((t) => [t.id, stagingOf(buildTrack(t))]));
  return `{\n"themes": {\n${lines(THEME_DATA)}\n},\n"props": {\n${lines(withReach)}\n},\n"tracks": {\n${lines(tracks)}\n}\n}\n`;
}
