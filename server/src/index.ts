import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { initPhysics } from '../../shared/src/car.ts';
import { RaceRoom } from './RaceRoom.ts';

await initPhysics();

const server = defineServer({
  rooms: { race: defineRoom(RaceRoom) },
  transport: new WebSocketTransport(),
  greet: false,
  // in development Vite serves the browser app; in production this one process does both
  express: (app) => { app.use(express.static(fileURLToPath(new URL('../../client/dist', import.meta.url)))); },
});

const port = Number(process.env.PORT ?? 2567);
await server.listen(port);
console.log(`Micro E-Racer server on :${port}`);
