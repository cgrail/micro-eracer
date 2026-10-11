# micro-eracer

Micro E-Racer: a multiplayer 3D racing web game in the spirit of Micro Machines, with electric cars on small tracks, for desktop and mobile browsers, and as an app for iPhone and iPad that races in the same Races.

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

Bodies: five generic electric look-alikes that drive differently, from quick to heavy. The Roadster is fast and drifts easily, the SUV is the all-rounder, the Microbus grips well and has a big battery, the Pickup is heavy but pulls away hard, and the Semi (a truck with its trailer) is the slowest, heaviest and has the biggest battery. Heavier Bodies win Rams and get thrown around less by Hits, and a bigger battery means running dry less often, so each of them can win. The start form steps through the Bodies with ◀ and ▶ and turns the picked one on a turntable, with bars for its top speed, acceleration, grip, ruggedness (weight) and battery.

Run dry and you're Stranded: the world turns black and white until a drone arrives and Recharges you where you stand, and the colour comes back as the battery fills.

Low on Energy and no Battery in sight? The Charging Station is a bay beside the last straights before the finish line: drive through it to charge fast, but it has a speed limit, so it's a detour.

Bots have names that start with 🤖 and grey name tags; Players' tags are gold. When you join, you take over a Bot's E-Car where it is, and everyone sees who took over whom.

Ram someone from the side and they slide away, swinging round if you catch their nose or tail; a heavier Body shoves harder and gets shoved less.

Leading is meant to be hard: the Leader is slowed as soon as they pull away and second and third get a tow, so the front three keep fighting; Batteries are plentiful at the back of the field and scarce at the front, so the Leader runs dry the most, and every Bot behind a Player in first place shoots at them, about once a second between them. A Shield, a dodge and the Charging Station are how you hold on.

Controls: on desktop, arrows or WASD drive, and Space, E or Shift uses your Item (hold it down and a Zap keeps firing). On mobile the E-Car accelerates by itself: drag the left pad to steer (or, if you pick Buttons steering on the start screen, hold its ◀ or ▶ half; the wheel in the middle turns as you steer), and tap the one action button on the right, which shows the Item you hold and uses it. There is no brake on mobile; pushing against a wall while steering turns the E-Car free, and if you're stuck a Back button appears: hold it to reverse. On desktop a map in the bottom-left corner shows the Track from above with every E-Car on it: Players with their Position and name, Bots with their Position and 🤖.

Shooting is a goodie, not built in: the Zap (five Shots) comes from Item Boxes like the Missile, Mine and Shield, and Item Boxes are only for Racers from fourth place back: one appears once third place has passed its spot and goes once the last Racer has, so the top three never see one.

`DRAIN_SCALE=10 npm run dev` makes batteries run dry ten times faster, so you can try out being Stranded and the drone's Recharge.

## Code layout

- `shared/`: Tracks, car physics (our own, in `physics.ts` and `collide.ts`) and the Race simulation (`RaceSim`). The server runs it, and the browser reuses the Track and physics code. It's kept free of networking, so when Play can't reach the server within 5 seconds the browser runs the same simulation itself: an Offline Race against the Bots.
- `server/`: a Colyseus room that wraps `RaceSim` and syncs it to the browsers.
- `client/`: the Vite + Three.js browser app. It drives your own E-Car locally and shows the others as the server reports them.
- `ios/`: the iPhone and iPad app, a native Swift port (SwiftUI, SceneKit, the Colyseus Swift SDK) that joins the same Races. See [ios/README.md](ios/README.md).

## iPhone and iPad

`open ios/MicroERacer.xcodeproj`, pick your signing team and run it. The app races on the same server as the browsers, so phones and browsers meet in the same Race, and it falls back to an Offline Race against the Bots when the server can't be reached. It plays like a phone's browser: the E-Car accelerates by itself, the left pad steers (Slider or Buttons, picked on the start screen), the action button on the right uses your Item, and a Back button appears while you're stuck. The sound switch and ✕ (leave the Race) sit under the Lap counter. `cd ios && swift test` checks the Swift rules against the TypeScript. What changed, on the web and in the app, is in [CHANGELOG.md](CHANGELOG.md).

