import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { initPhysics } from '../../shared/src/car.ts';
import { RaceRoom } from './RaceRoom.ts';

await initPhysics();
const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));

const server = defineServer({
  rooms: { race: defineRoom(RaceRoom) },
  transport: new WebSocketTransport(),
  greet: false,
  // in development Vite serves the browser app; in production this one process does both
  express: (app) => {
    // the build names everything in assets/ after a hash of its content, so browsers keep those files across deploys
    app.use('/assets', express.static(`${dist}/assets`, { immutable: true, maxAge: '1y' }));
    app.use(express.static(dist));
  },
});

// HOST=127.0.0.1 behind a reverse proxy on the same box; all interfaces otherwise
const port = Number(process.env.PORT ?? 2567), host = process.env.HOST || undefined;
await server.listen(port, host);
console.log(`Micro E-Racer server on ${host ?? ''}:${port}`);
