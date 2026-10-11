// Draws the app icons from the web's own art (client/share/art.ts, the same as /icon.png) into the asset catalogs of the
// iPhone and the watch app, 1024 px square as the App Store wants them. Run it again after changing the art: `npx tsx ios/icon.ts`.
import { writeFileSync } from 'node:fs';
import { ICON, iconSvg } from '../client/share/art.ts';
import { renderPng } from '../client/share/plugin.ts';

const png = await renderPng(iconSvg().replace(`width="${ICON}" height="${ICON}"`, 'width="1024" height="1024"'));
for (const app of ['MicroERacer', 'MicroERacerWatch']) writeFileSync(new URL(`./${app}/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png`, import.meta.url), png);
