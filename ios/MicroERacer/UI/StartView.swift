import SceneKit
import SwiftUI

// The start form of client/index.html and client/src/main.ts, with the garage's turntable (client/src/garage.ts) and the
// Track picker (TrackPick.swift).

private let BODY_NAMES: [BodyKind: String] = [.roadster: "Roadster", .suv: "SUV", .microbus: "Microbus", .pickup: "Pickup", .semi: "Semi"]
/// The stats the start form shows per Body. Ruggedness is the weight: it wins Rams and softens Hits.
private let STATS: [(String, (BodySpec) -> Double)] = [("Top speed", \.maxSpeed), ("Acceleration", \.accel), ("Grip", \.grip), ("Ruggedness", \.mass), ("Battery", \.tank)]
/// Each bar runs from a fifth for the weakest Body to full for the strongest, so the small differences show.
private func bar(_ stat: (BodySpec) -> Double, _ kind: BodyKind) -> Double {
    let all = BODY_KINDS.map { stat($0.spec) }, lo = all.min()!, hi = all.max()!
    return 0.2 + 0.8 * (stat(kind.spec) - lo) / (hi - lo)
}

struct StartView: View {
    @ObservedObject var model: AppModel
    @Environment(\.colorScheme) private var scheme
    @StateObject private var garage = Garage()
    @StateObject private var course = Course()
    /// The About page, behind the i by the title.
    @State private var about = false
    @FocusState private var naming: Bool

    private var paper: Color { scheme == .dark ? Color(hex: 0x2f2620) : Color(hex: 0xfffdf6) }
    private var ink: Color { scheme == .dark ? Color(hex: 0xfff6e6) : Color(hex: 0x1b1410) }
    /// Any Track first, then every Track (the server's, once it has said which it races): what ◀ and ▶ step through.
    private var trackIds: [String] { [""] + model.tracks.map(\.id) }
    /// The places, in the order their Tracks come, for the list of every Track.
    private var places: [Theme] { model.tracks.map(\.theme).reduce(into: [Theme]()) { if !$0.contains($1) { $0.append($1) } } }
    /// The running Race's Track, or else the picked one; nil for any.
    private var picked: TrackDef? { model.running?.track ?? model.tracks.first { $0.id == model.track } }

