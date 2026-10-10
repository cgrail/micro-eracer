# Micro E-Racer

A Micro Machines–style 3D racing game in the browser, online first. You enter a name, press Play, and take over a Bot's E-Car in a Race that is already running, against up to 7 others (Players or Bots). The E-Cars are electric: Energy drains as you drive and when you are hit, Batteries on the Track charge it, and an empty E-Car is Stranded and then Recharged by a drone where it stands. There are Shots, Item Boxes (Missile, Mine, Shield), Rams, Drifts, Puddles and Fall-offs on four small themed Tracks (kitchen, garden, office desk, bathtub). It runs on desktop and mobile.

It is TypeScript throughout: Three.js in the browser (built with Vite), Colyseus on a Node server, and Rapier physics in both. Every model, texture, sound and song is generated in code. The only asset files are the Bangers font (`@fontsource/bangers`) and the Racers' voices: short CC0 recordings in `client/public/voices`, credited in its `CREDITS.md`.

- **Terms:** [CONTEXT.md](CONTEXT.md) is the glossary (Race, Seat, Player, Bot, E-Car, Body, Energy, Stranded, Recharge, Ram, Hit, Item…). Use its capitalised terms in code, comments and UI text. A new or changed game concept gets its entry there. It is a glossary only, so no implementation details go in it.
- **Decisions:** [docs/adr/](docs/adr/). An ADR is only for a decision that is hard to reverse, surprising without context and the result of a real trade-off.

## Running and checking

- `npm run dev` starts Vite on `:5173` (with `--host`, so a phone on the LAN can join) and the game server on `:2567` (`tsx watch`). In development the browser connects to `<hostname>:2567`; in production, to its own origin.
- `TRACK=garden` picks the first Race's Track, and `DRAIN_SCALE=10` makes Energy run out ten times faster (for trying out Stranded and the Recharge). Both work with `npm run dev` and in `/etc/default/micro-eracer` on the server.
- The user usually has `npm run dev` running. Start any server of your own on another port (`PORT=2600 npx tsx server/src/index.ts`) and never kill theirs.
- After every change, run these from the repo root:
  - `npm run typecheck` (`tsc --noEmit`; nothing is emitted, since Vite and tsx run the TypeScript as it is).
  - `npm test` (`shared/src/race.test.ts`, node:test through tsx). It checks that every Track closes and counts Laps only in order. It runs a headless Race on every Track in which 8 Bots must finish, and checks Stranded → Recharge and Shield. It logs balance stats per Track: Race time, Recharges, Leader Recharges, pickups, Rams, Hits. Extend it when you add a mechanic, and look at the stats after balance changes. Running dry should be common, most of all at the front (the Leader about once a Race in Bot-only Races).
  - `npm run build`, to confirm Vite bundles cleanly. The chunk-size warning is known.
