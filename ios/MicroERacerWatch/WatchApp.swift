import Combine
import CoreText
import SceneKit
import SwiftUI
import WatchKit

// The Apple Watch app: an Offline Race against the Bots, with the same `Game` as on the iPhone in a smaller frame. watchOS
// has no Colyseus SDK and allows web sockets only to audio-streaming apps, so the watch doesn't race online. The Digital
// Crown steers, and a tap on the screen uses the Item (held, a Zap keeps firing), or reverses while the E-Car is stuck.

@MainActor
final class WatchModel: ObservableObject {
    @Published var name: String
    @Published var body: BodyKind
    /// The picked Track's id, or "" for a different one each Race.
    @Published var track: String
    @Published var muted: Bool { didSet { sound.setMuted(muted); UserDefaults.standard.set(muted ? "1" : "0", forKey: "muted") } }
    @Published private(set) var game: Game?
    @Published private(set) var hud = HudState()
    let controls = Controls(), sound = Sound()

    init() {
        if let url = Bundle.main.url(forResource: "Bangers", withExtension: "woff") { CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil) }
        // the same keys as the phone and the browsers
        let d = UserDefaults.standard
        name = d.string(forKey: "name") ?? "Player"
        body = BodyKind(rawValue: d.string(forKey: "body") ?? "") ?? .roadster
        let picked = d.string(forKey: "track") ?? ""
        track = TRACKS.contains { $0.id == picked } ? picked : ""
        muted = d.string(forKey: "muted") == "1"
        sound.setMuted(muted)
    }

    func play() {
        let name = String(self.name.trimmingCharacters(in: .whitespaces).prefix(16))
        UserDefaults.standard.set(name, forKey: "name")
        UserDefaults.standard.set(body.rawValue, forKey: "body")
        UserDefaults.standard.set(track, forKey: "track")
        let game = Game(link: OfflineRace(name: name, body: body, track: track.isEmpty ? nil : track), controls: controls, sound: sound, offline: false, publish: { [weak self] hud in
            guard let self else { return }
            // the countdown and the finish are felt as well as seen
            if hud.msg != self.hud.msg { Self.tap(["3": .click, "2": .click, "1": .click, "GO!": .start][hud.msg] ?? (hud.msg.hasPrefix("Finished") ? .success : nil)) }
            self.hud = hud
        }, left: {})
        game.heard = { event, mine in
            let feel: WKHapticType?
            switch event {
            case let .ram(a, b, _, _, _, _): feel = b == mine ? .failure : a == mine ? .click : nil
            case let .hit(s, _, _, _, _, _, _): feel = s == mine ? .failure : nil
            case let .battery(s): feel = s == mine ? .directionUp : nil
            case let .box(s, _): feel = s == mine ? .click : nil
            case let .stranded(s): feel = s == mine ? .stop : nil
            case let .block(s): feel = s == mine ? .retry : nil
            default: feel = nil
            }
            DispatchQueue.main.async { Self.tap(feel) }
        }
        self.game = game
    }

    private static func tap(_ feel: WKHapticType?) { if let feel { WKInterfaceDevice.current().play(feel) } }

    func leave() {
        game?.stop()
        game = nil
        hud = HudState()
    }
}

@main
struct MicroERacerWatchApp: App {
    @StateObject private var model = WatchModel()
    var body: some Scene { WindowGroup { WatchStartView(model: model) } }
}

private let BODY_NAMES: [BodyKind: String] = [.roadster: "Roadster", .suv: "SUV", .microbus: "Microbus", .pickup: "Pickup", .semi: "Semi"]

struct WatchStartView: View {
    @ObservedObject var model: WatchModel
    @State private var racing = false

    var body: some View {
        NavigationStack {
            // a List, not a ScrollView: there the Pickers fall back to wheels squashed to a sliver
            List {
                Comic(text: "Micro E-Racer", size: 24, fill: Color(hex: 0xffd60a)).listRowBackground(Color.clear)
                TextField("Nickname", text: $model.name)
                Picker("Body", selection: $model.body) {
                    ForEach(BODY_KINDS, id: \.self) { Text(BODY_NAMES[$0]!).tag($0) }
                }
                Picker("Track", selection: $model.track) {
                    Text("Any Track").tag("")
                    ForEach(TRACKS, id: \.id) { Text($0.name).tag($0.id) }
                }
                Toggle("Sound", isOn: Binding(get: { !model.muted }, set: { model.muted = !$0 }))
                Button { model.play(); racing = true } label: {
                    Text("Play").font(.custom("Bangers-Regular", size: 24)).foregroundColor(Color(hex: 0x1b1410)).frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent).tint(Color(hex: 0xffd60a)).listRowBackground(Color.clear)
                Text("Turn the Crown to steer, tap to use your Item. Offline: you and the Bots.").font(.footnote).foregroundColor(.secondary).listRowBackground(Color.clear)
            }
            .navigationDestination(isPresented: $racing) {
                if let game = model.game { WatchRaceView(model: model, game: game) }
            }
        }
    }
}

