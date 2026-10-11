import Foundation

/// What the player is doing (thumbs on a phone, the Crown and a tap on the watch), written by SwiftUI on the main thread
/// and read by the game loop on SceneKit's.
final class Controls: @unchecked Sendable {
    private let lock = NSLock()
    private var steer = 0.0, fire = false, pressed = false, reverse = false
    private func locked<T>(_ f: () -> T) -> T { lock.lock(); defer { lock.unlock() }; return f() }

    /// Auto-throttle: full ahead, unless reversing (the Back button, or the watch's screen held while stuck).
    func drive() -> Input { locked { Input(throttle: reverse ? -1 : 1, steer: steer) } }
    /// True while the action button (the watch's screen) is held, for a Zap's rapid fire.
    func firing() -> Bool { locked { fire } }
    /// True once per press.
    func takeItemPress() -> Bool { locked { defer { pressed = false }; return pressed } }

    func setSteer(_ v: Double) { locked { steer = v } }
    func setFiring(_ on: Bool) { locked { if on && !fire { pressed = true }; fire = on } }
    func setReversing(_ on: Bool) { locked { reverse = on } }
}
