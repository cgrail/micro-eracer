import Foundation

/// An Offline Race: the server's RaceSim run on this device against Bots, behind the same interface as the room
/// (client/src/offline.ts).
final class OfflineRace: RaceLink {
    let sessionId = "offline"
    private let sim: RaceSim
    private var acc = 0.0

    /// `track`: one Track again and again, or nil for a different one each Race.
    init(name: String, body: BodyKind, track: String? = nil) {
        sim = track.map { RaceSim(trackId: $0, pool: [$0]) } ?? RaceSim()
        sim.join(sessionId, String(name.prefix(16)).isEmpty ? "Player" : String(name.prefix(16)), body)
    }

    func pump(_ dt: Double) {
        // a stall (the app in the background) makes the Race wait rather than race ahead in a burst
        acc = min(acc + dt, DT * 6)
        while acc >= DT { sim.step(DT); acc -= DT }
    }

    func takeState() -> RaceState? { raceState(sim) }
    func takeEvents() -> [RaceEvent] { defer { sim.events = [] }; return sim.events }
    let status = LinkStatus.connected
    func send(_ pose: PoseReport) { sim.setPose(sessionId, pose) }
    func useItem() { if let seat = sim.seats.first(where: { $0.owner == sessionId }) { sim.combat.useItem(seat) } }
    func leave() {}
}
