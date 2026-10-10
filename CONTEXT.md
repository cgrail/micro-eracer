# Micro E-Racer

A multiplayer 3D racing web game in the spirit of Micro Machines, played with electric cars on small tracks in desktop and mobile browsers.

## Language

### Racing

**Race**:
A lap race of eight E-Cars on one Track. The first Racer to finish the last Lap wins, the Race ends 7 seconds later, and the next Race starts 5 seconds after that on a random Track.
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
A computer-controlled Racer that races, shoots and Rams like a Player and stays close to the Players. Its name always starts with 🤖, so nobody mistakes it for a Player.
_Avoid_: AI, NPC, CPU

**E-Car**:
The electric car a Racer drives.
_Avoid_: Kart, vehicle

**Body**:
Which kind of E-Car a Racer drives: a Roadster, SUV, Microbus, Pickup or Semi. Each drives differently, from quick and light to slow and heavy with a big battery, but any of them can win.
_Avoid_: Model, class, skin

**Offline Race**:
A Race against Bots that runs entirely in the browser, used only when no server is reachable.
_Avoid_: Single player, practice mode

**Position**:
A Racer's current rank in the Race, from first to last.
_Avoid_: Place, rank

**Leader**:
The Racer in first Position. A Leader far ahead of the rest is slowed down a little so the others can catch up.
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
An E-Car dropping off the Track's edge, or off a bridge onto the road below; it is put back at the last Checkpoint it passed.
_Avoid_: Crash, out of bounds

### Energy

**Energy**:
An E-Car's charge level, drained by distance driven and by Hits; when it runs out, the E-Car is Stranded until a drone Recharges it.
_Avoid_: Fuel, health, HP

**Limp Mode**:
The reduced top speed of an E-Car whose Energy is low.
_Avoid_: Low battery, slowdown

**Battery**:
A pickup that instantly adds Energy; Batteries keep appearing just ahead of Racers, plenty at the back of the field and hardly any at the front.
_Avoid_: Power-up, coin, item

**Charging Station**:
A bay beside the road on the last straights before the finish line where an E-Car charges quickly while it drives through, under a speed limit; a detour that costs time, for a Racer who can't find a Battery.
_Avoid_: Pit stop, gas station, charger

**Stranded**:
The moment after an E-Car's Energy runs out: it jerks to a halt on the spot, unable to drive, while a drone flies in to Recharge it.
_Avoid_: Dead, broken down

**Recharge**:
What follows being Stranded: a drone hovers over the E-Car and charges it to full Energy where it stands; it can't drive until the drone is done. The time lost standing is the price of running dry; near the front the drone takes until a few Racers have got past (three for the Leader).
_Avoid_: Airlift, respawn, reset

**Ram**:
A hard hit by one E-Car into another that moves Energy from the hit E-Car to the rammer.
_Avoid_: Crash, bump, steal

### Combat

**Hit**:
A Shot, Missile or Mine striking an E-Car; it drains Energy and throws the E-Car around.
_Avoid_: Damage

**Shot**:
One fire of a Zap, flying straight ahead.
_Avoid_: Bullet, laser

**Zap**:
The commonest Item: five Shots, fired one per press or rapidly while held.
_Avoid_: Gun, ammo pack

**Item Box**:
A pickup at a fixed spot on the Track that gives a Racer without an Item one random Item, and comes back a few seconds after being taken. Only Racers from fourth place back get one; for the top three it stays where it is, for those behind.
_Avoid_: Mystery box, crate

**Item**:
A goodie from an Item Box: a Zap, a Missile, a Mine or a Shield. Without one an E-Car can't shoot.
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
