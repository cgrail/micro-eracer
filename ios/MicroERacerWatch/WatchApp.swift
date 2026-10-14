import Combine
import CoreText
import SceneKit
import SwiftUI
import WatchKit

// The Apple Watch app: an Offline Race against the Bots, with the same `Game` as on the iPhone in a smaller frame. watchOS
// has no Colyseus SDK and allows web sockets only to audio-streaming apps, so the watch doesn't race online. The Digital
// Crown steers, and so does a finger on the left or right half of the screen; the button in the top right corner uses the
// Item (held, a Zap keeps firing). There is no Back button: an E-Car stuck for a moment is put back on the road.

@MainActor
final class WatchModel: ObservableObject {
    @Published var name: String
    @Published var body: BodyKind
    /// The picked Track's id, or "" for a different one each Race.
    @Published var track: String
    @Published var muted: Bool { didSet { sound.setMuted(muted); UserDefaults.standard.set(muted ? "1" : "0", forKey: "muted") } }
    /// The Crown's notch, from 2.5 turned all the way up to -2.5 all the way down (`WatchRaceView.steer`).
    @Published var crown = STRAIGHT
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
        game.unstick = true
        // back on the road after a Fall-off or being stuck, or on a new grid, the steering starts straight again
        game.putBack = { [weak self] in DispatchQueue.main.async { self?.crown = STRAIGHT } }
        crown = STRAIGHT
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

/// The upper of the Crown's two straight notches, where it starts.
private let STRAIGHT = 0.5

private let BODY_NAMES: [BodyKind: String] = [.roadster: "Roadster", .suv: "SUV", .microbus: "Microbus", .pickup: "Pickup", .semi: "Semi"]

struct WatchStartView: View {
    @ObservedObject var model: WatchModel
    @State private var racing = false

    var body: some View {
        NavigationStack {
            // a List, not a ScrollView: there the Pickers fall back to wheels squashed to a sliver
            List {
                Comic(text: "Micro E-Racer", size: 24, fill: Color(hex: 0xffd60a)).listRowBackground(Color.clear)
                TextField("Name", text: $model.name)
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
                Text("Steer with the Crown, or touch the left or right of the screen. The button top right uses your Item. Offline: you and the Bots.").font(.footnote).foregroundColor(.secondary).listRowBackground(Color.clear)
            }
            .navigationDestination(isPresented: $racing) {
                if let game = model.game { WatchRaceView(model: model, game: game) }
            }
        }
    }
}

/// The Race: the game, the HUD over it, the Crown, the screen's halves and the action button.
struct WatchRaceView: View {
    @ObservedObject var model: WatchModel
    let game: Game
    /// Full lock while a finger is on the screen: -1 on its left half, 1 on its right.
    @State private var touch: Double? = nil

    /// A finger on the screen steers, or else the Crown's notch: the outer ones full lock, the next half lock, the two in
    /// the middle straight (so coming back from a turn it's easy to land on straight). Up is left.
    private var steer: Double {
        if let touch { return touch }
        let lock = abs(model.crown) < 1 ? 0 : abs(model.crown) < 2 ? 0.5 : 1
        return model.crown > 0 ? -lock : lock
    }

    var body: some View {
        GeometryReader { box in
            ZStack {
                SceneView(scene: game.scene, pointOfView: game.cameraNode, options: [.rendersContinuously], preferredFramesPerSecond: 60, antialiasingMode: .none, delegate: game)
                    .ignoresSafeArea()
                Halftone()
                WatchHUD(hud: model.hud)
                // as on the phone's pad, the wheel turns a quarter round at full lock
                Wheel().frame(width: 40, height: 40).rotationEffect(.degrees(steer * 90)).animation(.easeOut(duration: 0.1), value: steer)
                    .frame(maxHeight: .infinity, alignment: .bottom)
            }
            // as the phone's Buttons steering: the finger can rock from one half to the other without lifting
            .gesture(DragGesture(minimumDistance: 0).onChanged { at in touch = at.location.x < box.size.width / 2 ? -1 : 1 }.onEnded { _ in touch = nil })
            .onAppear { game.aspect = box.size.height > 0 ? box.size.width / box.size.height : 1 }
        }
        .focusable()
        // the Crown is a steering wheel that stays where it is left, clicking into six notches: two straight, then turned up
        // a little left and full lock left, turned down the same to the right
        .digitalCrownRotation($model.crown, from: -2.5, through: 2.5, by: 1, sensitivity: .low, isContinuous: false, isHapticFeedbackEnabled: true)
        .onChange(of: steer) { _, steer in model.controls.setSteer(steer) }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { ActionButton(item: model.hud.item, controls: model.controls) }
        }
        .onDisappear {
            model.controls.setFiring(false)
            model.controls.setSteer(0)
            model.leave()
        }
    }
}

/// The action button in the top right corner, where watch apps have theirs: it shows the Item (empty, a box will fill it)
/// and uses it when pressed, not on lifting like a `Button`; held, a Zap keeps firing.
private struct ActionButton: View {
    let item: String, controls: Controls
    @State private var down = false

    var body: some View {
        Text(item).font(.system(size: 17)).lineLimit(1).minimumScaleFactor(0.5)
            .frame(width: 38, height: 38)
            .background(SwiftUI.Circle().fill(Color(hex: 0xffc81e, opacity: item.isEmpty ? 0.45 : 0.9)))
            .overlay(SwiftUI.Circle().strokeBorder(Color(hex: 0x111111), lineWidth: 2))
            .scaleEffect(down ? 0.9 : 1)
            .contentShape(SwiftUI.Circle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { _ in
                if !down { down = true; controls.setFiring(true) }
            }.onEnded { _ in
                down = false
                controls.setFiring(false)
            })
            .accessibilityLabel(item.isEmpty ? "Use the Item" : item)
            .accessibilityAddTraits(.isButton)
    }
}

/// The HUD at watch size: Position and Lap on top (the Item is on the action button), the Energy bar under them, messages in
/// the middle.
struct WatchHUD: View {
    let hud: HudState

    var body: some View {
        VStack(spacing: 3) {
            HStack {
                Comic(text: hud.pos, size: 20, fill: Color(hex: 0xffd60a))
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
