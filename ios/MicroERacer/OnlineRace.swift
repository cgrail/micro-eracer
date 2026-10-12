import Colyseus
import Foundation

/// The room state as server/src/RaceRoom.ts declares it. The SDK decodes it from the server's own reflection; these only
/// read it by field name, so a renamed field there reads as its default here.
final class CarSchema: SchemaRef, @unchecked Sendable {
    var state: CarState {
        CarState(name: view.string("name") ?? "", body: BodyKind(rawValue: view.string("body") ?? "") ?? .roadster, owner: view.string("owner") ?? "",
                 x: view["x"], y: view["y"], z: view["z"], yaw: view["yaw"], vx: view["vx"], vz: view["vz"],
                 lap: Int(view["lap"]), position: Int(view["position"]), finished: view.bool("finished"), spawn: Int(view["spawn"]),
                 energy: Int(view["energy"]), mode: Int(view["mode"]), item: view.string("item") ?? "", ammo: Int(view["ammo"]),
                 shield: view.bool("shield"), pace: Int(view["pace"]))
    }
}
final class SpotSchema: SchemaRef, @unchecked Sendable {
    var spot: Spot { Spot(id: Int(view["id"]), x: view["x"], y: view["y"], z: view["z"]) }
    var bolt: BoltState { BoltState(id: Int(view["id"]), kind: view.string("kind") ?? "shot", x: view["x"], y: view["y"], z: view["z"], vx: view["vx"], vz: view["vz"]) }
}
final class RaceRoomState: SchemaRef, @unchecked Sendable {
    var state: RaceState {
        RaceState(phase: Phase(rawValue: view.string("phase") ?? "") ?? .grid, timer: view["timer"], trackId: view.string("trackId") ?? "",
                  cars: arrayOf("cars", CarSchema.self).values.map(\.state), results: arrayOf("results", String.self).values,
                  batteries: arrayOf("batteries", SpotSchema.self).values.map(\.spot), bolts: arrayOf("bolts", SpotSchema.self).values.map(\.bolt),
                  mines: arrayOf("mines", SpotSchema.self).values.map(\.spot), boxes: arrayOf("boxes", Bool.self).values)
    }
}

/// A Race on the server: the same `race2` room the browsers join, so phones and browsers race each other.
final class OnlineRace: RaceLink {
    private let room: Colyseus.Room<RaceRoomState>
    private var fresh = false, events: [RaceEvent] = []
    private(set) var status = LinkStatus.connected
    private var subscriptions: [Any] = []

    var sessionId: String { room.sessionId ?? "" }

    /// The game pumps the SDK from its own loop, so every callback arrives on that thread, between frames.
    /// `track`: a picked Track joins a Race on it, "" (any Track) the fullest Race there is. The `race` room is left to apps from
    /// before the Track picker, which know only the first four Tracks.
    static func join(endpoint: String, name: String, body: BodyKind, track: String) async throws -> OnlineRace {
        Colyseus.autoPump = false
        let client = try Colyseus.Client(endpoint: endpoint)
        let room: Colyseus.Room<RaceRoomState>
        if track.isEmpty {
            room = try await client.joinOrCreate("race2", options: ["name": .string(name), "body": .string(body.rawValue)], state: RaceRoomState.self)
        } else {
            room = try await client.joinOrCreate("race2", options: ["name": .string(name), "body": .string(body.rawValue), "track": .string(track)], state: RaceRoomState.self)
        }
        return OnlineRace(room)
    }

    private init(_ room: Colyseus.Room<RaceRoomState>) {
        self.room = room
        fresh = true
        subscriptions = [
            room.onStateChange { [weak self] _ in self?.fresh = true },
            room.onMessage("events") { [weak self] payload in self?.events += payload.array?.compactMap(RaceEvent.init(wire:)) ?? [] },
            room.onDrop { [weak self] _, _ in self?.status = .reconnecting },
            room.onReconnect { [weak self] in self?.status = .connected },
            room.onLeave { [weak self] _, _ in self?.status = .left },
        ]
    }

    func pump(_ dt: Double) { Colyseus.pump() }

    func takeState() -> RaceState? {
        guard fresh, let state = room.state else { return nil }
        fresh = false
        return state.state
    }

    func takeEvents() -> [RaceEvent] { defer { events = [] }; return events }

    func send(_ pose: PoseReport) {
        room.send("pose", ["x": .double(pose.x), "y": .double(pose.y), "z": .double(pose.z), "yaw": .double(pose.yaw),
                           "vx": .double(pose.vx), "vz": .double(pose.vz), "spawn": .int(Int64(pose.spawn))])
    }

    func useItem() { room.send("item") }
    func leave() { room.leave() }
}

extension RaceEvent {
    /// One entry of the room's `events` message, as `RaceEvent` in shared/src/race.ts sends it.
    init?(wire e: MessagePackValue) {
        let n = { (k: String) in e[k]?.double ?? 0 }, i = { (k: String) in e[k]?.int ?? -1 }, str = { (k: String) in e[k]?.string ?? "" }
        switch str("t") {
        case "ram": self = .ram(a: i("a"), b: i("b"), n: i("n"), ix: n("ix"), iz: n("iz"), spin: n("spin"))
        case "hit": self = .hit(s: i("s"), by: i("by"), kind: HitKind(rawValue: str("kind")) ?? .shot, ix: n("ix"), iz: n("iz"), hop: n("hop"), spin: n("spin"))
        case "boom": self = .boom(x: n("x"), z: n("z"))
        case "block": self = .block(s: i("s"))
        case "battery": self = .battery(s: i("s"))
        case "shot": self = .shot(s: i("s"))
        case "stranded": self = .stranded(s: i("s"))
        case "recharge": self = .recharge(s: i("s"))
        case "box": guard let item = ItemKind(rawValue: str("item")) else { return nil }; self = .box(s: i("s"), item: item)
        case "item": guard let item = ItemKind(rawValue: str("item")) else { return nil }; self = .item(s: i("s"), item: item)
        case "join": self = .join(s: i("s"), name: str("name"), was: str("was"))
        case "leave": self = .leave(s: i("s"), name: str("name"), was: str("was"))
        default: return nil
        }
    }
}