/// The Race: the game, the HUD over it, the Crown and the tap.
struct WatchRaceView: View {
    @ObservedObject var model: WatchModel
    let game: Game
    @State private var crown = 0.0
    @State private var steer = 0.0
    @State private var idle = true
    @State private var held = false
    private let center = Timer.publish(every: 1.0 / 30, on: .main, in: .common).autoconnect()

    var body: some View {
        GeometryReader { box in
            ZStack {
                SceneView(scene: game.scene, pointOfView: game.cameraNode, options: [.rendersContinuously], preferredFramesPerSecond: 60, antialiasingMode: .none, delegate: game)
                    .ignoresSafeArea()
                Halftone()
                WatchHUD(hud: model.hud)
            }
            .onAppear { game.aspect = box.size.height > 0 ? box.size.width / box.size.height : 1 }
        }
        .focusable()
        // the Crown is the steering wheel: turned up, the E-Car steers right; let go, it comes back to the middle. Only its
        // turns count, into our own `steer`: a clamped Crown rubber-bands at its ends, and moving it back to the middle
        // while it does flung the steering over to the other side, so it wraps round instead and is never written to
        .digitalCrownRotation($crown, from: -1, through: 1, sensitivity: .high, isContinuous: true, isHapticFeedbackEnabled: false,
                              onChange: { _ in idle = false }, onIdle: { idle = true })
        .onChange(of: crown) { was, now in
            // a jump of more than half the Crown's range is it wrapping round, not a turn
            var turn = now - was
            if turn > 1 { turn -= 2 } else if turn < -1 { turn += 2 }
            steer = min(1, max(-1, steer + turn * 0.5))
        }
        .onChange(of: steer) { _, steer in model.controls.setSteer(steer) }
        .onReceive(center) { _ in if idle && steer != 0 { steer = abs(steer) < 0.03 ? 0 : steer * 0.8 } }
        // a tap uses the Item; while stuck (the phone's Back button would show) holding the screen reverses instead
        .gesture(DragGesture(minimumDistance: 0).onChanged { _ in
            if held { return }
            held = true
            if model.hud.showBack { model.controls.setReversing(true) } else { model.controls.setFiring(true) }
        }.onEnded { _ in
            held = false
            model.controls.setFiring(false)
            model.controls.setReversing(false)
        })
        .onDisappear { model.leave() }
    }
}

/// The HUD at watch size: Position, the Item and the Lap on top, the Energy bar under them, messages in the middle.
struct WatchHUD: View {
    let hud: HudState

    var body: some View {
        VStack(spacing: 3) {
            HStack {
                Comic(text: hud.pos, size: 20, fill: Color(hex: 0xffd60a))
                Spacer()
                Text(hud.item).font(.system(size: 18))
                Spacer()
                Comic(text: hud.lap, size: 15)
            }
            GeometryReader { bar in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white)
                    Capsule().fill(Color(hex: hud.energy < 25 ? 0xff4d4d : hud.energy < 50 ? 0xffd60a : 0x39e46b)).frame(width: bar.size.width * CGFloat(hud.energy) / 100)
                }
                .overlay(Capsule().strokeBorder(Color(hex: 0x111111), lineWidth: 2))
            }
            .frame(height: 9)
            Spacer()
            Comic(text: hud.msg, size: 30, fill: Color(hex: 0xffd60a)).multilineTextAlignment(.center)
            if hud.boardMode == .over {
                VStack(alignment: .leading, spacing: 0) {
                    if !hud.title.isEmpty { Text(hud.title).font(.custom("Bangers-Regular", size: 15)) }
                    ForEach(Array(hud.board.prefix(4).enumerated()), id: \.offset) { i, name in
                        Text("\(i + 1). \(name)").font(.custom("Bangers-Regular", size: 13)).foregroundColor(name == hud.me ? Color(hex: 0x2f9bff) : Color(hex: 0x1b1410))
                    }
                }
                .foregroundColor(Color(hex: 0x1b1410)).padding(6)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color(hex: 0xfffdf6)))
            }
            Spacer()
        }
        .padding(.horizontal, 4)
        .overlay(hud.danger ? RoundedRectangle(cornerRadius: 20).strokeBorder(Color(red: 1, green: 0.12, blue: 0.12, opacity: 0.7), lineWidth: 6).ignoresSafeArea() : nil)
        .background(Color.black.opacity(hud.boardMode == .over ? 0.4 : 0).ignoresSafeArea())
        .allowsHitTesting(false)
    }
}
