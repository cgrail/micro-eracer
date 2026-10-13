# Micro E-Racer for iPhone, iPad and Apple Watch

A native Swift port of the browser game one directory up: SwiftUI for the screens, SceneKit for the 3D, AVAudioEngine for
the sound. The iPhone and iPad app races online through the official
[Colyseus Swift SDK](https://github.com/colyseus/colyseus-swift) (0.18, like the server) in the same `race2` room as the
browsers, on the picked Track or any. The Apple Watch app races offline against the Bots: watchOS has no build of the SDK and allows web sockets only to
audio-streaming apps.

## Building

Requires Xcode 16 or newer (the project uses the synchronized-folder format).

1. `open ios/MicroERacer.xcodeproj`
2. Signing & Capabilities: pick your team for both targets (bundle ids `de.grails.microeracer` and
   `de.grails.microeracer.watchkitapp`).
3. Run the `MicroERacer` scheme on an iPhone, an iPad or the simulator (portrait or landscape), or `MicroERacerWatch` on an
   Apple Watch. The watch app ships inside the iPhone app and also runs on its own (`WKRunsIndependentlyOfCompanionApp`).

A Swift file added to a folder joins the targets that folder belongs to (below). The only dependency is the Colyseus SDK,
for the iPhone app (Swift Package Manager, pinned in `Package.resolved`).

The iPhone app races on `wss://micro.grails.de`. To race on a development server instead, pass launch arguments in the
scheme (or set those UserDefaults): `-server ws://192.168.1.20:2567` for `npm run dev` on that machine (the simulator can use
`ws://localhost:2567`). In a Debug build, `-autoplay YES -name Tester` starts a Race straight away. When the server can't be
reached within 5 seconds, Play starts an Offline Race against the Bots, as in the browser.

## Checking

```sh
cd ios
swift test     # the rules against the TypeScript: physics fixture, Track data, songs, a headless Race on every Track
xcodebuild -project MicroERacer.xcodeproj -scheme MicroERacer -destination 'generic/platform=iOS Simulator' build   # both apps
```

With only the Command Line Tools selected (`xcode-select -p` shows `/Library/Developer/CommandLineTools`), put
`DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` in front of both.

`swift test` builds only `Core/` (`Package.swift`), on the Mac, and reads its references straight from the web side:
`shared/src/physics.fixture.json`, `shared/src/tracks/*.ts` and `client/src/songs.ts`. So a change there that the port
hasn't followed fails here.

## Project layout

Four folders, each a synchronized group of the targets that compile it:

| Folder | In | What |
|---|---|---|
| `Core/` | both apps, `swift test` | the rules: the port of `shared/src` |
| `Shared/` | both apps | the game on screen, its sound, the Offline Race, the HUD's logic, the controls' state, the font |
| `MicroERacer/` | iPhone and iPad | the app around it: online play, the start screen, the HUD, the touch controls, the SceneKit view |
| `MicroERacerWatch/` | Apple Watch | the watch app around it: start screen, the Crown and the tap, a small HUD, haptics |

Names of types, functions and constants match the TypeScript, so a grep finds both sides.

| Swift | mirrors (web) |
|---|---|
| `Core/Track.swift` | `shared/src/track.ts` and `shared/src/tracks/*.ts` |
| `Core/Physics.swift`, `Collide.swift`, `Car.swift` | `shared/src/physics.ts`, `collide.ts`, `car.ts` |
| `Core/Race.swift`, `Bots.swift`, `Combat.swift`, `Contact.swift`, `Energy.swift` | `shared/src/race.ts`, `bots.ts`, `combat.ts`, `contact.ts`, `energy.ts` (the Offline Race) |
| `Core/Snapshot.swift` | `shared/src/snapshot.ts` and the state types of `client/src/state.ts` |
| `Shared/Net/RaceLink.swift`, `OfflineRace.swift`, `MicroERacer/OnlineRace.swift` | `RaceLink` in `client/src/state.ts`, `client/src/offline.ts`, the room (`main.ts`) |
| `Shared/Game/Game.swift`, `GameSync.swift`, `GameEffects.swift` | `client/src/game.ts` |
| `Shared/Game/Motion.swift` | `client/src/motion.ts` |
| `Shared/Game/Toon.swift`, `Scenery.swift`, `Props.swift`, `Models.swift` | `client/src/toon.ts`, `scene.ts`, `props.ts`, `cars.ts` |
| `Shared/Game/ThemeData.swift` | `buildProp` and `paint` in `client/src/props.ts`, for the themes in `client/src/themes/`, and `stagingOf` from `client/src/themes/index.ts` (each Track's river, bridge and landmarks, worked out by `staging.ts`); all read from `Shared/Resources/Themes.json` |
| `Shared/Game/Particles.swift` | `client/src/effects.ts` |
| `Shared/Audio/Synth.swift`, `Sound.swift`, `Songs.swift` | `client/src/audio.ts`, `songs.ts` |
| `Shared/HudFeed.swift`, `MicroERacer/UI/HUD.swift`, the watch's `WatchHUD` | `client/src/hud.ts` |
| `Shared/Controls.swift`, `MicroERacer/UI/TouchControls.swift`, `MicroERacer/Pads.swift` | `client/src/input.ts` (touch, and the keys on an iPad's keyboard; `Pads.swift` adds game controllers) |
| `MicroERacer/UI/StartView.swift`, `TrackPick.swift` | the start form in `client/index.html`, `main.ts`, `garage.ts`, `trackmap.ts` |
| `MicroERacer/Practice.swift`, `UI/PracticeView.swift` | `client/src/practice.ts`, and the Practice Ground's settings (`#practice`) in `client/index.html` and `main.ts` |
| `MicroERacer/AppModel.swift` | `client/src/main.ts` |

The threads: the game runs on SceneKit's render thread (`renderer(_:updateAtTime:)`), which also pumps the Colyseus SDK
(`Colyseus.autoPump = false`), so every room callback arrives there between frames. The HUD goes to SwiftUI on the main
thread only when it changes, and the controls hand their state over through a lock (`Controls`).

The look: cel shading in three tones is a SceneKit shader modifier on the lighting (`TOON_LIGHTING` in `Toon.swift`), and the
black outlines are inverted hulls (`outline`), which like the browsers' `OutlineEffect` draw every outlined mesh twice.
A moving camera aims with `look(at:up:localFront:)` and world up, never the one-argument `look(at:)`, which keeps the
camera's own up and so rolls the horizon as it follows the E-Car round corners (three.js's `lookAt` always uses world up).
The static scenery is merged per material with `flattenedClone`, which drops the transform of a node without geometry (a
prop's or a cloud's group), so `buildTrackScene` hands it every mesh at its world transform, not the groups.
SceneKit rather than RealityKit because it can do both, runs on the watch too, is what mech-vs-mech's port uses, and the
scene is small.

## The watch

The same `Game` as on the iPhone, in an Offline Race. The Digital Crown is the steering wheel: turned up it steers right,
and let go it comes back to the middle. The E-Car accelerates by itself. A tap on the screen uses the Item (held, a Zap keeps
firing); while the E-Car is stuck (where the phone would show its Back button), holding the screen reverses instead. Watch
apps can't use the side button, and pressing the Crown always goes home. The wrist is tapped for the countdown, GO, a Ram,
a Hit, a Battery, an Item from a box, a Shield blocking, running dry and the finish (`WatchModel.play`).

## Assets

- The Racers' voices are not copied: the project references `../client/public/voices` as a folder, so both apps bundle the
  very files the browsers load (CC0, credited in its `CREDITS.md`).
- `Shared/Resources/Bangers.woff` is the same Bangers file the browsers get from `@fontsource/bangers` (SIL Open Font
  License, `Bangers-OFL.txt`); CoreText reads WOFF directly.
- The app icons are drawn by `client/share/art.ts`, like the browsers' icon: `npx tsx ios/icon.ts` renders them into both
  asset catalogs. Run it again after changing the art.
- `Shared/Resources/Themes.json` is the scenery of every theme beyond the first four (their props, landmarks, ground and
  sky), and for each of their Tracks where `client/src/themes/staging.ts` put its river, bridge and landmarks, written by
  `npx tsx ios/themes.ts` from the web's own data in `client/src/themes/`. `ThemeData.swift` builds the same parts from it
  as `client/src/props.ts` does in the browsers, and `stagingOf` hands each Track's staging to the scene as it is. `npm test` fails until it is written again after a
  theme changes.