    var body: some View {
        // the whole form on one screen, never scrolled (as in the browser): two columns side by side lying down (under the
        // title and above Play, which span both), one standing up, and the pictures take the height that is left
        GeometryReader { geo in
            let wide = geo.size.width > geo.size.height && geo.size.width >= 600
            let pic = CGFloat(wide ? clamp(Double(geo.size.height - 330), 48, 150) : clamp(Double((geo.size.height - 530) / 2), 64, 150))
            card(wide: wide, pic: pic)
                .frame(maxWidth: wide ? 800 : 420)
                .padding(.horizontal, 16)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        // the keyboard covers the bottom while the name is typed, rather than squashing the form
        .ignoresSafeArea(.keyboard)
        .background(Backdrop())
        .onAppear { garage.show(model.body, whirl: false); course.show(picked) }
        // while the form is up, the Race a join would take: its Track replaces the picker, as only the first Player picks one
        .task { while !Task.isCancelled { await model.askRace(); try? await Task.sleep(nanoseconds: 5_000_000_000) } }
        #if DEBUG
        // `-autoplay YES -name Tester` as launch arguments: straight into a Race, for trying things in the simulator
        .task { if UserDefaults.standard.bool(forKey: "autoplay") && !model.name.isEmpty { await model.play() } }
        #endif
        .onChange(of: model.body) { garage.show($0, whirl: true) }
        .onChange(of: picked) { course.show($0) }
        .sheet(isPresented: $about) { AboutView() }
    }

    private func card(wide: Bool, pic: CGFloat) -> some View {
        Group {
            if wide {
                VStack(spacing: 8) {
                    title(centred: true)
                    nameField.frame(maxWidth: 380)
                    HStack(alignment: .top, spacing: 20) {
                        bodyPick(pic)
                        // a line between the Body and the Track, like the one under the Track's name
                        VStack(alignment: .leading, spacing: 8) { trackPick(pic); controlsButton }
                            .padding(.leading, 20).overlay(alignment: .leading) { Rectangle().fill(ink.opacity(0.5)).frame(width: 2) }
                    }
                    playButton.frame(maxWidth: 380)
                }
            } else {
                VStack(alignment: .leading, spacing: 8) { title(centred: false); nameField; bodyPick(pic); trackPick(pic); controlsButton; playButton }
            }
        }
        .foregroundColor(ink)
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 18).fill(paper))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(ink, lineWidth: 4))
        .background(RoundedRectangle(cornerRadius: 18).fill(ink).offset(x: 8, y: 8))
        .rotationEffect(.degrees(-1))
    }

    /// The title, in the middle lying down, with the i at the end of its row.
    private func title(centred: Bool) -> some View {
        ZStack(alignment: .trailing) {
            Comic(text: "Micro E-Racer", size: 40, fill: Color(hex: 0xffd60a)).frame(maxWidth: .infinity, alignment: centred ? .center : .leading)
            infoButton
        }
    }

    private var nameField: some View {
        HStack(spacing: 10) {
            label("Name")
            TextField("", text: $model.name)
                .font(.system(size: 18)).textInputAutocapitalization(.never).autocorrectionDisabled().submitLabel(.go)
                // Return plays, as Enter submits the browsers' start form
                .onSubmit { if !model.joining && !model.name.trimmingCharacters(in: .whitespaces).isEmpty { Task { await model.play() } } }
                .onChange(of: model.name) { if $0.count > 16 { model.name = String($0.prefix(16)) } }
                // the made-up name clears as the Player goes to type their own, and comes back if they type none
                .focused($naming)
                .onChange(of: naming) { now in
                    guard let madeUp = model.madeUp else { return }
                    if now && model.name == madeUp { model.name = "" }
                    if !now && model.name.trimmingCharacters(in: .whitespaces).isEmpty { model.name = madeUp }
                }
                .padding(.horizontal, 12).padding(.vertical, 8).overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(ink, lineWidth: 3))
        }
    }

    /// The Body on its turntable between ◀ and ▶, its name below, and its stats, two to a row.
    private func bodyPick(_ pic: CGFloat) -> some View {
        VStack(spacing: 6) {
            HStack(spacing: 8) {
                stepper("◀\u{FE0E}", label: "Previous Body") { step(-1) }
                TurntableView(garage: garage).frame(height: pic).frame(maxWidth: .infinity)
                stepper("▶\u{FE0E}", label: "Next Body") { step(1) }
            }
            Text(bangers: BODY_NAMES[model.body]!, size: 24)
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible())], spacing: 4) {
                ForEach(STATS, id: \.0) { stat in
                    HStack(spacing: 6) {
                        Text(stat.0).font(.system(size: 11, weight: .semibold)).lineLimit(1).frame(width: 74, alignment: .leading)
                        GeometryReader { g in
                            Capsule().fill(Color(hex: 0x2f9bff)).frame(width: g.size.width * bar(stat.1, model.body)).animation(.easeOut(duration: 0.3), value: model.body)
                        }
                        .frame(height: 9).overlay(Capsule().strokeBorder(ink, lineWidth: 2)).clipShape(Capsule())
                    }
                }
            }
        }
    }

    /// The Track from above between ◀ and ▶, its name below (which lists every Track), and what it has in store. While a Race
    /// is running online, its Track, picked by its first Player, with no ◀ ▶ and no list, and who is in it.
    private func trackPick(_ pic: CGFloat) -> some View {
        let def = picked, facts = trackFacts(def, of: model.tracks.count), running = model.running
        return VStack(spacing: 6) {
            HStack(spacing: 8) {
                RepeatStepper(arrow: "◀\u{FE0E}", label: "Previous Track", ink: ink) { stepTrack(-1) }.locked(running != nil)
                CourseView(course: course).frame(height: pic).frame(maxWidth: .infinity)
                    // any Track: a question mark in the picture's place
                    .overlay { if def == nil { Color(hex: 0x2f9bff).overlay(Text(bangers: "?", size: pic * 0.8).foregroundColor(Color(hex: 0xffd60a)).offset(y: pic * 0.06)) } }
                    .clipShape(RoundedRectangle(cornerRadius: 10)).overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(ink, lineWidth: 3))
                    .accessibilityHidden(true)
                RepeatStepper(arrow: "▶\u{FE0E}", label: "Next Track", ink: ink) { stepTrack(1) }.locked(running != nil)
            }
            if let running, let def {
                Text(bangers: def.name, size: 24).lineLimit(1).minimumScaleFactor(0.6)
                    .frame(maxWidth: .infinity).padding(.vertical, 4).padding(.horizontal, 56)
                    .accessibilityLabel("Track, \(def.name)")
                VStack(spacing: 1) {
                    Text(racers(running.players)).font(.system(size: 12, weight: .bold)).lineLimit(1)
                    Text("\(themeLook(def.theme).title) · \(facts[0])").font(.system(size: 12))
                }
                .multilineTextAlignment(.center)
            } else {
                trackMenu(def, facts)
            }
        }
    }

    /// The Track's name, which lists every Track, by place, and what it has in store.
    @ViewBuilder private func trackMenu(_ def: TrackDef?, _ facts: [String]) -> some View {
        Menu {
            Button("Any Track") { model.track = "" }
            ForEach(places, id: \.self) { place in
                Section(header: Text(themeLook(place).title)) {
                    ForEach(model.tracks.filter { $0.theme == place }, id: \.id) { t in Button(t.name) { model.track = t.id } }
                }
            }
        } label: {
            Text(bangers: def?.name ?? "Any Track", size: 24).lineLimit(1).minimumScaleFactor(0.6)
                .foregroundColor(ink).frame(maxWidth: .infinity).padding(.vertical, 4)
                .overlay(alignment: .bottom) { Rectangle().fill(ink.opacity(0.5)).frame(height: 2) }
        }
        // under the picture, clear of ◀ and ▶
        .padding(.horizontal, 56)
        .accessibilityLabel("Track")
        .accessibilityValue(def?.name ?? "Any Track")
        VStack(spacing: 1) {
            Text(def.map { "\(themeLook($0.theme).title) · \(facts[0])" } ?? facts[0]).font(.system(size: 12, weight: .bold))
            Text(facts[1]).font(.system(size: 12))
        }
        .multilineTextAlignment(.center)
    }

    /// How many Players are in the running Race, and who: on one line, cut short at the end where the names don't fit
    /// (`racers` in main.ts).
    private func racers(_ names: [String]) -> String {
        names.isEmpty ? "A Race is on" : "\(names.count) \(names.count == 1 ? "Player" : "Players") racing: \(names.joined(separator: ", "))"
    }

    /// The i for the About page: who made the game, how and why, and which build this is.
    private var infoButton: some View {
        Button { about = true } label: {
            Text("i").font(.system(size: 26, weight: .bold, design: .serif)).foregroundColor(Color(hex: 0x1b1410)).frame(width: 44, height: 44)
                .background(SwiftUI.Circle().fill(Color(hex: 0x8ecbff)))
                .overlay(SwiftUI.Circle().strokeBorder(ink, lineWidth: 3))
                .background(SwiftUI.Circle().fill(ink).offset(x: 3, y: 3))
                .padding(.trailing, 3)
        }
        .accessibilityLabel("About the game")
    }

    /// Opens the Practice Ground, where the touch controls are set and tried out, and says how they are set. Shaped like
    /// Play, but quieter; each leaves room for its shadow, so it doesn't stick out past the rows above.
    private var controlsButton: some View {
        Button { model.openPractice() } label: {
            HStack(spacing: 8) {
                Text(bangers: "Controls", size: 22).kerning(0.5)
                Text("\(model.steering == .buttons ? "Buttons" : "Slider"), pad \(model.side.rawValue)").font(.system(size: 14))
                    .lineLimit(1).frame(maxWidth: .infinity, alignment: .trailing)
                Text("▶\u{FE0E}").font(.system(size: 18)).accessibilityHidden(true)
            }
            .foregroundColor(Color(hex: 0x1b1410)).padding(.horizontal, 14).frame(minHeight: 44)
            .background(RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0x8ecbff)))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(ink, lineWidth: 3))
            .background(RoundedRectangle(cornerRadius: 12).fill(ink).offset(x: 4, y: 4))
            .padding(.trailing, 4)
            .contentShape(RoundedRectangle(cornerRadius: 12))
        }
        .accessibilityHint("Set up the touch controls and try them out")
    }

    private var playButton: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button { Task { await model.play() } } label: {
                Text(bangers: model.outdated ? "Play offline" : model.running != nil ? "Join the Race" : "Play", size: 30).foregroundColor(Color(hex: 0x1b1410)).frame(maxWidth: .infinity).padding(.vertical, 8)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0xffd60a)))
                    .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(ink, lineWidth: 3))
                    .background(RoundedRectangle(cornerRadius: 12).fill(ink).offset(x: 5, y: 5))
                    .padding(.trailing, 5)
            }
            .disabled(model.joining || model.name.trimmingCharacters(in: .whitespaces).isEmpty)
            .opacity(model.joining ? 0.6 : 1)
            if !model.error.isEmpty { Text(model.error).foregroundColor(Color(hex: 0xe5383b)).font(.system(size: 16, weight: .semibold)) }
        }
    }

    private func step(_ by: Int) {
        let all = BODY_KINDS, i = all.firstIndex(of: model.body)!
        model.body = all[(i + by + all.count) % all.count]
    }

    private func stepTrack(_ by: Int) {
        let ids = trackIds, i = ids.firstIndex(of: model.track) ?? 0
        model.track = ids[(i + by + ids.count) % ids.count]
    }

    private func label(_ text: String) -> some View { Text(bangers: text, size: 18).kerning(0.5) }

    private func stepper(_ arrow: String, label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) { Text(arrow).font(.system(size: 22)).frame(width: 48, height: 44).overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(ink, lineWidth: 3)) }
            .accessibilityLabel(label)
    }

}

