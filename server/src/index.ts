import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { api } from './api.ts';
import { deployHook } from './deployHook.ts';
import { RaceRoom } from './RaceRoom.ts';

const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));

const server = defineServer({
  rooms: {
    // apps from before the Track picker join `race`, so it keeps to the Tracks they know
    race: defineRoom(RaceRoom, { classic: true }),
    // every join takes the fullest Race there is, whatever it races: only the first Player picks the Track (`track`, or none
    // for any), when theirs makes the Race, and everyone after joins them (the start screen shows that Race: `GET /race`)
    race2: defineRoom(RaceRoom).sortBy({ clients: -1 }),
  },
  transport: new WebSocketTransport(),
  greet: false,
  // in development Vite serves the browser app; in production this one process does both
  express: (app) => {
    deployHook(app);
    api(app);
    // the build leaves a Brotli copy next to each script and stylesheet (client/vite.config.ts); Caddy passes it on as it is
    app.use('/assets', (req, res, next) => {
      if (!/\.(js|css)$/.test(req.path) || !existsSync(`${dist}/assets${req.path}.br`)) return next();
      res.vary('Accept-Encoding');
      if (req.acceptsEncodings('br')) {
        res.type(extname(req.path)).set('Content-Encoding', 'br');
        req.url = `${req.path}.br`;
      }
      next();
    });
    // the build names everything in assets/ after a hash of its content, so browsers keep those files across deploys
    app.use('/assets', express.static(`${dist}/assets`, { immutable: true, maxAge: '1y' }));
    // link previews (Slack, Teams, X, WhatsApp) only follow absolute URLs, so the page's preview tags get the origin:
    // DOMAIN, which install.sh puts in the service's settings, or else the host the browser asked for
    app.get(['/', '/index.html'], async (req, res, next) => {
      const host = process.env.DOMAIN || req.get('host') || '';
      const page = /^[\w.-]+(:\d+)?$/.test(host) && (await readFile(`${dist}/index.html`, 'utf8').catch(() => ''));
      if (!page) return next();
      const origin = `${process.env.DOMAIN ? 'https' : req.protocol}://${host}`;
      res.set('Cache-Control', 'no-cache').type('html')
        .send(page.replace(/(<meta (?:property|name)="(?:og|twitter):[\w:]+" content=")\//g, (_, tag: string) => `${tag}${origin}/`));
    });
    app.use(express.static(dist));
  },
});

// HOST=127.0.0.1 behind a reverse proxy on the same box; all interfaces otherwise
const port = Number(process.env.PORT ?? 2567), host = process.env.HOST || undefined;
await server.listen(port, host);
console.log(`Micro E-Racer server on ${host ?? ''}:${port}`);
