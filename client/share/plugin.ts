import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { deflateSync, inflateSync } from 'node:zlib';
import type { HtmlTagDescriptor, Plugin } from 'vite';
import { CARD, cardSvg, iconSvg } from './art.ts';

const require = createRequire(import.meta.url);
const ALT = 'Micro E-Racer: little electric cars race up a toy road, and one zaps the Leader';
/** WhatsApp shows no picture for a link whose image is bigger than this. */
const WHATSAPP_MAX = 300_000;

/**
 * WOFF wraps a TrueType font's tables, each zlib-compressed: unpacked into a plain font file for resvg, which reads
 * only those, so the card's lettering comes from the same bundled Bangers as the game's.
 */
function woffToTtf(woff: Buffer) {
  const count = woff.readUInt16BE(12), tables: { tag: number; sum: number; data: Buffer }[] = [];
  for (let i = 0; i < count; i++) {
    const at = 44 + i * 20, offset = woff.readUInt32BE(at + 4), packed = woff.readUInt32BE(at + 8), size = woff.readUInt32BE(at + 12);
    const raw = woff.subarray(offset, offset + packed);
    tables.push({ tag: woff.readUInt32BE(at), sum: woff.readUInt32BE(at + 16), data: packed < size ? inflateSync(raw) : raw });
  }
  const log2 = Math.floor(Math.log2(count)), range = 2 ** log2 * 16;
  const head = Buffer.alloc(12 + count * 16);
  head.writeUInt32BE(woff.readUInt32BE(4), 0);
  head.writeUInt16BE(count, 4); head.writeUInt16BE(range, 6); head.writeUInt16BE(log2, 8); head.writeUInt16BE(count * 16 - range, 10);
  let offset = head.length;
  const parts: Buffer[] = [head];
  tables.forEach((t, i) => {
    head.writeUInt32BE(t.tag, 12 + i * 16); head.writeUInt32BE(t.sum, 16 + i * 16);
    head.writeUInt32BE(offset, 20 + i * 16); head.writeUInt32BE(t.data.length, 24 + i * 16);
    const padded = Buffer.alloc((t.data.length + 3) & ~3);
    t.data.copy(padded);
    parts.push(padded);
    offset += padded.length;
  });
  return Buffer.concat(parts);
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function chunk(type: string, data: Buffer) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]), out = Buffer.alloc(body.length + 8);
  let crc = ~0;
  for (const byte of body) crc = CRC[(crc ^ byte) & 255] ^ (crc >>> 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(~crc >>> 0, body.length + 4);
  return out;
}
/**
 * An opaque image as an RGB PNG. The art is flat colour with a repeating halftone screen, which deflate packs best
 * left unfiltered: under 60% of the size of resvg's own PNG, and WhatsApp has a limit.
 */
function encodePng(rgba: Uint8Array, width: number, height: number) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0, o = 0; y < height; y++) {
    raw[o++] = 0;
    for (let i = y * width * 4, end = i + width * 4; i < end; i += 4) { raw[o++] = rgba[i]; raw[o++] = rgba[i + 1]; raw[o++] = rgba[i + 2]; }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

let ready: Promise<Uint8Array> | undefined;
/** Loads resvg's WASM and the font once per process (Vite may load this config again, but the WASM only starts once). */
function setup() {
  ready ??= (async () => {
    await initWasm(readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm'))).catch((err: Error) => {
      if (!/Already initialized/.test(err.message)) throw err;
    });
    return woffToTtf(await readFile(require.resolve('@fontsource/bangers/files/bangers-latin-400-normal.woff')));
  })();
  return ready;
}

/** Renders an SVG that paints every pixel (the art has no transparency) into a PNG. */
export async function renderPng(svg: string) {
  const font = await setup();
  const image = new Resvg(svg, { font: { fontBuffers: [font], defaultFontFamily: 'Bangers' } }).render();
  return encodePng(image.pixels, image.width, image.height);
}

const tags = (card: string, icon: string): HtmlTagDescriptor[] => [
  ...[['og:image', card], ['og:image:type', 'image/png'], ['og:image:width', String(CARD.width)], ['og:image:height', String(CARD.height)], ['og:image:alt', ALT]]
    .map(([property, content]) => ({ tag: 'meta', attrs: { property, content }, injectTo: 'head' as const })),
  { tag: 'meta', attrs: { name: 'twitter:image', content: card }, injectTo: 'head' },
  { tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: icon }, injectTo: 'head' },
  { tag: 'link', attrs: { rel: 'apple-touch-icon', href: icon }, injectTo: 'head' },
];

/**
 * Draws the link preview card and the icon (`art.ts`) into PNGs: in a build as hashed files in `assets/`, in
 * development at `/social.png` and `/icon.png`. Either way the page gets the tags that point to them. Link previews
 * need absolute URLs, so in production the server puts its origin in front (`server/src/index.ts`).
 */
export function sharePreview(): Plugin {
  const names = { card: 'social.png', icon: 'icon.png' };
  return {
    name: 'share-preview',
    async buildStart() {
      if (this.environment.config.command !== 'build') return;
      const card = await renderPng(cardSvg());
      if (card.length > WHATSAPP_MAX) this.warn(`the link preview card is ${Math.round(card.length / 1000)} kB, and WhatsApp shows none over ${WHATSAPP_MAX / 1000} kB`);
      this.emitFile({ type: 'asset', name: names.card, source: card });
      this.emitFile({ type: 'asset', name: names.icon, source: await renderPng(iconSvg()) });
    },
    configureServer(server) {
      const draw: Record<string, () => string> = { [`/${names.card}`]: cardSvg, [`/${names.icon}`]: iconSvg };
      server.middlewares.use((req, res, next) => {
        const svg = draw[req.url?.split('?')[0] ?? ''];
        if (!svg) return next();
        renderPng(svg()).then((png) => { res.setHeader('Content-Type', 'image/png'); res.end(png); }, next);
      });
    },
    transformIndexHtml(_, ctx) {
      if (!ctx.bundle) return tags(`/${names.card}`, `/${names.icon}`);
      const file = (name: string) => Object.values(ctx.bundle!).find((f) => f.type === 'asset' && f.names.includes(name))?.fileName;
      const card = file(names.card), icon = file(names.icon);
      if (card && icon) return tags(`/${card}`, `/${icon}`);
    },
  };
}