/// The turntable: the picked Body turning slowly, with a quick whirl on each pick.
final class Garage: NSObject, ObservableObject, SCNSceneRendererDelegate {
    let scene = SCNScene(), camera = SCNNode(), turntable = SCNNode()
    private var cars: [BodyKind: SCNNode] = [:], speed = 0.0, last = -1.0
    private let still = UIAccessibility.isReduceMotionEnabled

    override init() {
        super.init()
        camera.camera = SCNCamera()
        camera.camera!.fieldOfView = 30
        // close enough that the Body fills its picture, with room for the Semi side on
        camera.position = SCNVector3(0, 2.7, 6.9)
        camera.look(at: SCNVector3(0, 0, 0))
        scene.rootNode.addChildNode(camera)
        let ambient = SCNLight(); ambient.type = .ambient; ambient.intensity = 560
        let sun = SCNLight(); sun.type = .directional; sun.intensity = 760
        let sunNode = SCNNode(); sunNode.light = sun; sunNode.position = SCNVector3(4, 8, 3); sunNode.look(at: SCNVector3(0, 0, 0))
        scene.rootNode.addChildNode(SCNNode().with { $0.light = ambient })
        scene.rootNode.addChildNode(sunNode)
        for k in BODY_KINDS { let car = makeCar(k, 0x2f9bff).node; cars[k] = car; turntable.addChildNode(car) }
        // the headlights' beams would sweep right across the little picture
        for car in cars.values { car.childNode(withName: "beams", recursively: false)?.isHidden = true }
        turntable.eulerAngles.y = 0.6
        scene.rootNode.addChildNode(turntable)
    }

    func show(_ kind: BodyKind, whirl: Bool) {
        for (k, car) in cars { car.isHidden = k != kind }
        if whirl && !still { speed = 9 }
    }

    func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
        let dt = last < 0 ? 0 : min(0.1, time - last)
        last = time
        // settling into a slow turn
        speed += ((still ? 0 : 0.8) - speed) * min(1, 3 * dt)
        turntable.eulerAngles.y += Float(speed * dt)
    }
}

private struct TurntableView: UIViewRepresentable {
    let garage: Garage
    func makeUIView(context: Context) -> SCNView {
        let v = SCNView()
        v.scene = garage.scene
        v.pointOfView = garage.camera
        v.delegate = garage
        v.backgroundColor = .clear
        v.antialiasingMode = .multisampling4X
        v.rendersContinuously = true
        v.isPlaying = true
        v.isUserInteractionEnabled = false
        v.accessibilityElementsHidden = true
        return v
    }
    func updateUIView(_ v: SCNView, context: Context) {}
}
