import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { initPhysics } from '../../shared/src/car.ts';
import { deployHook } from './deployHook.ts';
import { RaceRoom } from './RaceRoom.ts';

await initPhysics();

const server = defineServer({
  rooms: { race: defineRoom(RaceRoom) },
  transport: new WebSocketTransport(),
  greet: false,
  // in development Vite serves the browser app; in production this one process does both
  express: (app) => {
    deployHook(app);
    app.use(express.static(fileURLToPath(new URL('../../client/dist', import.meta.url))));
  },
});

// HOST=127.0.0.1 behind a reverse proxy on the same box; all interfaces otherwise
const port = Number(process.env.PORT ?? 2567), host = process.env.HOST || undefined;
await server.listen(port, host);
console.log(`Micro E-Racer server on ${host ?? ''}:${port}`);
