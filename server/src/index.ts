import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { deployHook } from './deployHook.ts';
import { RaceRoom } from './RaceRoom.ts';

const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));

const server = defineServer({
  rooms: { race: defineRoom(RaceRoom) },
  transport: new WebSocketTransport(),
  greet: false,
  // in development Vite serves the browser app; in production this one process does both
  express: (app) => {
    deployHook(app);
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
