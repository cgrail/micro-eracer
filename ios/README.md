# Micro E-Racer for iPhone and iPad

A native Swift port of the browser game one directory up: SwiftUI for the screens, SceneKit for the 3D, AVAudioEngine for
the sound, and the official [Colyseus Swift SDK](https://github.com/colyseus/colyseus-swift) (0.18, like the server) for the
Races. It joins the same `race` room as the browsers, so phones and browsers race each other.

## Building

Requires Xcode 16 or newer (the project uses the synchronized-folder format).

1. `open ios/MicroERacer.xcodeproj`
2. Signing & Capabilities: pick your team (bundle id `de.grails.microeracer`).
3. Run on an iPhone, an iPad or the simulator, in portrait or landscape.

A Swift file added anywhere under `MicroERacer/` joins the target by itself. The only dependency is the Colyseus SDK
(Swift Package Manager, pinned in `Package.resolved`).

The app races on `wss://micro.grails.de`. To race on a development server instead, pass launch arguments in the scheme
(or set those UserDefaults): `-server ws://192.168.1.20:2567` for `npm run dev` on that machine (the simulator can use
`ws://localhost:2567`). In a Debug build, `-autoplay YES -name Tester` starts a Race straight away. When the server can't
be reached within 5 seconds, Play starts an Offline Race against the Bots, as in the browser.

## Checking

```sh
cd ios
swift test     # the rules against the TypeScript: physics fixture, Track data, songs, a headless Race on every Track
xcodebuild -project MicroERacer.xcodeproj -scheme MicroERacer -destination 'generic/platform=iOS Simulator' build
```

With only the Command Line Tools selected (`xcode-select -p` shows `/Library/Developer/CommandLineTools`), put
`DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` in front of both.

`swift test` builds only `MicroERacer/Core` (`Package.swift`), on the Mac, and reads its references straight from the web
side: `shared/src/physics.fixture.json`, `shared/src/tracks/*.ts` and `client/src/songs.ts`. So a change there that the
port hasn't followed fails here.

## Project layout

Names of types, functions and constants match the TypeScript, so a grep finds both sides.

| | mirrors (web) |
|---|---|
| `MicroERacer/Core/Track.swift` | `shared/src/track.ts` and `shared/src/tracks/*.ts` |
| `MicroERacer/Core/Physics.swift`, `Collide.swift`, `Car.swift` | `shared/src/physics.ts`, `collide.ts`, `car.ts` |
| `MicroERacer/Core/Race.swift`, `Bots.swift`, `Combat.swift`, `Contact.swift`, `Energy.swift` | `shared/src/race.ts`, `bots.ts`, `combat.ts`, `contact.ts`, `energy.ts` (the Offline Race) |
| `MicroERacer/Core/Snapshot.swift` | `shared/src/snapshot.ts` and the state types of `client/src/state.ts` |
| `MicroERacer/Net/RaceLink.swift`, `OnlineRace.swift`, `OfflineRace.swift` | `RaceLink` in `client/src/state.ts`, the room (`main.ts`), `client/src/offline.ts` |
| `MicroERacer/Game/Game.swift`, `GameSync.swift`, `GameEffects.swift` | `client/src/game.ts` |
| `MicroERacer/Game/Motion.swift` | `client/src/motion.ts` |
| `MicroERacer/Game/Toon.swift`, `Scenery.swift`, `Props.swift`, `Models.swift` | `client/src/scene.ts`, `cars.ts` |
| `MicroERacer/Game/Particles.swift` | `client/src/effects.ts` |
| `MicroERacer/Audio/Synth.swift`, `Sound.swift`, `Songs.swift` | `client/src/audio.ts`, `songs.ts` |
| `MicroERacer/UI/StartView.swift` | the start form in `client/index.html`, `main.ts`, `garage.ts` |
| `MicroERacer/UI/HUD.swift`, `TouchControls.swift` | `client/src/hud.ts`, `input.ts` (touch) |
| `MicroERacer/AppModel.swift` | `client/src/main.ts` |

The threads: the game runs on SceneKit's render thread (`renderer(_:updateAtTime:)`), which also pumps the Colyseus SDK
(`Colyseus.autoPump = false`), so every room callback arrives there between frames. The HUD goes to SwiftUI on the main
thread only when it changes, and the touch controls hand their state over through a lock (`Controls`).

The look: cel shading in three tones is a SceneKit shader modifier on the lighting (`TOON_LIGHTING` in `Toon.swift`), and the
black outlines are inverted hulls (`outline`), which like the browsers' `OutlineEffect` draw every outlined mesh twice.
SceneKit rather than RealityKit because it can do both, it is what mech-vs-mech's port uses, and the scene is small.

## Assets

- The Racers' voices are not copied: the project references `../client/public/voices` as a folder, so the app bundles the
  very files the browsers load (CC0, credited in its `CREDITS.md`).
- `MicroERacer/Resources/Bangers.woff` is the same Bangers file the browsers get from `@fontsource/bangers` (SIL Open Font
  License, `Bangers-OFL.txt`); CoreText reads WOFF directly.
- The app icon is drawn by `client/share/art.ts`, like the browsers' icon: `npx tsx ios/icon.ts` renders it into the asset
  catalog. Run it again after changing the art.
