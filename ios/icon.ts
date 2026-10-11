// Draws the app icon from the web's own art (client/share/art.ts, the same as /icon.png) into the asset catalog, 1024 px
// square as the App Store wants it. Run it again after changing the art: `npx tsx ios/icon.ts`.
import { writeFileSync } from 'node:fs';
import { ICON, iconSvg } from '../client/share/art.ts';
import { renderPng } from '../client/share/plugin.ts';

const svg = iconSvg().replace(`width="${ICON}" height="${ICON}"`, 'width="1024" height="1024"');
writeFileSync(new URL('./MicroERacer/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png', import.meta.url), await renderPng(svg));
