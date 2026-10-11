import SceneKit
import SwiftUI

// The start form of client/index.html and client/src/main.ts, with the garage's turntable (client/src/garage.ts).

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

    private var bg: Color { scheme == .dark ? Color(hex: 0x2a2118) : Color(hex: 0xffe9c9) }
    private var paper: Color { scheme == .dark ? Color(hex: 0x2f2620) : Color(hex: 0xfffdf6) }
    private var ink: Color { scheme == .dark ? Color(hex: 0xfff6e6) : Color(hex: 0x1b1410) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Comic(text: "Micro E-Racer", size: 52, fill: Color(hex: 0xffd60a))
                label("Nickname")
                TextField("", text: $model.name)
                    .font(.system(size: 18)).textInputAutocapitalization(.never).autocorrectionDisabled().submitLabel(.go)
                    .onChange(of: model.name) { if $0.count > 16 { model.name = String($0.prefix(16)) } }
                    .padding(12).overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(ink, lineWidth: 3))
                label("Body")
                HStack(alignment: .center, spacing: 10) {
                    TurntableView(garage: garage).frame(height: 130).frame(maxWidth: .infinity)
                    VStack(alignment: .leading, spacing: 3) {
                        ForEach(STATS, id: \.0) { stat in
                            Text(stat.0).font(.system(size: 12, weight: .semibold))
                            GeometryReader { g in
                                Capsule().fill(Color(hex: 0x2f9bff)).frame(width: g.size.width * bar(stat.1, model.body)).animation(.easeOut(duration: 0.3), value: model.body)
                            }
                            .frame(height: 10).overlay(Capsule().strokeBorder(ink, lineWidth: 2)).clipShape(Capsule())
                        }
                    }
                    .frame(width: 130)
                }
                HStack {
                    stepper("◀\u{FE0E}", label: "Previous Body") { step(-1) }
                    Text(BODY_NAMES[model.body]!).font(.custom("Bangers-Regular", size: 26)).frame(maxWidth: .infinity)
                    stepper("▶\u{FE0E}", label: "Next Body") { step(1) }
                }
                label("Steering")
                HStack(spacing: 8) {
                    pick(.slider, "Slider", "drag left or right")
                    pick(.buttons, "Buttons", "hold ◀\u{FE0E} or ▶\u{FE0E}")
                }
                Button { Task { await model.play() } } label: {
                    Text("Play").font(.custom("Bangers-Regular", size: 30)).foregroundColor(Color(hex: 0x1b1410)).frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0xffd60a)))
                        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(ink, lineWidth: 3))
                        .background(RoundedRectangle(cornerRadius: 12).fill(ink).offset(x: 5, y: 5))
                }
                .disabled(model.joining || model.name.trimmingCharacters(in: .whitespaces).isEmpty)
                .opacity(model.joining ? 0.6 : 1)
                Text(model.error).foregroundColor(Color(hex: 0xe5383b)).font(.system(size: 16, weight: .semibold)).frame(minHeight: 22)
            }
            .foregroundColor(ink)
            .padding(24)
            .background(RoundedRectangle(cornerRadius: 18).fill(paper))
            .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(ink, lineWidth: 4))
            .background(RoundedRectangle(cornerRadius: 18).fill(ink).offset(x: 8, y: 8))
            .rotationEffect(.degrees(-1))
            .frame(maxWidth: 420)
            .padding(.horizontal, 16).padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
        .background(bg.ignoresSafeArea())
        .onAppear { garage.show(model.body, whirl: false) }
        #if DEBUG
        // `-autoplay YES -name Tester` as launch arguments: straight into a Race, for trying things in the simulator
        .task { if UserDefaults.standard.bool(forKey: "autoplay") && !model.name.isEmpty { await model.play() } }
        #endif
        .onChange(of: model.body) { garage.show($0, whirl: true) }
    }

    private func step(_ by: Int) {
        let all = BODY_KINDS, i = all.firstIndex(of: model.body)!
        model.body = all[(i + by + all.count) % all.count]
    }

    private func label(_ text: String) -> some View { Text(text).font(.custom("Bangers-Regular", size: 20)).kerning(0.5) }

    private func stepper(_ arrow: String, label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) { Text(arrow).font(.system(size: 22)).frame(width: 48, height: 44).overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(ink, lineWidth: 3)) }
            .accessibilityLabel(label)
    }

    private func pick(_ s: Steering, _ title: String, _ hint: String) -> some View {
        let on = model.steering == s
        return Button { model.steering = s } label: {
            VStack(spacing: 0) {
                Text(title).font(.custom("Bangers-Regular", size: 19))
                Text(hint).font(.system(size: 12))
            }
            .foregroundColor(on ? .white : ink).frame(maxWidth: .infinity).padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 12).fill(on ? Color(hex: 0x2f9bff) : .clear))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(ink, lineWidth: 3))
        }
        .accessibilityAddTraits(on ? .isSelected : [])
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
        camera.position = SCNVector3(0, 3.4, 8.6)
        camera.look(at: SCNVector3(0, 0, 0))
        scene.rootNode.addChildNode(camera)
        let ambient = SCNLight(); ambient.type = .ambient; ambient.intensity = 560
        let sun = SCNLight(); sun.type = .directional; sun.intensity = 760
        let sunNode = SCNNode(); sunNode.light = sun; sunNode.position = SCNVector3(4, 8, 3); sunNode.look(at: SCNVector3(0, 0, 0))
        scene.rootNode.addChildNode(SCNNode().with { $0.light = ambient })
        scene.rootNode.addChildNode(sunNode)
        for k in BODY_KINDS { let car = makeCar(k, 0x2f9bff).node; cars[k] = car; turntable.addChildNode(car) }
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
