import SceneKit
import SwiftUI
import UIKit

// The start screen's Track picker (client/src/trackmap.ts and the picker in main.ts): the Track in 3D on its theme's
// ground, what it has in store, and ◀ ▶ that keep stepping while held.

// per layout: the server's Tracks replace the app's when it says which it races, and it may have changed one
private func keyOf(_ def: TrackDef) -> String { "\(def.id) \(def.pieces)" }
private var built: [String: Track] = [:]
private func trackOf(_ def: TrackDef) -> Track {
    if let t = built[keyOf(def)] { return t }
    let t = buildTrack(def)
    built[keyOf(def)] = t
    return t
}

private var factsOf: [String: [String]] = [:]
/// The lines beside the picture: length and turns, then the bridges, climbs and jumps (trackmap.ts `trackFacts`); for any
/// Track, how many there are (`of`).
func trackFacts(_ def: TrackDef?, of total: Int) -> [String] {
    guard let def else { return ["A new Track every Race", "\(total) to race on"] }
    if let f = factsOf[keyOf(def)] { return f }
    let track = trackOf(def), pieces = def.pieces.split(separator: " ")
    let count = { (c: Character) in pieces.filter { $0.first == c }.count }
    // a bridge: road high over another stretch of road
    let bridge = track.samples.contains { a in track.samples.contains { b in a.y > b.y + RISE * 0.7 && sq(a.x - b.x) + sq(a.z - b.z) < sq(HALF_WIDTH) } }
    let many = { (n: Int, one: String, more: String) in n == 1 ? one : "\(n) \(more)" }
    let extras = [bridge ? "a bridge" : "", count("U") > 0 ? many(count("U"), "a climb", "climbs") : "", count("J") > 0 ? many(count("J"), "a jump", "jumps") : ""].filter { !$0.isEmpty }
    let lines = ["\(Int((Double(track.n) / 10).rounded()) * 10) m, \(count("L") + count("R")) turns", extras.isEmpty ? "all on one level" : extras.joined(separator: ", ")]
    factsOf[keyOf(def)] = lines
    return lines
}

// how steeply the camera looks down on the Track; and how long a pick rests before its Track is built (◀ ▶ held step
// every 60 ms, far quicker than a Track builds)
private let TILT = 0.95, SETTLE = 0.15

/// The Track on its turntable (trackmap.ts `createCourse`): the picked Track with all its scenery, seen from above and
/// turning slowly, with a whirl as each one comes up. It is built on the render thread once the pick has rested; for none
/// (any Track) it draws nothing, and the start form shows a question mark instead.
final class Course: NSObject, ObservableObject, SCNSceneRendererDelegate {
    let scene = SCNScene(), camera = SCNNode()
    /// The view's width over its height, from its layout.
    var aspect = 1.0
    // the pick, set on the main thread and read on the render thread (hence the lock), and the Track shown, on the render thread
    private let lock = NSLock()
    private var wanted: TrackDef?, shown: TrackDef?, rest = 0.0
    private var look: TrackScene?, centre = SCNVector3(0, 0, 0), reach = 1.0, angle = 0.0, speed = 0.0, last = -1.0
    private let still = UIAccessibility.isReduceMotionEnabled

    override init() {
        super.init()
        camera.camera = SCNCamera()
        camera.camera!.fieldOfView = 30
        scene.rootNode.addChildNode(camera)
        let ambient = SCNLight(); ambient.type = .ambient; ambient.intensity = 560
        let sun = SCNLight(); sun.type = .directional; sun.intensity = 760
        let sunNode = SCNNode(); sunNode.light = sun; sunNode.position = SCNVector3(40, 80, 25); sunNode.look(at: SCNVector3(0, 0, 0))
        scene.rootNode.addChildNode(SCNNode().with { $0.light = ambient })
        scene.rootNode.addChildNode(sunNode)
    }

    func show(_ def: TrackDef?) {
        lock.lock()
        wanted = def
        lock.unlock()
        rest = 0
    }

