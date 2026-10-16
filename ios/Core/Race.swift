import Foundation

// shared/src/race.ts: one Race and everything the server owns in it. The app runs it for an Offline Race.

let SEATS = 8
let LAPS = 3
let FIRST_GRID_TIME = 3.0
let GRID_TIME = 3.0
let FINISH_TIME = 5.0
/// Out of Energy: first Stranded on the spot while a drone flies in, then Recharged by it where it stands.
let STRANDED_TIME = 1.6
private let RESPAWN_LOCK = 1.0
/// A full Roadster battery lasts this many Laps of driving, on every Track.
private let TANK_LAPS = 1.6
/// Energy per second in the Charging Station.
private let STATION_RATE = 35.0

enum Phase: String { case grid, racing, finishing }

final class Seat {
    let index: Int
    var name: String
    var kind: BodyKind
    /// Player session id, "" while a Bot holds the Seat.
    var owner: String
    var car: Car
    var progress: Progress
    var position: Int
    var finished = false, finishTime = 0.0
    var energy = MAX_ENERGY
    var item: ItemKind?
    /// Shots left in a Zap.
    var ammo = 0
    var shield = false
    var nextShotAt = 0.0, lockedUntil = 0.0, strandedUntil = 0.0, rechargeUntil = 0.0
    /// How long the current Recharge takes (`rechargeLength`).
    var rechargeLength = RECHARGE_TIME
    /// Times the top speed; below 1 for a Leader far ahead (`leadPace`).
    var pace = 1.0
    /// How long it has been resting on another E-Car (`unstack`).
    var stackedFor = 0.0
    /// Bumped whenever the E-Car is moved by the race itself, so its driver knows to jump there.
    var spawn: Int
    var vx = 0.0, vz = 0.0, lastX: Double, lastZ: Double

    init(index: Int, name: String, kind: BodyKind, owner: String, car: Car, progress: Progress, position: Int, spawn: Int, at: Pose) {
        self.index = index; self.name = name; self.kind = kind; self.owner = owner; self.car = car
        self.progress = progress; self.position = position; self.spawn = spawn; lastX = at.x; lastZ = at.z
    }
}

struct Battery { let id: Int; let x, y, z: Double; let idx: Int; let until: Double }
struct PoseReport { let x, y, z, yaw, vx, vz: Double; let spawn: Int }

/// Things that happened this tick, for sounds and effects. `s` is a Seat index (see `RaceEvent` in race.ts).
enum RaceEvent {
    case ram(a: Int, b: Int, n: Int, ix: Double, iz: Double, spin: Double)
    case hit(s: Int, by: Int, kind: HitKind, ix: Double, iz: Double, hop: Double, spin: Double)
    case boom(x: Double, z: Double)
    case block(s: Int), battery(s: Int), shot(s: Int), stranded(s: Int), recharge(s: Int)
    case box(s: Int, item: ItemKind), item(s: Int, item: ItemKind)
    /// A Player took over a Bot's Seat (`join`), or a Bot took over from a Player who left (`leave`); `was` is who had it.
    case join(s: Int, name: String, was: String), leave(s: Int, name: String, was: String)
}

/// A Bot's name always starts with the robot, so nobody takes one for a Player.
private let BOT_NAMES = ["Sparky", "Volty", "Amp Champ", "Ohmigosh", "Zappy", "Coily", "Fuse Box", "Watt-Ever", "Plugsy", "Lithia"]
let BOT = "🤖"
private func botName(_ i: Int) -> String { "\(BOT) \(BOT_NAMES[i % BOT_NAMES.count])" }

final class RaceSim {
    private(set) var track: Track!
    private(set) var world: World!
    private(set) var seats: [Seat] = []
    var batteries: [Battery] = []
    private(set) var phase = Phase.grid
    private(set) var timer = FIRST_GRID_TIME
    private(set) var time = 0.0
    /// When the current Race left the grid; Bots hold off attacking for a moment after the start.
    private(set) var startedAt = Double.infinity
    private(set) var results: [String] = []
    private(set) var combat: Combat!
    var events: [RaceEvent] = []
    /// Counters for tests and tuning.
    var stats = (recharges: 0, leaderRecharges: 0, pickups: 0, rams: 0, hits: 0)
    /// Multiplies the Energy drain; only for trying out running dry.
    var drainScale = 1.0
    /// Kept by Energy.swift.
    var nextBatteryAt = 0.0, batteryId = 0
    /// Per pair of Seats, when they can next Ram each other (Contact.swift).
    var ramCooldown: [Int: Double] = [:]

