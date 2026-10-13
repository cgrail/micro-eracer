# Changelog

Everything notable that lands in Micro E-Racer, web and iOS in one list. The two are one product and race in the same Races
([CLAUDE.md](CLAUDE.md)), so a change that only reached one of them is a bug, not an entry.

The version is the iOS app's `MARKETING_VERSION` in [ios/MicroERacer.xcodeproj](ios/MicroERacer.xcodeproj); the web game has no
version of its own and rides whatever the top section says. [ios/WHATS-NEW.md](ios/WHATS-NEW.md) is the player-facing cut of
the same list, written for the App Store when a version ships; this file is the developer's record and is written as the work
happens. Everything before 1.0 is in the git history.

## 1.0 (current)

### Tracks

- 50 Tracks instead of 4: 46 new ones round 18 new places, each with its own ground, sky, Puddles and props, and a few
  landmarks of its own beside the road. Offices at Google (bean bags, the T. rex skeleton, the slide), SAP in Walldorf,
  Facebook (the giant thumbs-up, HACK on the courtyard) and Anthropic (the spark, the bookshelf); a LAN party in the dark
  with glowing screens; a golf course and a soccer field; London (Big Ben, a double-decker, the London Eye, phone boxes,
  a guard), New York (the Empire State Building, the Statue of Liberty, yellow cabs), Paris (the Eiffel Tower, the Arc de
  Triomphe, the Louvre's pyramid, red wine Puddles), Las Vegas (the welcome sign, a black pyramid, dice and chips), a
  grubby Berlin (the Fernsehturm, a Döner stand and Döner, the Brandenburg Gate, a Späti, beer Puddles), Heidelberg (the
  castle, the Old Bridge's gate, the Heiliggeistkirche, the bridge monkey), an Indian kitchen table (thalis, a tandoor,
  curry Puddles), Hollywood (the sign on its hill, searchlights, the Walk of Fame), San Francisco (the Golden Gate, cable
  cars, Painted Ladies), Zuzenhausen (the training ground, tractors, hay) and Sinsheim (the Concorde on its pylon, the
  stadium, the museum). They have bridges, climbs and jumps, and every Body can drive each one flat out.
- Five places are staged round their sights. A river runs under the best straight of each of their Tracks, and the road
  crosses it on that place's own bridge, walled with its railings. In San Francisco it is the bay under the Golden Gate
  (orange towers, cables and hangers), with the piers along the shore (their sheds numbered, sea lions on the boards) and
  the green Marin Headlands on the far side; Lombard Street and Nob Hill are now Pier 39 and Marin Headlands. In
  Heidelberg it is the Neckar under the Alte Brücke (red sandstone arches, and its gate with the two white towers right
  over the road), with the castle a ruin on its hill, the blown-up powder tower beside it; Old Bridge is now Alte Brücke.
  In Zuzenhausen the road crosses the Elsenz on a small bridge, by two soccer pitches with TSG players on them. In
  Sinsheim the TSG Hoffenheim stadium, floodlights on, fills a whole block beside the road. SAP is the Walldorf campus
  now, not offices: the SAP logo, the marble ball, WDF01 and the star buildings among lawns, trees and bikes; Coffee
  Corridor is now Campus Loop. The big sights take a block of tiles of their own, and the Track's picture on the start
  screen shows the river.
- Campus Loop follows the real campus road in Walldorf, round the three star buildings where they stand: down along
  the woods, round WDF19-21 and WDF18, back through the dip between the stars, and past the Charging Station to the
  line. It is 420 m now. The star buildings have six wings with green roofs round a glass dome, as they really do, on
  Walldorf Ring too.
- Training Ground follows the real paths round the TSG's training pitches in Zuzenhausen, and the pitches lie where
  they do there: up Horrenberger Straße past the pond, round the two top pitches, down along the woods and over the
  brook on a humped little bridge, past the big pitch and round the training centre, and back along its car park to the
  line. It is 470 m, the longest Track.
- Every Race's Track, and its place, is named on screen for a few seconds as the grid counts down.
- The four songs take turns across the Tracks.
- Every Track is lighter to draw, which phones and the watch feel most: the walls' edges are rounded in one step instead
  of two, and small balls, thin posts and rings have fewer sides.
- The new places are written as data (`client/src/themes/`), which the browsers build and the apps read from
  `ios/Shared/Resources/Themes.json` (`npx tsx ios/themes.ts`), so both draw the same props.

### Start screen

- Pick the Track as you pick the Body: ◀ and ▶ step through every Track (held, they keep going, faster and faster), the
  picture shows it from above on its ground, and beside it are its place, length, turns, bridges, climbs and jumps.
  Tapping its name lists every Track by place. Any Track, the first choice, joins the fullest Race whatever it races, as
  before; a picked Track joins a Race on that Track, or starts one, and races it again and again. An Offline Race (and
  the watch, which picks it from a list) does the same. The Track is remembered like the rest (`track`).
- The picked Track's picture is the Track itself in 3D, with its scenery, landmarks, rivers and bridges, seen from above
  and turning slowly like the Body on its turntable, starting from behind the start line with a whirl as each Track comes
  up. Any Track keeps its question mark.
- The whole start screen fits on one screen, on phones and tablets in both orientations and on desktops, without
  scrolling: one column standing up, two side by side lying down, and smaller where even that doesn't fit.
- The wire: Races are joined in the `race2` room, which takes the picked Track as `track`. The `race` room is left to apps
  from before the picker and only races the first four Tracks, which they know.

### iPhone and iPad

- **A native app for iPhone and iPad** ([ios/](ios/)), in Swift with SceneKit. It joins the same Races on the same server
  as the browsers (`wss://micro.grails.de`, the same rooms), so phones and browsers race each other, and falls back
  to an Offline Race against the Bots when the server can't be reached within 5 seconds, as the browser does.
- It drives exactly like the browsers: `shared/src` is ported file by file to `ios/Core`, and `swift test`
  replays the physics fixture, compares the Track data and the soundtrack with the TypeScript, and runs a headless Race in
  which 8 Bots finish on every Track.
- The E-Car accelerates by itself. A thumb steers anywhere on the screen (Buttons: left or right of the steering pad's
  middle; Slider: drag), the one action button right above the pad uses the Item (held, a Zap keeps firing), and a Back
  button for reversing shows only while the E-Car is stuck: the same controls as a phone's browser.
- The same start screen (Nickname, the Body on its turntable with its stat bars, the Track, Controls, Play), HUD, cel-shaded look
  with black outlines, themed scenery, drones, Item Boxes and weapons, synthesised sounds and soundtrack, and the Racers'
  voices. Name, Body, Steering, Pad and Sound are remembered under the same names as in the browser.
- On an iPad with a hardware keyboard, the browsers' desktop keys work: arrows or WASD drive, Space, E or Shift uses the
  Item, and Space held keeps a Zap firing. A game controller works too: the left stick or the d-pad steers, the right
  trigger (or A) accelerates, the left trigger (or B) brakes and reverses, and X or the right shoulder uses the Item.
  Whatever was used last drives: keys and controllers have no auto-throttle (as on a desktop), and touching the screen
  brings it back. Return in the Nickname field plays, as Enter does in the browser.
- Two buttons under the Lap counter: the sound switch, and ✕ to leave the Race and go back to the start screen (in a
  browser, that's the back button).
- The app icon, like the browser tab's and the home screen's, is a picture: a purple E-Car racing past Batteries under
  MICRO E-RACER and lightning, with a Missile and a Mine, in a blue frame.
- The browsers' faint halftone dot screen lies over the game, under the HUD, on iPhone, iPad and the watch.
- Not on iOS: the desktop map (a phone's browser doesn't show it either).

### Touch controls

- The steering pad shows only its steering wheel, which turns as the thumb steers, with Slider and with Buttons steering
  alike, in the browser and in the app. With Buttons, a line splits the pad into its left and right halves, and the held
  one lights up.
- The whole screen steers but for its buttons, not only the pad: with Buttons, a thumb anywhere left of the pad's middle
  steers left and anywhere right of it steers right; with Slider, a drag steers from wherever it starts. The first finger
  down steers until it lifts.
- In the app, a thumb that just touches the screen steers at once, and one that just touches the action button or Back
  presses it, as in the browser, instead of only once it slides. During a Race, the swipes from the screen's edges (home,
  Control Center) take two swipes, so a thumb near an edge isn't held back either.
- Buttons is the steering a new Player starts with (a Steering picked before stays picked).
- The action button sits right above the steering pad, and Back, while the E-Car is stuck, in the other bottom corner.
  Pad puts the steering pad, with the action button, in the bottom-left or the bottom-right corner, and is remembered
  like the rest.
- Steering and Pad are set on the Practice Ground: Controls on the start screen (on phones and tablets, and in
  the app), which says how they are set, opens it. The picked Body drives on an endless lawn with streets painted on it,
  crossroads and zebra crossings, and nothing to bump into, under the same touch controls as in a Race, with Steering and
  Pad over it (and a hint on how the picked steering works). A pick takes effect at once, so Buttons and Slider, and the
  pad in either corner, can be felt by driving round; the action button fires Zap Shots without end. Done goes back to the
  start screen, and every pick is remembered as it is made.

### Phones and tablets in the browser

- The page never zooms, neither by pinching nor by a quick second tap anywhere (the steering pad, its wheel, a button's
  label). Text can't be selected anywhere but the Nickname field, and a long press opens no menu. Tapping ◀ or ▶
  quickly on the start screen steps through every Body instead of skipping every other tap. On a desktop, a trackpad pinch,
  Ctrl + wheel and Ctrl or Cmd with + or − don't zoom the game either.

### Apple Watch

- **An Apple Watch app**, inside the iPhone app and also on its own: the same game in an Offline Race against 7 Bots.
  The watch can't race online (watchOS has no build of the Colyseus SDK and allows web sockets only to audio-streaming
  apps).
- The Digital Crown is the steering wheel: turned up it steers right, and let go it holds the turn for a moment, then
  comes back to the middle. A short turn reaches full lock, turned on past it the steering stays at full lock, and turning
  back straightens up at once (it never swings over to the other side). A finger on the screen steers too, as the phone's
  Buttons do: full lock left on its left half, right on its right half, and it can rock from one to the other without
  lifting. The E-Car accelerates by itself. The action button in the top right corner shows the Item and uses it (held, a
  Zap keeps firing). An E-Car stuck for two and a half seconds (nose on a wall, or spun round against one) is put back on
  the road where it is, facing the right way, instead of reversing. Watch apps can't use the side button, and pressing
  the Crown always goes home.
- A small HUD (Position, Lap, the Energy bar, the countdown and messages, the results; the Item is on the action
  button), and taps on the wrist for the countdown and GO, a Ram, a Hit, a Battery, an Item from a box, a Shield
  blocking, running dry and the finish.
- The start screen is a list of the Nickname, the Body, the Track and the sound switch, the way watch apps lay out their
  settings: the Body and the Track each open a list to pick from. The back button leaves the Race.