    private func build(_ def: TrackDef?) {
        look?.node.removeFromParentNode()
        look = nil
        shown = def
        guard let def else { return }
        let track = buildTrack(def), xs = track.samples.map(\.x), zs = track.samples.map(\.z), s0 = track.samples[0]
        let look = buildTrackScene(track)
        self.look = look
        scene.rootNode.addChildNode(look.node)
        scene.background.contents = look.sky
        let cx = (xs.min()! + xs.max()!) / 2, cz = (zs.min()! + zs.max()!) / 2
        centre = SCNVector3(cx, 0, cz)
        reach = track.samples.map { hypot($0.x - cx, $0.z - cz) }.max()! + HALF_WIDTH + 2
        // first from behind the start line, as the chase camera sees it
        angle = atan2(-s0.dx, -s0.dz)
        if !still { speed = 2 }
    }

    func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
        let dt = last < 0 ? 0 : min(0.1, time - last)
        last = time
        rest += dt
        lock.lock()
        let pick = wanted
        lock.unlock()
        if pick != shown && rest > SETTLE { build(pick) }
        guard let look, let lens = camera.camera else { return }
        speed += ((still ? 0 : 0.15) - speed) * min(1, 3 * dt)
        angle += speed * dt
        look.update(time)
        // back far enough for the whole Track: across, and up and down, where the slant squashes it
        let half = tan(lens.fieldOfView * .pi / 360), dist = 1.1 * max(reach / (half * aspect), reach * sin(TILT) / half)
        lens.zNear = dist / 4
        lens.zFar = dist * 3
        camera.position = SCNVector3(Double(centre.x) + sin(angle) * cos(TILT) * dist, sin(TILT) * dist, Double(centre.z) + cos(angle) * cos(TILT) * dist)
        // world up: the one-argument look(at:) keeps the camera's own up, so the picture would roll a little more each turn
        camera.look(at: centre, up: SCNVector3(0, 1, 0), localFront: SCNVector3(0, 0, -1))
    }
}

struct CourseView: UIViewRepresentable {
    let course: Course
    func makeUIView(context: Context) -> SCNView {
        let v = SizedView()
        v.course = course
        v.scene = course.scene
        v.pointOfView = course.camera
        v.delegate = course
        v.antialiasingMode = .multisampling4X
        v.rendersContinuously = true
        v.isPlaying = true
        v.isUserInteractionEnabled = false
        v.accessibilityElementsHidden = true
        return v
    }
    func updateUIView(_ v: SCNView, context: Context) {}

    final class SizedView: SCNView {
        weak var course: Course?
        override func layoutSubviews() {
            super.layoutSubviews()
            course?.aspect = bounds.height > 0 ? bounds.width / bounds.height : 1
        }
    }
}

/// ◀ or ▶ that steps once when pressed and keeps stepping, faster and faster, while held.
struct RepeatStepper: View {
    let arrow: String, label: String, ink: Color, step: () -> Void
    @State private var timer: Timer?

    var body: some View {
        Text(arrow).font(.system(size: 22)).frame(width: 48, height: 44)
            .background(RoundedRectangle(cornerRadius: 12).fill(timer == nil ? Color.clear : Color(hex: 0x2f9bff)))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(ink, lineWidth: 3))
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0)
                .onChanged { _ in if timer == nil { step(); repeatAfter(0.45) } }
                .onEnded { _ in timer?.invalidate(); timer = nil })
            .accessibilityElement()
            .accessibilityLabel(label)
            .accessibilityAddTraits(.isButton)
            .accessibilityAction { step() }
    }

    private func repeatAfter(_ delay: Double) {
        timer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { _ in
            step()
            repeatAfter(max(0.06, delay * 0.8))
        }
    }
}

extension RepeatStepper {
    /// Out of sight and out of reach, but keeping its place: ◀ and ▶ while a running Race shows its Track.
    func locked(_ on: Bool) -> some View { opacity(on ? 0 : 1).allowsHitTesting(!on).accessibilityHidden(on) }
}
