import Foundation

// shared/src/snapshot.ts and client/src/state.ts: the Race as the screen sees it, whether it comes from the server's room
// (`OnlineRace`, reading the schema in server/src/RaceRoom.ts) or from a `RaceSim` on this device (`OfflineRace`).

/// `CarState.mode`
let DRIVING = 0, STRANDED = 1, RECHARGE = 2

/// One Seat, as `CarState` in RaceRoom.ts.
struct CarState {
    var name = "", body = BodyKind.roadster, owner = ""
    var x = 0.0, y = 0.0, z = 0.0, yaw = 0.0, vx = 0.0, vz = 0.0
    var lap = 1, position = 0, finished = false, spawn = 0, energy = 100
    var mode = DRIVING, item = "", ammo = 0, shield = false
    /// Percent of top speed: a Leader far ahead is slowed so the others can catch up.
    var pace = 100
}
struct Spot { let id: Int; let x, y, z: Double }
struct BoltState { let id: Int; let kind: String; let x, y, z, vx, vz: Double }

struct RaceState {
    var phase = Phase.grid, timer = 0.0, trackId = ""
    var cars: [CarState] = [], results: [String] = [], batteries: [Spot] = [], bolts: [BoltState] = [], mines: [Spot] = [], boxes: [Bool] = []
    /// The Race's Track as the room sends it, so it is the server's even where this app has none like it; nil from a server
    /// from before it sent one.
    var track: TrackDef? = nil
}

/// The Race running online, as the start screen sees it (`GET /race`): only the first Player picks a Track, and everyone
/// after them sees this one and joins it. `players`: the names of the Players in it, without its Bots.
struct RunningRace: Equatable {
    let track: TrackDef
    let players: [String]
}

/// A Seat as the screens see it, in the room state and in an Offline Race alike.
func seatState(_ sim: RaceSim, _ s: Seat) -> CarState {
    let rb = s.car.rb
    return CarState(name: s.name, body: s.kind, owner: s.owner, x: rb.x, y: rb.y, z: rb.z, yaw: rb.yaw, vx: s.vx, vz: s.vz,
                    lap: sim.lap(s), position: s.position, finished: s.finished, spawn: s.spawn, energy: Int(s.energy.rounded(.up)),
                    mode: sim.isStranded(s) ? STRANDED : sim.isRecharging(s) ? RECHARGE : DRIVING, item: s.item?.rawValue ?? "", ammo: s.ammo,
                    shield: s.shield, pace: Int((s.pace * 100).rounded()))
}

/// The whole Race as the room would send it.
func raceState(_ sim: RaceSim) -> RaceState {
    RaceState(phase: sim.phase, timer: max(0, sim.timer), trackId: sim.track.def.id, cars: sim.seats.map { seatState(sim, $0) }, results: sim.results,
              batteries: sim.batteries.map { Spot(id: $0.id, x: $0.x, y: $0.y, z: $0.z) },
              bolts: sim.combat.bolts.map { BoltState(id: $0.id, kind: $0.kind.rawValue, x: $0.x, y: $0.y, z: $0.z, vx: $0.vx, vz: $0.vz) },
              mines: sim.combat.mines.map { Spot(id: $0.id, x: $0.x, y: $0.y, z: $0.z) }, boxes: sim.combat.out, track: sim.track.def)
}
