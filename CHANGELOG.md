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
- The E-Car accelerates by itself. A thumb steers anywhere on the screen (Buttons: left or right of the steering pad's
  middle; Slider: drag), the one action button right above the pad uses the Item (held, a Zap keeps firing), and a Back
  button for reversing shows only while the E-Car is stuck: the same controls as a phone's browser.
- The same start screen (Nickname, the Body on its turntable with its stat bars, Steering, Pad, Play), HUD, cel-shaded look
  with black outlines, themed scenery, drones, Item Boxes and weapons, synthesised sounds and soundtrack, and the Racers'
  voices. Name, Body, Steering, Pad and Sound are remembered under the same names as in the browser.
- On an iPad with a hardware keyboard, the browsers' desktop keys work: arrows or WASD drive, Space, E or Shift uses the
  Item, and Space held keeps a Zap firing. A game controller works too: the left stick or the d-pad steers, the right
  trigger (or A) accelerates, the left trigger (or B) brakes and reverses, and X or the right shoulder uses the Item.
  Whatever was used last drives: keys and controllers have no auto-throttle (as on a desktop), and touching the screen
  brings it back. Return in the Nickname field plays, as Enter does in the browser.
- Two buttons under the Lap counter: the sound switch, and ✕ to leave the Race and go back to the start screen (in a
  browser, that's the back button).
- The app icon is the browser tab's lightning bolt, drawn from the same code (`client/share/art.ts`).
- The browsers' faint halftone dot screen lies over the game, under the HUD, on iPhone, iPad and the watch.
- Not on iOS: the desktop map (a phone's browser doesn't show it either).

### Touch controls

- The steering pad shows only its steering wheel, which turns as the thumb steers, with Slider and with Buttons steering
  alike, in the browser and in the app. With Buttons, a line splits the pad into its left and right halves, and the held
  one lights up.
- The whole screen steers but for its buttons, not only the pad: with Buttons, a thumb anywhere left of the pad's middle
  steers left and anywhere right of it steers right; with Slider, a drag steers from wherever it starts. The first finger
  down steers until it lifts.
- Buttons is the steering a new Player starts with (a Steering picked before stays picked).
- The action button sits right above the steering pad, and Back, while the E-Car is stuck, in the other bottom corner.
  Pad on the start screen puts the steering pad, with the action button, in the bottom-left or the bottom-right corner,
  and is remembered like the rest.

### Phones and tablets in the browser

- The page never zooms, neither by pinching nor by a quick second tap anywhere (the steering pad, its wheel, a button's
  label). Text can't be selected anywhere but the Nickname field, and a long press opens no menu. Tapping ◀ or ▶
  quickly on the start screen steps through every Body instead of skipping every other tap. On a desktop, a trackpad pinch,
  Ctrl + wheel and Ctrl or Cmd with + or − don't zoom the game either.

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
