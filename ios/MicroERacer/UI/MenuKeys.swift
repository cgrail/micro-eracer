import GameController
import SwiftUI

/// The start screen from an iPad's hardware keyboard, as main.ts works the browsers' start form: ↓ and ↑ go from the Name to
/// the Body, the Track and Play and back, ← → step the picker it is on, and Return plays (in the Name, its own Return does).
/// `at` is where the keyboard is, outlined on the screen; nil until a keyboard is there, and then it starts on the Track.
final class MenuKeys: ObservableObject {
    enum Stop: Int, CaseIterable { case name, body, track, play }
    @Published var at: Stop?
    /// What ← → do on a picker (`by` ±1), and what Return does; set by the start screen.
    var step: (Stop, Int) -> Void = { _, _ in }, play: () -> Void = {}
    /// While a sheet or an alert is over the start screen, its keys are its own.
    var paused = false
    private var observer: NSObjectProtocol?

    func start() {
        attach()
        observer = NotificationCenter.default.addObserver(forName: .GCKeyboardDidConnect, object: nil, queue: .main) { [weak self] _ in self?.attach() }
    }

    func stop() {
        GCKeyboard.coalesced?.keyboardInput?.keyChangedHandler = nil
        if let observer { NotificationCenter.default.removeObserver(observer) }
        observer = nil
    }

    private func attach() {
        guard let keys = GCKeyboard.coalesced?.keyboardInput else { return }
        if at == nil { at = .track }
        keys.keyChangedHandler = { [weak self] _, _, code, pressed in
            if pressed { DispatchQueue.main.async { self?.press(code) } }
        }
    }

    private func press(_ code: GCKeyCode) {
        guard !paused else { return }
        let at = self.at ?? .track
        switch code {
        case .downArrow, .upArrow: self.at = Stop(rawValue: min(Stop.allCases.count - 1, max(0, at.rawValue + (code == .downArrow ? 1 : -1))))
        case .leftArrow, .rightArrow: if at == .body || at == .track { step(at, code == .rightArrow ? 1 : -1); self.at = at }
        case .returnOrEnter, .keypadEnter: if at != .name { play() }
        default: return
        }
    }
}

extension View {
    /// Outlined where the keyboard is, as the browsers outline the picker their keys work on.
    func keyMark(_ on: Bool) -> some View {
        overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color(hex: 0x2f9bff), lineWidth: 3).padding(-6).opacity(on ? 1 : 0))
    }
}
