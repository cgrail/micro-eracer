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

Bodies: the Roadster is fast, quick off the line and drifts easily. The Microbus is slower and turns wider, but it's heavy (it wins Rams and gets thrown around less by Hits), grips better and has a bigger battery, so it runs dry less often.

Controls: on desktop, arrows or WASD drive, Space shoots and E or Shift uses the Item. On mobile the E-Car accelerates by itself: drag the left pad to steer, and use the Brake, Zap and Item buttons on the right.

`DRAIN_SCALE=10 npm run dev` makes batteries run dry ten times faster, so you can try out being Stranded and the Airlift.

## Code layout

- `shared/`: Tracks, car physics (Rapier) and the Race simulation (`RaceSim`). The server runs it, and the browser reuses the Track and physics code. It's kept free of networking, so when Play can't reach the server within 5 seconds the browser runs the same simulation itself: an Offline Race against the Bots.
- `server/`: a Colyseus room that wraps `RaceSim` and syncs it to the browsers.
- `client/`: the Vite + Three.js browser app. It drives your own E-Car locally and shows the others as the server reports them.

Tracks are data files in `shared/src/tracks/`: pieces `S` (straight), `L` and `R` (90° turns), `U` and `D` (ramps up and down) and `J` (a jump), where a trailing `*` adds walls. A Track may cross itself where a ramp has lifted one part over the other: that is a bridge. A crossing on one level is refused, because it would be a shortcut. Each file also lists which pieces get a Puddle and which theme (kitchen, garden, desk, bathtub) sets the scenery. The scenery is placed automatically in the tiles the road doesn't use. `npm test` checks that every Track closes and that Bots can finish a Race on it.

All sounds are synthesised in the browser with WebAudio, so there are no audio files: the motor, skids, splashes, beeps, explosions, the chiptune soundtrack from [Electro Car Racer](https://github.com/cgrail/e-racer) (one song per Track, in `client/src/songs.ts`), and the Racers' cartoon voices, a formant synth that laughs, yells "ow!", "hey!", "waaah!" or "nooo!" in each Seat's own voice.

The look is cel shading with black outlines (Three.js `MeshToonMaterial` + `OutlineEffect`), a halftone overlay and the Bangers font, bundled locally so no request goes to Google Fonts.

## Deploy

`install.sh` puts the game on the Ubuntu box that [mech-vs-mech](https://github.com/cgrail/mech-vs-mech)'s `install.sh` already set up in Let's Encrypt mode, next to [Electro Car Racer](https://github.com/cgrail/e-racer) and calvo and the same way they are deployed. Run it on the server:

```sh
git clone https://github.com/cgrail/micro-eracer.git && cd micro-eracer
sudo DOMAIN=micro.example.com ./install.sh   # later runs: sudo ./install.sh
```

It builds the game into `/opt/micro-eracer`, runs the server as the unprivileged user `mer` in a sandboxed systemd unit (`micro-eracer`) on `127.0.0.1:8091`, and adds the Caddy site `/etc/caddy/apps/micro-eracer.caddy`, which serves `https://$DOMAIN` with a Let's Encrypt certificate. Point a plain, un-proxied A/AAAA record for the domain at the box. One Node process serves both the browser app and the Races. A systemd timer runs `update.sh` every 5 minutes and deploys whatever lands on `origin/main`; `sudo ./update.sh --force` rebuilds now. Server settings live in `/etc/default/micro-eracer` (`TRACK=` and `DRAIN_SCALE=` from above work there too).
