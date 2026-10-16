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
final class TrackSchema: SchemaRef, @unchecked Sendable {
    /// The Race's Track; on a theme this app doesn't know (a newer server's) it is drawn as the kitchen.
    var def: TrackDef? {
        guard let id = view.string("id"), !id.isEmpty, let pieces = view.string("pieces"), !pieces.isEmpty else { return nil }
        return TrackDef(id: id, name: view.string("name") ?? id, theme: Theme(rawValue: view.string("theme") ?? "") ?? .kitchen, pieces: pieces,
                        puddles: arrayOf("puddles", Int.self).values, items: arrayOf("items", Int.self).values)
    }
}
final class RaceRoomState: SchemaRef, @unchecked Sendable {
    var state: RaceState {
        let trackId = view.string("trackId") ?? "", track = refOf("track", TrackSchema.self)?.def
        return RaceState(phase: Phase(rawValue: view.string("phase") ?? "") ?? .grid, timer: view["timer"], trackId: trackId,
                         cars: arrayOf("cars", CarSchema.self).values.map(\.state), results: arrayOf("results", String.self).values, finishers: Int(view["finishers"]), winners: arrayOf("winners", String.self).values,
                         batteries: arrayOf("batteries", SpotSchema.self).values.map(\.spot), bolts: arrayOf("bolts", SpotSchema.self).values.map(\.bolt),
                         mines: arrayOf("mines", SpotSchema.self).values.map(\.spot), boxes: arrayOf("boxes", Bool.self).values,
                         track: track?.id == trackId ? track : nil)
    }
}

/// What the server says of this app before it races online (server/src/api.ts): whether it still may (`/version`), where to
/// get the new one if not, the Tracks it races (`/tracks`), which the start screen offers instead of the app's own, and the
/// Race a join would take (`/race`).
struct ServerInfo {
    let compatible: Bool
    let update: URL?
    /// Only those on themes this app can draw; empty when the server isn't racing with it.
    let tracks: [TrackDef]

    static func fetch(endpoint: String) async throws -> ServerInfo {
        let client = try Colyseus.Client(endpoint: endpoint)
        // the requests run on the client's own connection, which goes when the client does
        defer { withExtendedLifetime(client) {} }
        let version = try await client.http.get("/version?protocol=\(PROTOCOL)").json
        let update = version?["update"]?.string.flatMap(URL.init(string:))
        guard version?["compatible"]?.bool ?? true else { return ServerInfo(compatible: false, update: update, tracks: []) }
        let tracks = try await client.http.get("/tracks").json?.array?.compactMap(TrackDef.init(wire:)) ?? []
        return ServerInfo(compatible: true, update: update, tracks: tracks)
    }

    /// The Race a join would take (the fullest with a free Seat), nil while none is running or on a theme this app doesn't know.
    static func race(endpoint: String) async throws -> RunningRace? {
        let client = try Colyseus.Client(endpoint: endpoint)
        defer { withExtendedLifetime(client) {} }
        let answer = try await client.http.get("/race").json
        guard let wire = answer?["track"], let track = TrackDef(wire: wire), let players = answer?["players"]?.array else { return nil }
        return RunningRace(track: track, players: players.compactMap(\.string))
    }
}

extension TrackDef {
    /// One of the server's Tracks, as `/tracks` lists it; nil for one on a theme this app doesn't know.
    init?(wire t: MessagePackValue) {
        guard let id = t["id"]?.string, let name = t["name"]?.string, let theme = Theme(rawValue: t["theme"]?.string ?? ""),
              let pieces = t["pieces"]?.string, let puddles = t["puddles"]?.array?.compactMap(\.int), let items = t["items"]?.array?.compactMap(\.int)
        else { return nil }
        self.init(id: id, name: name, theme: theme, pieces: pieces, puddles: puddles, items: items)
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
    /// Joins the fullest Race there is, the one the start screen shows; `track` (a Track's id, or "" for any) only counts if
    /// there is none and this join makes it. The `race` room is left to apps from before the Track picker, which know only the
    /// first four Tracks. `protocol` tells the server what this app speaks: one too old for it is refused (`OnlineRace.outdated`).
    static func join(endpoint: String, name: String, body: BodyKind, track: String) async throws -> OnlineRace {
        Colyseus.autoPump = false
        let client = try Colyseus.Client(endpoint: endpoint)
        var options: [String: MessagePackValue] = ["name": .string(name), "body": .string(body.rawValue), "protocol": .int(Int64(PROTOCOL))]
        if !track.isEmpty { options["track"] = .string(track) }
        let room = try await client.joinOrCreate("race2", options: .map(options), state: RaceRoomState.self)
        return OnlineRace(room)
    }

    /// Whether a join failed because the server no longer races with this app (the SDK hands on the HTTP status as the code).
    static func outdated(_ error: Error) -> Bool {
        if case Colyseus.Error.matchmaking(let code, _) = error { return Int(code) == OUTDATED }
        return false
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
