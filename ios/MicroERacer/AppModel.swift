import Colyseus
import CoreText
import SwiftUI

// client/src/main.ts: the start form's settings, joining a Race and falling back to an Offline Race.

@MainActor
final class AppModel: ObservableObject {
    @Published var name: String
    @Published var body: BodyKind
    /// The picked Track's id, or "" for any Track.
    @Published var track: String
    @Published var steering: Steering { didSet { save("steer", steering.rawValue) } }
    @Published var side: PadSide { didSet { save("side", side.rawValue) } }
    @Published var muted: Bool { didSet { sound.setMuted(muted); save("muted", muted ? "1" : "0") } }
    @Published private(set) var game: Game?
    /// The Practice Ground behind the start screen's Controls button, while it is open.
    @Published private(set) var practice: Practice?
    @Published private(set) var hud = HudState()
    @Published private(set) var joining = false
    @Published var error = ""
    let controls = Controls(), sound = Sound()

    /// The same game server the browsers use; `-server ws://192.168.1.20:2567` as a launch argument (or that UserDefaults
    /// string) points it at a development server.
    private var endpoint: String { UserDefaults.standard.string(forKey: "server") ?? "wss://micro.grails.de" }
    /// Waiting longer than this for the server, Play starts an Offline Race instead.
    private let joinTimeout: UInt64 = 5_000_000_000

    init() {
        // the game loop pumps the SDK itself, so every room callback comes on its thread
        Colyseus.autoPump = false
        if let url = Bundle.main.url(forResource: "Bangers", withExtension: "woff") { CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil) }
        // the same keys as the browsers' localStorage
        let d = UserDefaults.standard
        name = d.string(forKey: "name").flatMap { $0.isEmpty ? nil : $0 } ?? randomName()
        body = BodyKind(rawValue: d.string(forKey: "body") ?? "") ?? .roadster
        // each start on a Track at random
        track = TRACKS.randomElement()!.id
        steering = Steering(rawValue: d.string(forKey: "steer") ?? "") ?? .buttons
        side = PadSide(rawValue: d.string(forKey: "side") ?? "") ?? .left
        muted = d.string(forKey: "muted") == "1"
        sound.setMuted(muted)
        controls.poll = pollPads
    }

    private func save(_ key: String, _ value: String) { UserDefaults.standard.set(value, forKey: key) }

    func play() async {
        let name = String(self.name.trimmingCharacters(in: .whitespaces).prefix(16))
        save("name", name); save("body", body.rawValue)
        error = ""
        joining = true
        defer { joining = false }
        var link: RaceLink? = await join(name)
        let offline = link == nil
        // no server to be reached: race the Bots right here
        if link == nil { link = OfflineRace(name: name, body: body, track: track.isEmpty ? nil : track) }
        game = Game(link: link!, controls: controls, sound: sound, offline: offline, publish: { [weak self] in self?.hud = $0 }, left: { [weak self] in
            self?.game = nil
            self?.error = "Connection lost."
        })
        UIApplication.shared.isIdleTimerDisabled = true
    }

    /// The online Race, or nil once `joinTimeout` has passed without one (a late one is left again).
    private func join(_ name: String) async -> OnlineRace? {
        let endpoint = self.endpoint, body = self.body, track = self.track, timeout = joinTimeout
        var settled = false
        return await withCheckedContinuation { (done: CheckedContinuation<OnlineRace?, Never>) in
            Task { @MainActor in
                let race = try? await OnlineRace.join(endpoint: endpoint, name: name, body: body, track: track)
                if settled { race?.leave(); return }
                settled = true
                done.resume(returning: race)
            }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: timeout)
                if settled { return }
                settled = true
                done.resume(returning: nil)
            }
        }
    }

    func openPractice() {
        practice = Practice(body: body, controls: controls, sound: sound)
        UIApplication.shared.isIdleTimerDisabled = true
    }

    func closePractice() {
        practice?.stop()
        practice = nil
        UIApplication.shared.isIdleTimerDisabled = false
    }

    func leave() {
        game?.stop()
        // nothing pumps the SDK any more but the SDK itself, so leaving the room goes out
        Colyseus.autoPump = true
        game = nil
        hud = HudState()
        UIApplication.shared.isIdleTimerDisabled = false
    }
}

/// A name for a new Player to race under right away (the same lists as main.ts).
private func randomName() -> String {
    let first = ["Joe", "Max", "Kim", "Lou", "Ada", "Sam", "Zoe", "Ben", "Mia", "Rex", "Ivy", "Gus", "Lena", "Otto", "Rita", "Finn"]
    let last = ["Ram", "Volt", "Watt", "Amp", "Spark", "Drift", "Zap", "Skid", "Turbo", "Fuse", "Bolt", "Ohm", "Plug", "Dash", "Coil", "Charge"]
    return "\(first.randomElement()!) \(last.randomElement()!)"
}

@main
struct MicroERacerApp: App {
    @StateObject private var model = AppModel()
    var body: some Scene {
        WindowGroup {
            Group {
                if let game = model.game { RaceView(model: model, game: game) } else if let practice = model.practice {
                    PracticeView(model: model, practice: practice)
                } else { StartView(model: model) }
            }
            .statusBarHidden()
            .persistentSystemOverlays(.hidden)
        }
    }
}

/// The game with the HUD and the touch controls over it.
struct RaceView: View {
    @ObservedObject var model: AppModel
    let game: Game

    var body: some View {
        ZStack {
            GameView(game: game).ignoresSafeArea()
            Halftone()
            HUDView(hud: model.hud)
            TouchControls(controls: model.controls, steering: model.steering, side: model.side, action: model.hud.action, showBack: model.hud.showBack)
            VStack(spacing: 10) {
                round(model.muted ? "🔇" : "🔊", label: "Sound") { model.muted.toggle() }
                round("✕", label: "Leave the Race") { model.leave() }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            .padding(.trailing, 16).padding(.top, 60)
        }
        // otherwise iOS holds back a touch near the screen's edges until it moves, so a still thumb on the pad did nothing
        .defersSystemGestures(on: .all)
    }

    private func round(_ text: String, label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text).font(.system(size: 22)).foregroundColor(Color(hex: 0x1b1410)).frame(width: 48, height: 48)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0xfffdf6)))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color(hex: 0x1b1410), lineWidth: 3))
                .background(RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0x111111)).offset(x: 3, y: 3))
        }
        .accessibilityLabel(label)
    }
}
