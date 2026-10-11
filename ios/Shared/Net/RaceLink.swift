import Foundation

/// What the game needs of a Race: the online room (`OnlineRace`), or an Offline Race on this device (`OfflineRace`), so the
/// game can't tell the two apart (client/src/state.ts `RaceLink`). Everything runs on the game loop's thread: `pump` once a
/// frame, then `takeState` and `takeEvents`.
protocol RaceLink: AnyObject {
    var sessionId: String { get }
    /// Advances the Race by `dt` and takes in what arrived since the last frame.
    func pump(_ dt: Double)
    /// The Race as it is now, once per new state from the server; nil while nothing new came.
    func takeState() -> RaceState?
    func takeEvents() -> [RaceEvent]
    var status: LinkStatus { get }
    func send(_ pose: PoseReport)
    /// Uses the Item (a Zap's Shot); the server checks whether it may.
    func useItem()
    func leave()
}

enum LinkStatus { case connected, reconnecting, left }
