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
    /// The Race a join would take, while one is running online: only the first Player picks a Track, so the start screen
    /// shows this one's in place of the picker (`askRace`).
    @Published private(set) var running: RunningRace?
    @Published var steering: Steering { didSet { save("steer", steering.rawValue) } }
    @Published var side: PadSide { didSet { save("side", side.rawValue) } }
    @Published var muted: Bool { didSet { sound.setMuted(muted); save("muted", muted ? "1" : "0") } }
    @Published private(set) var game: Game?
    /// The Practice Ground behind the start screen's Controls button, while it is open.
    @Published private(set) var practice: Practice?
    @Published private(set) var hud = HudState()
    @Published private(set) var joining = false
    @Published var error = ""
    /// The Tracks to pick from: the server's once it has said which it races (`check`), so one it added or changed is there
    /// too; until then, and while the app is `outdated`, the ones it came with, which an Offline Race races.
    @Published private(set) var tracks = TRACKS
    /// The server no longer races with this app: Play races offline until it is updated.
    @Published private(set) var outdated = false
    /// The update dialog, up when the server first says the app is too old.
    @Published var askUpdate = false
    /// Where the new version is, as the server says (`APP_STORE_URL`); the app's own page otherwise.
    private(set) var updateLink = APP_STORE
    private var checking = false
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

    /// Asks the server whether it still races with this app, and which Tracks it races: on launch and whenever the app comes
    /// back to the front. With no answer (no network, or a server from before it gave one) nothing changes, and Play tries
    /// to join all the same.
    func check() async {
        if checking { return }
        checking = true
        defer { checking = false }
        guard let info = try? await ServerInfo.fetch(endpoint: endpoint) else { return }
        if let link = info.update { updateLink = link }
        if !info.compatible { showOutdated(); return }
        // racing with this app again (a server rolled back): online it is
        outdated = false
        if !info.tracks.isEmpty { setTracks(info.tracks) }
    }

    private func setTracks(_ list: [TrackDef]) {
        tracks = list
        // a Track no longer offered gives way to another at random
        if !track.isEmpty && !list.contains(where: { $0.id == track }) { track = list.randomElement()?.id ?? "" }
    }

    private func showOutdated() {
        if !outdated { setTracks(TRACKS); askUpdate = true }
        outdated = true
        running = nil
    }

    /// Asks the server for the Race a join would take, while the start screen is up (it asks every few seconds): one that
    /// starts meanwhile takes the picker's place, and the picker comes back when it is over. With no answer (no server, or
    /// one from before it said) the Player picks.
    func askRace() async {
        if outdated { return }
        let now = try? await ServerInfo.race(endpoint: endpoint)
        if outdated || game != nil || now == running { return }
        running = now
    }

    func openUpdate() { UIApplication.shared.open(updateLink) }

    func play() async {
        let name = String(self.name.trimmingCharacters(in: .whitespaces).prefix(16))
        save("name", name); save("body", body.rawValue)
        error = ""
        joining = true
        defer { joining = false }
        // the running Race's Track, or the Player's own pick
        let picked = running?.track.id ?? track
        var link: RaceLink?
        if !outdated {
            switch await join(name, track: picked) {
            case .joined(let race): link = race
            // a server that no longer races with this app: the update dialog first, and Play then races offline
            case .outdated: showOutdated(); return
            case .unreachable: break
            }
        }
        let offline = link == nil
        // no server to be reached (or none to race with): race the Bots right here, on the app's own Tracks
        if link == nil { link = OfflineRace(name: name, body: body, track: TRACKS.contains { $0.id == picked } ? picked : nil) }
        game = Game(link: link!, controls: controls, sound: sound, offline: offline, publish: { [weak self] in self?.hud = $0 }, left: { [weak self] in
            self?.game = nil
            self?.error = "Connection lost."
        })
        UIApplication.shared.isIdleTimerDisabled = true
    }

    private enum Joined { case joined(OnlineRace), outdated, unreachable }

    /// The online Race; `.outdated` when the server refused this app as too old, `.unreachable` when it failed otherwise or
    /// `joinTimeout` passed without one (a late one is left again).
    private func join(_ name: String, track: String) async -> Joined {
        let endpoint = self.endpoint, body = self.body, timeout = joinTimeout
        var settled = false
        return await withCheckedContinuation { (done: CheckedContinuation<Joined, Never>) in
            Task { @MainActor in
                let joined: Joined
                do { joined = .joined(try await OnlineRace.join(endpoint: endpoint, name: name, body: body, track: track)) } catch {
                    joined = OnlineRace.outdated(error) ? .outdated : .unreachable
                }
                if settled { if case .joined(let race) = joined { race.leave() }; return }
                settled = true
                done.resume(returning: joined)
            }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: timeout)
                if settled { return }
                settled = true
                done.resume(returning: .unreachable)
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
    @Environment(\.scenePhase) private var phase
    var body: some Scene {
        WindowGroup {
            Group {
                if let game = model.game { RaceView(model: model, game: game) } else if let practice = model.practice {
                    PracticeView(model: model, practice: practice)
                } else { StartView(model: model) }
            }
            .statusBarHidden()
            .persistentSystemOverlays(.hidden)
            // on launch, and again on coming back: the server may have moved on while the app was away
            .task { await model.check() }
            .onChange(of: phase) { if $0 == .active { Task { await model.check() } } }
            .alert("New version!", isPresented: $model.askUpdate) {
                Button("Update") { model.openUpdate() }
                Button("Race offline", role: .cancel) {}
            } message: {
                Text("The game has moved on, and this version of the app is too old to race online with it. Update it to race online again, or race the Bots offline for now.")
            }
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
            HUDView(hud: model.hud, outdated: model.outdated)
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