    /// The Tracks the next Races are picked from, a different one each time while there is more than one.
    let pool: [String]
    /// Each next Race on the pool's next Track (a picked Track goes on through the list), else on one at random.
    let ordered: Bool

    init(trackId: String? = nil, pool: [String] = TRACKS.map(\.id), ordered: Bool = false) {
        self.pool = pool
        self.ordered = ordered
        newRace(FIRST_GRID_TIME, trackId)
    }

    func newRace(_ gridTime: Double, _ trackId: String? = nil) {
        let pool = TRACKS.filter { self.pool.contains($0.id) }, at = pool.firstIndex { $0.id == track?.def.id } ?? -1
        let next = pool.isEmpty ? nil : pool[(at + 1) % pool.count]
        let def = TRACKS.first { $0.id == trackId } ?? (ordered ? next : pool.filter { $0.id != track?.def.id }.randomElement()) ?? pool.first ?? TRACKS[0]
        track = buildTrack(def)
        world = createTrackWorld(track)
        combat = Combat(self)
        batteries = []
        let prevSeats = seats
        seats = Array(0..<SEATS).shuffled().enumerated().map { i, slot in
            let prev = i < prevSeats.count ? prevSeats[i] : nil
            let kind = prev?.kind ?? BODY_KINDS.randomElement()!, owner = prev?.owner ?? ""
            let pose = gridPose(track, slot)
            return Seat(index: i, name: prev?.name ?? botName(i), kind: kind, owner: owner, car: createCar(world, kind, pose, owner.isEmpty),
                        progress: startProgress(track, nearestSample(track, pose.x, pose.y, pose.z)), position: i + 1, spawn: (prev?.spawn ?? 0) + 1, at: pose)
        }
        phase = .grid
        timer = gridTime
        startedAt = .infinity
    }

    /// A joining Player takes over the last-Position Bot's E-Car where it is. Returns nil when every Seat has a Player.
    @discardableResult
    func join(_ owner: String, _ name: String, _ kind: BodyKind) -> Seat? {
        guard let seat = seats.filter({ $0.owner.isEmpty }).max(by: { $0.position < $1.position }) else { return nil }
        let v = seat.car.rb.linvel
        // only Bots wear the robot
        let clean = name.replacingOccurrences(of: BOT, with: "").trimmingCharacters(in: .whitespaces)
        let shown = clean.isEmpty ? "Player" : clean
        emit(.join(s: seat.index, name: shown, was: seat.name))
        seat.owner = owner; seat.name = shown; seat.kind = kind; seat.vx = v.x; seat.vz = v.z
        replaceCar(seat, dynamic: false)
        return seat
    }

    /// A Bot takes over the E-Car of a Player who leaves.
    func leave(_ owner: String) {
        guard let seat = seats.first(where: { $0.owner == owner }) else { return }
        emit(.leave(s: seat.index, name: botName(seat.index), was: seat.name))
        seat.owner = ""; seat.name = botName(seat.index)
        replaceCar(seat, dynamic: true)
    }

    func setPose(_ owner: String, _ report: PoseReport) {
        // poses sent before the driver saw the latest jump are stale
        guard let seat = seats.first(where: { $0.owner == owner }), report.spawn == seat.spawn else { return }
        setKinematicPose(seat.car, Pose(x: report.x, y: report.y, z: report.z, yaw: report.yaw))
        seat.vx = report.vx
        seat.vz = report.vz
    }

    func isRecharging(_ s: Seat) -> Bool { time < s.rechargeUntil }
    func isStranded(_ s: Seat) -> Bool { time < s.strandedUntil }
    func canAct(_ s: Seat) -> Bool { phase != .grid && !isRecharging(s) && !isStranded(s) }
    func botsAttack() -> Bool { time > startedAt + 4 }
    func emit(_ e: RaceEvent) { events.append(e) }

