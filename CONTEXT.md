# Micro E-Racer

A multiplayer 3D racing web game in the spirit of Micro Machines, played with electric cars on small tracks in desktop and mobile browsers.

## Language

### Racing

**Race**:
A lap race of eight E-Cars on one Track. The first Racer to finish the last Lap wins, the Race ends 10 seconds later, and the next Race starts 5 seconds after that on a random Track.
_Avoid_: Match, round, game

**Seat**:
One of the eight places in a Race, held by a Player or a Bot. A joining Player takes over a Bot's Seat, and a Bot takes over the Seat of a Player who leaves.
_Avoid_: Slot

**Quick Play**:
Joining a Race with a free Seat by entering only a nickname and picking a Body. Mid-Race, the Player takes over the last-Position Bot's E-Car where it is.
_Avoid_: Matchmaking, lobby

**Racer**:
Anyone taking part in a Race, either a Player or a Bot.
_Avoid_: Enemy, opponent, participant

**Player**:
A human Racer.
_Avoid_: User, client

**Bot**:
A computer-controlled Racer that races, shoots and Rams like a Player and stays close to the Players.
_Avoid_: AI, NPC, CPU

**E-Car**:
The electric car a Racer drives.
_Avoid_: Kart, vehicle

**Body**:
Which kind of E-Car a Racer drives, a Microbus or a Roadster; the two drive differently, but either can win.
_Avoid_: Model, class, skin

**Offline Race**:
A Race against Bots that runs entirely in the browser, used only when no server is reachable.
_Avoid_: Single player, practice mode

**Position**:
A Racer's current rank in the Race, from first to last.
_Avoid_: Place, rank

**Leader**:
The Racer in first Position.
_Avoid_: Pole position, first place

### Track

**Track**:
A small circuit, with ramps, jumps and bridges, that every E-Car must follow; driving off its edge is a Fall-off.
_Avoid_: Map, level, course

**Lap**:
One full trip around the Track that passes every Checkpoint in order.
_Avoid_: Round

**Checkpoint**:
A marked point on the Track that every Lap must pass, in order, so that shortcuts don't count.
_Avoid_: Gate, waypoint

**Puddle**:
A patch of water (or spilled coffee) on the Track that splashes, slows E-Cars down and makes them slide.
_Avoid_: Water hazard, oil slick

**Drift**:
A sideways slide when an E-Car turns hard at speed; its only reward is a faster line through the corner.
_Avoid_: Powerslide

**Fall-off**:
An E-Car dropping off the Track's edge; it is put back at the last Checkpoint it passed.
_Avoid_: Crash, out of bounds

### Energy

**Energy**:
An E-Car's charge level, drained by distance driven, by shooting and by Hits; when it runs out, the E-Car is Airlifted.
_Avoid_: Fuel, health, HP

**Limp Mode**:
The reduced top speed of an E-Car whose Energy is low.
_Avoid_: Low battery, slowdown

**Battery**:
A pickup that instantly adds Energy; Batteries keep appearing on the Track just ahead of the trailing Racers.
_Avoid_: Power-up, coin, item

**Airlift**:
What happens when an E-Car's Energy runs out: a drone sets it down just behind the last Racer, on that Racer's Lap, with full Energy. A Racer already in last Position is only recharged.
_Avoid_: Respawn, reset

**Ram**:
A hard hit by one E-Car into another that moves Energy from the hit E-Car to the rammer.
_Avoid_: Crash, bump, steal

### Combat

**Hit**:
A Shot, Missile or Mine striking an E-Car; it drains Energy and throws the E-Car around.
_Avoid_: Damage

**Shot**:
A fire from the weapon built into every E-Car; it costs the shooter Energy.
_Avoid_: Bullet, laser

**Item Box**:
A pickup on the Track that gives a Racer one random Item.
_Avoid_: Mystery box, crate

**Item**:
A one-use weapon from an Item Box: a Missile, a Mine or a Shield.
_Avoid_: Power-up, pickup

**Missile**:
An Item that homes in on the Racer ahead.
_Avoid_: Rocket

**Mine**:
An Item dropped behind an E-Car that hits whoever drives over it.
_Avoid_: Oil slick, trap

**Shield**:
An Item that blocks the next Hit or Ram.
_Avoid_: Bubble, armor