- The user does all in-browser testing, so never launch a browser or headless Chrome. After each change, list the manual checks to run instead: how it looks, sounds and plays, on desktop and on a phone.
- `install.sh` deploys onto the box that mech-vs-mech's `install.sh` set up (Caddy in Let's Encrypt mode), next to Electro Car Racer and calvo:
  - code in `/opt/micro-eracer`, run as user `mer`
  - systemd unit `micro-eracer` on `127.0.0.1:8091`, started with `node --import tsx server/src/index.ts`
  - Caddy site `/etc/caddy/apps/micro-eracer.caddy`
  - a timer that runs `update.sh` every 5 minutes, so **a push to `main` goes live within 5 minutes**

  Both scripts build with `npm ci && npm run build`, so a new dependency needs nothing more there. Check them with `bash -n` (and shellcheck if it's installed).

## Architecture

One `package.json`, no workspaces. There are three folders, and `client/` and `server/` both import `shared/`.

| Folder | Files | Role |
|---|---|---|
| `shared/src/` | `track.ts` (`buildTrack`, `TRACKS`, progress), `tracks/*.ts` (one data file per Track), `car.ts` (Rapier world, `createCar`, `driveCar`, Energy constants), `race.ts` (`RaceSim`, `Seat`, `RaceEvent`), `bots.ts` (`botInput`: how a Bot drives), `energy.ts` (Batteries, Recharge length, the Leader's pace), `contact.ts` (Rams, and E-Cars on another's roof), `combat.ts` (`Combat`: Item Boxes and the Items: Zap Shots, Missiles, Mines, Shields; boxes only give from `GOODIES_FROM` = 4th place back), `snapshot.ts` (`seatState`: a Seat as the browsers see it), `race.test.ts` | The game itself: Tracks, physics and the Race simulation. It runs in Node on the server, and the browser reuses the Track and physics code. It has no networking, so the browser's Offline Race runs the same `RaceSim` |
| `server/src/` | `index.ts` (Colyseus server; in production it also serves `client/dist` with Express), `RaceRoom.ts` (state schema, messages, `sync()`) | One Colyseus room per Race wraps a `RaceSim` and steps it at 60 Hz. Each tick broadcasts that tick's `events` and copies the sim into the schema state (`sync()`) |
| `client/src/` | `main.ts` (start form, mute, joining), `game.ts` (`startGame`: renderer, state sync, own E-Car, events, camera), `motion.ts` (how E-Cars move on screen), `hud.ts` (`createHud`), `state.ts` (the room state as the browser sees it, and `RaceLink`), `offline.ts` (`offlineRace`), `scene.ts` (toon materials, Track scenery per theme, `makeDrone`, `makeBattery`, …), `cars.ts` (`makeCar`: one look per Body), `effects.ts` (`Particles`), `input.ts` (keyboard and touch `Controls`), `audio.ts` (`Sound`: effects, motor, cartoon voices, music player), `songs.ts` (soundtrack data), `index.html`, `style.css` | The browser app. It drives the Player's own E-Car locally and shows everything else as the server reports it |

### Core model

- **Who owns what** ([ADR 0001](docs/adr/0001-browsers-drive-own-car-server-owns-the-rest.md)):
  - **The browser:** each browser simulates only its own E-Car, as a dynamic Rapier body in its own world of the Track. It sends a `pose` 30 times a second, and handles its own Fall-off (back to the last Checkpoint).
  - **The server owns everything else:** Bots (dynamic bodies driven by `botInput`), Laps and Positions, Energy, Batteries, Rams, Combat, phases and results. Players' E-Cars are kinematic bodies on the server, placed from their poses, and `ActiveCollisionTypes.KINEMATIC_KINEMATIC` lets the server judge Rams between them.
  - **What the server does to a Player's E-Car** reaches the browser in one of two ways, never by moving the server's body:
    - a Hit's shove and spin come as a `hit` event, and that browser applies them;
    - a jump (a new grid) bumps `Seat.spawn`. The browser teleports to the reported pose when it sees the new `spawn`, and the server ignores poses that carry an old `spawn`.
- **Track:** a turtle walk of pieces on a grid of `TILE` = 16 m tiles: `S`, `L`, `R`, the ramps `U`/`D` (`RISE` = 3.5 m, eased at both ends) and the jump `J` (a kicker that ends in a drop); a trailing `*` adds walls. It is sampled into `samples`, each with its road height `y`. Checkpoints, the Bot racing line, Puddles and Item Box spots all come from piece indexes. Progress (`Progress.u`) is a continuous sample count found by a windowed nearest-sample search. That stops shortcuts: a Lap only counts when the samples are passed in order. Every Track must close at the height it started, which `npm test` checks.
- **Heights:** a Track may cross itself only on different levels (a bridge); `buildTrack` throws on a crossing at one height. Anything that finds things by position must stay on its own level: `nearestSample` is 3D, and pickups, Hits, Puddles and Mines check `sameLevel`. A Fall-off is `FALL_Y` below the road under the E-Car's progress, which also catches a drop from a bridge onto the road beneath. The bodies never pitch: on a ramp one edge rides the road, so the ground ray in `driveCar` is long, and the browser tilts the models (`gradeAt` in `game.ts`).
- **Race flow:** `phase` goes grid → racing → finishing. Grid time is 3 s (`GRID_TIME`), counted down 3, 2, 1. The Race ends 5 s after the first finish (`FINISH_TIME`, counted down on the HUD) (meanwhile the HUD's standings fill up as Racers finish), then the next Race starts on a different Track. There are 3 Laps and 8 Seats.
- **Offline Race:** when Play can't reach the server within 5 s, `main.ts` starts `offlineRace`: a `RaceSim` stepped in the browser behind `RaceLink`, the same interface as the room, so `game.ts` can't tell the two apart. Anything new the room does (a message, a state field) needs doing in `offline.ts` too.
- **No stacking:** only the road counts as ground for `driveCar` (`ONLY_FIXED`), so an E-Car on another's roof can't drive there, and after half a second the server puts it down beside the other at a free spot (`unstack` in `contact.ts`, `freeSpot` in `track.ts`, which the Fall-off reset uses too); for a Player through the `spawn` jump.
- **Joining and leaving:** a joining Player takes over the last-Position Bot's E-Car where it is, and everyone is told (`join`). Bot names start with 🤖 (`BOT_NAMES`) and Players' never do (`join` strips it); name tags are gold for Players and grey for Bots. A leaving Player's Seat goes back to a Bot (after a 5 s chance to reconnect).
- **Energy:** drains by distance driven: a full tank lasts `TANK_LAPS` = 1.6 Laps on any Track (times the Body's `tank`). Hits drain it. Below 25 the E-Car is in Limp Mode, down to half speed at empty. At 0 it is Stranded for `STRANDED_TIME` (it brakes to a halt, jerks and sputters while the drone flies in), then Recharged: the drone hovers over it and fills the battery where it stands, for `RECHARGE_TIME` at the back and, in the top three, until three, two or one Racers behind could get past (`rechargeLength` in `energy.ts`, at most 9 s). Meanwhile `HALT` holds it still, even on a ramp. A Leader far ahead is slowed down to 85% (`leadPace`, sent to the browsers as `CarState.pace`). Meanwhile the browser greys out its view (a CSS filter on the canvas, set in `hud.ts` only while needed).
- **Charging Station:** every Track has a bay `BAY_WIDTH` wide on the right of its last straights (`Sample.bay`, eased in and out; the road's collider is widened there, and `buildTrack` throws if there is no room). In it (`inStation`) an E-Car charges `STATION_RATE` a second under the `PIT_SPEED` limit, which the browser applies to its own E-Car. Bots low on Energy pull in and stay until nearly full.
- **Batteries:** each appears just ahead of one Racer picked by Position (`BATTERY_ODDS`: about 3% for the Leader up to 17–18% for each of the last four), and before the Racer in front of them, so nobody further ahead gets it first. That makes Energy plentiful at the back, fought over in the middle and scarce at the front, where the Charging Station is the way to keep going. Rams steal Energy.
- **Bots:** they hold off attacking for 4 s after GO (`botsAttack`). After that they hunt Batteries, Ram prey ahead (Players first), use Items when they make sense, and save their Shots mostly for Players. A Player in the lead is everyone's target: Bots behind them aim at them (leading the Shot) and together fire about once a second (`leaderShotAt` in `combat.ts`). `catchUp` keeps them near the Players.
- **Smooth over exact:** the room sends its state 30 times a second (`setPatchRate`). The browser draws its own E-Car between its last two physics steps, so it moves evenly at any frame rate, and moves the others every frame at their reported speed, only nudging them towards where the server says they are (`glide` in `motion.ts`). A late update shows as a little drift, never a jump; only an error over 6 m snaps.
- **Events:** `RaceEvent` (`ram`, `hit`, `boom`, `block`, `battery`, `shot`, `stranded`, `recharge`, `box`, `item`, `join`, `leave`) is what happened in one tick. It exists only to drive sounds and effects in the browsers; the state is the truth.
- **Look:** cel shading (`MeshToonMaterial` with a 3-tone gradient) with black outlines (`OutlineEffect`; `userData.outlineParameters = { visible: false }` turns one material's outline off), static scenery merged per material, canvas textures, a halftone overlay and comic HUD lettering.
- **Sound:** all WebAudio, started by the Play button (a user gesture, which mobile browsers need).
  - effects, and the airflow (filtered noise rising with speed; no motor hum) and skid of the Player's own E-Car
  - voices (`cry(mood, seat)`): CC0 recordings per mood (`CLIPS` in `audio.ts`, files `public/voices/<mood>-<name>.mp3`), played at a per-Seat rate so each Racer sounds different. Cries about other E-Cars are rationed, and ones about your own always play. A new clip must be CC0, trimmed, loudness-matched (about −18 dB mean, peaks under −1 dB) and listed in `CREDITS.md`
  - one chiptune song per Track, from Electro Car Racer (github.com/cgrail/e-racer)
  - one mute switch for everything

## Rules for changes

- **Everything stays procedural:** no image, model, audio or font files beyond the bundled Bangers font and the CC0 voice clips. No requests to Google Fonts or other third parties (the audience is in Germany, so GDPR applies).
- **`shared/` runs in Node:** it must not touch the DOM or browser APIs, and it stays free of networking.
- **Server and browsers run the same `shared/` code:** a change to it, to the schema in `RaceRoom.ts`, to a message or to `RaceEvent` needs both sides deployed together. One process serves both, so a deploy does that, but tabs that are already open run the old client until they reload.
- **Never trust the browser:** every message is checked on the server (`isPose`: finite numbers, bounded; names cut to 16 characters; Body from `BODY_KINDS`), and Items (a Zap's Shots too) go through `canAct` and the server's own cooldowns.
- **Mobile is a first-class target:** touch has a steering pad, auto-throttle and one action button (`#fire`: it shoots, or uses the Item when there is one, and `hud.ts` labels it), and no brake; a Back button (reverse) only shows while the E-Car is stuck (`showBack`, from `game.ts`). Keep it to that, so a new action has to fit into the action button. Layouts must work at phone width with safe-area insets. Mind the draw calls: `OutlineEffect` already renders everything twice.
- **Per-Seat state lives on the `Seat`** (server) or in `views[seat]` (browser), never in globals.
- **Tracks are data:** a new Track is a file in `shared/src/tracks/` added to `TRACKS`, with a theme in `scene.ts` if it's new; `npm test` must pass on it.
- **Keep files under about 300 lines.** `game.ts`, `scene.ts`, `audio.ts` and `race.ts` are already past that. When a change makes one of them grow, split it along a real seam (effects out of `game.ts`, props per theme out of `scene.ts`, voices out of `audio.ts`, Bots out of `race.ts`) instead.
- **Saved data:** `localStorage` keys `name`, `body` and `muted`, each read and written in `try/catch` (private mode), so the game works without storage. Old values must keep loading.
- **Keep `README.md` in sync** when you add player-visible features, controls or settings.

## Workflow

- The backlog is `todo.md`, worked through with the `/todo` skill. Each item gets its own commit, and done items are ticked `[x]` and kept.
- Commit messages use an imperative subject of about 60 characters with no scope prefix ("Add soundtrack and systemd deployment"). Add a body only when the reason isn't obvious.
- Don't push unless asked: pushing to `main` deploys.