    func step(_ dt: Double) {
        time += dt
        let live = phase != .grid
        for s in seats where s.owner.isEmpty {
            let t = s.car.rb.translation
            let locked = !live || time < s.lockedUntil || isRecharging(s)
            let input = isStranded(s) || isRecharging(s) ? HALT : locked ? NO_INPUT : botInput(self, s)
            let pit = inStation(track, s.progress.idx, t.x, t.z) ? PIT_SPEED : 1
            driveCar(world, s.car, input, live ? catchUp(s) * limpScale(s.energy) * pit * s.pace : 1, inPuddle(track, t.x, t.y, t.z))
            if !locked && canAct(s) { combat.botTurn(s) }
        }
        world.step()
        // uses the velocities from before this step, i.e. how the E-Cars came into the contact
        if live { judgeRams(self); combat.step(dt) }
        unstack(self, dt)

        for s in seats {
            let t = s.car.rb.translation
            if s.owner.isEmpty {
                let v = s.car.rb.linvel
                s.vx = v.x; s.vz = v.z
                if t.y < track.samples[s.progress.idx].y + FALL_Y {
                    teleport(s.car, resetToCheckpoint(track, &s.progress, seats.filter { $0 !== s }.map { $0.car.rb.translation }))
                    s.lockedUntil = time + RESPAWN_LOCK
                    s.lastX = s.car.rb.x; s.lastZ = s.car.rb.z
                    continue
                }
            }
            let moved = hypot(t.x - s.lastX, t.z - s.lastZ)
            // jumps (Fall-off resets) are not driving
            if live && !s.finished && moved < 2 { s.energy = max(0, s.energy - moved * MAX_ENERGY * drainScale / (TANK_LAPS * s.kind.spec.tank * Double(track.n))) }
            if live && inStation(track, s.progress.idx, t.x, t.z) { s.energy = min(MAX_ENERGY, s.energy + STATION_RATE * dt) }
            s.lastX = t.x; s.lastZ = t.z
            updateProgress(track, &s.progress, t.x, t.z)
            if live && !s.finished && s.progress.u >= LAPS * track.n {
                s.finished = true
                s.finishTime = time
                if phase == .racing { phase = .finishing; timer = FINISH_TIME }
            }
        }

        let ranked = seats.sorted { a, b in
            a.finished != b.finished ? a.finished : a.finished ? a.finishTime < b.finishTime : b.progress.u < a.progress.u
        }
        for (i, s) in ranked.enumerated() { s.position = i + 1 }
        if live {
            updateBatteries(self, ranked)
            leadPace(ranked)
            for s in seats {
                if s.strandedUntil > 0 && !isStranded(s) {
                    s.strandedUntil = 0
                    s.rechargeLength = rechargeLength(s, ranked)
                    s.rechargeUntil = time + s.rechargeLength
                    stats.recharges += 1
                    emit(.recharge(s: s.index))
                }
                // the drone fills the battery up over the Recharge, so the Energy bar can be seen filling
                if isRecharging(s) { s.energy = MAX_ENERGY * (1 - (s.rechargeUntil - time) / s.rechargeLength) } else if s.energy <= 0 && !s.finished && s.strandedUntil == 0 {
                    s.strandedUntil = time + STRANDED_TIME
                    if s.position == 1 { stats.leaderRecharges += 1 }
                    emit(.stranded(s: s.index))
                }
            }
        }

        if phase == .racing { return }
        timer -= dt
        if timer > 0 { return }
        if phase == .grid { phase = .racing; startedAt = time } else { results = ranked.map { $0.name }; newRace(GRID_TIME) }
    }

    func lap(_ s: Seat) -> Int { Int(clamp(Double(lapOf(track, s.progress)), 1, Double(LAPS))) }

    /// Bots stay close to the Players: faster when far behind the nearest one, slower when far ahead.
    private func catchUp(_ bot: Seat) -> Double {
        var gap = Double.infinity
        for p in seats where !p.owner.isEmpty && abs(Double(bot.progress.u - p.progress.u)) < abs(gap) { gap = Double(bot.progress.u - p.progress.u) }
        return gap == .infinity ? 1 : clamp(1 - gap / 80, 0.7, 1.3)
    }

    private func replaceCar(_ seat: Seat, dynamic: Bool) {
        let t = seat.car.rb.translation, pose = Pose(x: t.x, y: t.y, z: t.z, yaw: seat.car.rb.yaw)
        world.remove(seat.car.rb)
        seat.car = createCar(world, seat.kind, pose, dynamic)
        if dynamic { teleport(seat.car, pose, seat.vx, seat.vz) }
        seat.spawn += 1
    }
}
