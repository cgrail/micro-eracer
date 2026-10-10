# micro-eracer

Micro E-Racer: a multiplayer 3D racing web game in the spirit of Micro Machines, with electric cars on small tracks, for desktop and mobile browsers.

- Terms: [CONTEXT.md](CONTEXT.md)
- Decisions: [docs/adr/](docs/adr/)

## Develop

```sh
npm install
npm run dev        # browser app on http://localhost:5173, game server on :2567
npm test           # Track checks plus a headless Race where 8 Bots must finish
npm run typecheck
```

`TRACK=garden npm run dev` starts the first Race on one Track (`kitchen`, `garden`, `desk`, `bathtub`), which is handy while working on its look.

To try it on a phone, open `http://<your-computer's-LAN-IP>:5173` on the same network.

Controls: on desktop, arrows or WASD drive, Space shoots and E or Shift uses the Item. On mobile the E-Car accelerates by itself: drag the left pad to steer, and use the Brake, Zap and Item buttons on the right.

`DRAIN_SCALE=10 npm run dev` makes batteries run dry ten times faster, so you can try out being Stranded and the Airlift.

## Code layout

- `shared/`: Tracks, car physics (Rapier) and the Race simulation (`RaceSim`). The server runs it, and the browser reuses the Track and physics code. It's kept free of networking so an Offline Race can run it in the browser later.
- `server/`: a Colyseus room that wraps `RaceSim` and syncs it to the browsers.
- `client/`: the Vite + Three.js browser app. It drives your own E-Car locally and shows the others as the server reports them.

Tracks are data files in `shared/src/tracks/`: pieces `S` (straight), `L` and `R` (90° turns), where a trailing `*` adds walls. Each file also lists which pieces get a Puddle and which theme (kitchen, garden, desk, bathtub) sets the scenery. The scenery is placed automatically in the tiles the road doesn't use. `npm test` checks that every Track closes and that Bots can finish a Race on it.

All sounds are synthesised in the browser with WebAudio, so there are no audio files: the motor, skids, splashes, beeps, explosions, and cartoon screams on Rams. Shouts use the browser's built-in speech voice.

The look is cel shading with black outlines (Three.js `MeshToonMaterial` + `OutlineEffect`), a halftone overlay and the Bangers font, bundled locally so no request goes to Google Fonts.

## Deploy (VPS)

On a VPS with Docker, with a DNS record for your subdomain pointing at it:

```sh
git clone https://github.com/cgrail/micro-eracer.git && cd micro-eracer
echo "DOMAIN=race.example.com" > .env
docker compose up -d --build
```

Caddy gets the HTTPS certificate automatically and compresses the app. One Node process serves both the browser app and the game server.