Tracks are data files in `shared/src/tracks/`: pieces `S` (straight), `L` and `R` (90° turns), `U` and `D` (ramps up and down) and `J` (a jump), where a trailing `*` adds walls. A Track may cross itself where a ramp has lifted one part over the other: that is a bridge. A crossing on one level is refused, because it would be a shortcut. Each file also lists which pieces get a Puddle and which theme (kitchen, garden, desk, bathtub) sets the scenery. The scenery is placed automatically in the tiles the road doesn't use. `npm test` checks that every Track closes and that Bots can finish a Race on it.

The sounds are synthesised in the browser with WebAudio: the airflow that rises with your speed (no motor hum), skids, splashes, beeps, explosions and the chiptune soundtrack from [Electro Car Racer](https://github.com/cgrail/e-racer) (one song per Track, in `client/src/songs.ts`). The only recordings are the Racers' voices (laughs and cheers after a Ram, "ow!" when hit, screams, "nooo!" when running dry): 15 short CC0 clips from Freesound in `client/public/voices`, credited in its `CREDITS.md`. Each Seat plays them at its own pitch.

The look is cel shading with black outlines (Three.js `MeshToonMaterial` + `OutlineEffect`), a halftone overlay and the Bangers font, bundled locally so no request goes to Google Fonts.

A link to the game shared in Slack, Teams, X or WhatsApp shows a comic card of E-Cars racing up a road, and the browser tab gets a lightning-bolt icon. The build draws both in code (`client/share/`) like everything else. `npm run dev` serves them at `/social.png` and `/icon.png`.

## Deploy

`install.sh` puts the game on the Ubuntu box that [mech-vs-mech](https://github.com/cgrail/mech-vs-mech)'s `install.sh` already set up in Let's Encrypt mode, next to [Electro Car Racer](https://github.com/cgrail/e-racer) and calvo and the same way they are deployed. Run it on the server:

```sh
git clone https://github.com/cgrail/micro-eracer.git && cd micro-eracer
sudo DOMAIN=micro.example.com ./install.sh   # later runs: sudo ./install.sh
```

It builds the game into `/opt/micro-eracer`, runs the server as the unprivileged user `mer` in a sandboxed systemd unit (`micro-eracer`) on `127.0.0.1:8091`, and adds the Caddy site `/etc/caddy/apps/micro-eracer.caddy`, which serves `https://$DOMAIN` with a Let's Encrypt certificate. Point a plain, un-proxied A/AAAA record for the domain at the box. One Node process serves both the browser app and the Races. Server settings live in `/etc/default/micro-eracer` (`TRACK=` and `DRAIN_SCALE=` from above work there too).

`update.sh` deploys whatever lands on `origin/main`. GitHub's push webhook starts it as soon as something is merged, and a systemd timer runs it every 5 minutes anyway, which catches anything the webhook missed. `sudo ./update.sh --force` rebuilds now. On a box installed before the webhook existed, run `sudo ./install.sh` once more first: it makes the secret and the path unit. To add the webhook, go to the repo's Settings → Webhooks → Add webhook and enter:

- Payload URL: `https://$DOMAIN/deploy-hook`
- Content type: `application/json`
- Secret: the `DEPLOY_HOOK_SECRET` that `install.sh` made, from `sudo sed -n 's/^DEPLOY_HOOK_SECRET=//p' /etc/default/micro-eracer`
- Events: just the push event

GitHub's first delivery is a ping, which should get a green tick. The game server checks the signature and, for a push to `main`, only writes a file. A systemd path unit (`micro-eracer-update.path`) picks that up and runs `update.sh`, which fetches `origin/main` itself, so the webhook can't deploy anything that isn't on `main`. The deploy log is `journalctl -u micro-eracer-update`.
