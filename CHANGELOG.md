# Changelog

Everything notable that lands in Micro E-Racer, web and iOS in one list. The two are one product and race in the same Races
([CLAUDE.md](CLAUDE.md)), so a change that only reached one of them is a bug, not an entry.

The version is the iOS app's `MARKETING_VERSION` in [ios/MicroERacer.xcodeproj](ios/MicroERacer.xcodeproj); the web game has no
version of its own and rides whatever the top section says. [ios/WHATS-NEW.md](ios/WHATS-NEW.md) is the player-facing cut of
the same list, written for the App Store when a version ships; this file is the developer's record and is written as the work
happens. Everything before 1.0 is in the git history.

## 1.0 (current)

### iPhone and iPad

- **A native app for iPhone and iPad** ([ios/](ios/)), in Swift with SceneKit. It joins the same Races on the same server
  as the browsers (`wss://micro.grails.de`, the same `race` room), so phones and browsers race each other, and falls back
  to an Offline Race against the Bots when the server can't be reached within 5 seconds, as the browser does.
- It drives exactly like the browsers: `shared/src` is ported file by file to `ios/Core`, and `swift test`
  replays the physics fixture, compares the Track data and the soundtrack with the TypeScript, and runs a headless Race in
  which 8 Bots finish on every Track.
- The E-Car accelerates by itself. The left thumb steers on the pad (Slider: drag; Buttons: hold its ◀ or ▶ half, picked
  on the start screen), the right thumb has the one action button that uses the Item (held, a Zap keeps firing), and a
  Back button for reversing shows only while the E-Car is stuck: the same controls as a phone's browser.
- The same start screen (Nickname, the Body on its turntable with its stat bars, Steering, Play), HUD, cel-shaded look with
  black outlines, themed scenery, drones, Item Boxes and weapons, synthesised sounds and soundtrack, and the Racers' voices.
  Name, Body, Steering and Sound are remembered under the same names as in the browser.
- On an iPad with a hardware keyboard, the browsers' desktop keys work: arrows or WASD drive, Space, E or Shift uses the
  Item, and Space held keeps a Zap firing. A game controller works too: the left stick or the d-pad steers, the right
  trigger (or A) accelerates, the left trigger (or B) brakes and reverses, and X or the right shoulder uses the Item.
  Whatever was used last drives: keys and controllers have no auto-throttle (as on a desktop), and touching the pad or
  the action button brings it back. Return in the Nickname field plays, as Enter does in the browser.
- Two buttons under the Lap counter: the sound switch, and ✕ to leave the Race and go back to the start screen (in a
  browser, that's the back button).
- The app icon is the browser tab's lightning bolt, drawn from the same code (`client/share/art.ts`).
- Not on iOS yet: the halftone overlay, and the desktop map (a phone's browser doesn't show it either).

### Apple Watch

- **An Apple Watch app**, inside the iPhone app and also on its own: the same game in an Offline Race against 7 Bots.
  The watch can't race online (watchOS has no build of the Colyseus SDK and allows web sockets only to audio-streaming
  apps).
- The Digital Crown is the steering wheel: turned up it steers right, and let go it comes back to the middle. The E-Car
  accelerates by itself. A tap on the screen uses the Item (held, a Zap keeps firing), and while the E-Car is stuck,
  holding the screen reverses. Watch apps can't use the side button, and pressing the Crown always goes home.
- A small HUD (Position, Item, Lap, the Energy bar, the countdown and messages, the results), and taps on the wrist for
  the countdown and GO, a Ram, a Hit, a Battery, an Item from a box, a Shield blocking, running dry and the finish.
- The start screen has the Nickname, the Body and the sound switch; the back button leaves the Race.
