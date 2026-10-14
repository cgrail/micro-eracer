import Foundation

/// A keyboard or game controller, as the game loop polls it (`pollPads` on iPhone and iPad).
struct Pad {
    var throttle = 0.0, steer = 0.0
    /// `fire`: held, a Zap keeps firing; `use`: pressed, the Item is used.
    var fire = false, use = false
    var active: Bool { throttle != 0 || steer != 0 || fire || use }
}

/// How far off the Crown's heading our E-Car is when it steers at full lock (radians).
private let DIAL_LOCK = 0.3

/// What the player is doing (thumbs on a phone, a keyboard or game controller on an iPad, the Crown and the screen on the watch),
/// written by SwiftUI on the main thread and read by the game loop on SceneKit's. The last one used drives: touch with
/// auto-throttle, keys and controllers with their own throttle, as on a desktop.
final class Controls: @unchecked Sendable {
    private let lock = NSLock()
    private var steer = 0.0, fire = false, pressed = false, reverse = false, manual = false, padUse = false
    private func locked<T>(_ f: () -> T) -> T { lock.lock(); defer { lock.unlock() }; return f() }
    /// Polls the keyboard and game controllers; nil where there are none (the watch).
    var poll: (() -> Pad)?

    /// The watch's Crown: the angle off the road's direction our E-Car steers for (radians, left positive), nil elsewhere.
    private var dial: Double?

    /// Touch: auto-throttle, full ahead unless reversing (the Back button). Given our E-Car's `yaw` and the `road`'s
    /// direction, the watch's Crown steers it to its angle off the road, unless a finger on the screen steers.
    func drive(yaw: Double? = nil, road: Double? = nil) -> Input {
        let pad = poll?() ?? Pad()
        return locked {
            if pad.active { manual = true }
            if manual { return Input(throttle: pad.throttle, steer: pad.steer) }
            var s = steer
            if let dial, let yaw, let road, s == 0 { s = clamp(-angleDiff(yaw, road + dial) / DIAL_LOCK, -1, 1) }
            return Input(throttle: reverse ? -1 : 1, steer: s)
        }
    }
    /// True while the action button (or Space) is held, for a Zap's rapid fire.
    func firing() -> Bool { let pad = poll?() ?? Pad(); return locked { fire } || pad.fire }
    /// True once per press.
    func takeItemPress() -> Bool {
        let use = poll?().use ?? false
        return locked { defer { pressed = false; padUse = use }; return pressed || (use && !padUse) }
    }
    /// Driving with keys or a controller: no auto-throttle, and no Back button (they reverse by themselves).
    var usesPad: Bool { locked { manual } }

    func setSteer(_ v: Double) { locked { steer = v; manual = false } }
    func setDial(_ angle: Double?) { locked { dial = angle; manual = false } }
    func setFiring(_ on: Bool) { locked { if on && !fire { pressed = true }; fire = on; manual = false } }
    func setReversing(_ on: Bool) { locked { reverse = on } }
}
