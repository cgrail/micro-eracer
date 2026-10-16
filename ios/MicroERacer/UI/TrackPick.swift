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
    let arrow: String, label: String, ink: Color
    /// Where the keyboard is on its picker (MenuKeys), as the browsers light its arrows.
    var lit = false
    let step: () -> Void
    @State private var timer: Timer?

    var body: some View {
        Text(arrow).font(.system(size: 22)).foregroundColor(lit ? Color(hex: 0x1b1410) : ink).frame(width: 48, height: 44)
            .background(RoundedRectangle(cornerRadius: 12).fill(lit ? Color(hex: 0xffd60a) : timer == nil ? Color.clear : Color(hex: 0x2f9bff)))
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
