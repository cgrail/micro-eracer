// Writes the scenery of the themes the web writes as data (client/src/themes/) for the apps, which build the same props from
// it (Shared/Game/ThemeData.swift). Run it again after changing a theme: `npx tsx ios/themes.ts`. `npm test` fails until then.
import { writeFileSync } from 'node:fs';
import { themesJson } from '../client/src/themes/index.ts';

writeFileSync(new URL('./Shared/Resources/Themes.json', import.meta.url), themesJson());
