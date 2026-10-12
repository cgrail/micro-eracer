import SwiftUI
import UIKit

// The start screen's Track picker (client/src/trackmap.ts and the picker in main.ts): the Track from above on its theme's
// ground, what it has in store, and ◀ ▶ that keep stepping while held.

private var built: [String: Track] = [:]
private func trackOf(_ def: TrackDef) -> Track {
    if let t = built[def.id] { return t }
    let t = buildTrack(def)
    built[def.id] = t
    return t
}

private var factsOf: [String: [String]] = [:]
/// The lines beside the map: length and turns, then the bridges, climbs and jumps (trackmap.ts `trackFacts`).
func trackFacts(_ def: TrackDef?) -> [String] {
    guard let def else { return ["A new Track every Race", "\(TRACKS.count) to race on"] }
    if let f = factsOf[def.id] { return f }
    let track = trackOf(def), pieces = def.pieces.split(separator: " ")
    let count = { (c: Character) in pieces.filter { $0.first == c }.count }
    // a bridge: road high over another stretch of road
    let bridge = track.samples.contains { a in track.samples.contains { b in a.y > b.y + RISE * 0.7 && sq(a.x - b.x) + sq(a.z - b.z) < sq(HALF_WIDTH) } }
    let many = { (n: Int, one: String, more: String) in n == 1 ? one : "\(n) \(more)" }
    let extras = [bridge ? "a bridge" : "", count("U") > 0 ? many(count("U"), "a climb", "climbs") : "", count("J") > 0 ? many(count("J"), "a jump", "jumps") : ""].filter { !$0.isEmpty }
    let lines = ["\(Int((Double(track.n) / 10).rounded()) * 10) m, \(count("L") + count("R")) turns", extras.isEmpty ? "all on one level" : extras.joined(separator: ", ")]
    factsOf[def.id] = lines
    return lines
}

private var grounds: [Theme: UIImage] = [:]
private func groundOf(_ theme: Theme) -> UIImage {
    if let g = grounds[theme] { return g }
    let g = themeLook(theme).ground()
    grounds[theme] = g
    return g
}

/// The Track seen from above, its start straight running up the picture; for none (any Track), a question mark.
struct TrackMap: View {
    let def: TrackDef?

    var body: some View {
        Canvas { g, size in
            let w = Double(size.width), h = Double(size.height)
            guard let def else {
                g.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Color(hex: 0x2f9bff)))
                g.draw(Text("?").font(.custom("Bangers-Regular", size: size.height * 0.8)).foregroundColor(Color(hex: 0xffd60a)), at: CGPoint(x: w / 2, y: h * 0.56))
                return
            }
            let track = trackOf(def), xs = track.samples.map(\.x), zs = track.samples.map(\.z)
            let x0 = xs.min()!, x1 = xs.max()!, z0 = zs.min()!, z1 = zs.max()!, pad = 10.0
            let scale = min((w - 2 * pad) / (x1 - x0 + 2 * HALF_WIDTH), (h - 2 * pad) / (z1 - z0 + 2 * HALF_WIDTH))
            func at(_ x: Double, _ z: Double) -> CGPoint { CGPoint(x: w / 2 - (x - (x0 + x1) / 2) * scale, y: h / 2 - (z - (z0 + z1) / 2) * scale) }
            func road(_ from: Int, _ to: Int) -> Path {
                var path = Path()
                for i in from...to {
                    let s = track.samples[i % track.n]
                    if i == from { path.move(to: at(s.x, s.z)) } else { path.addLine(to: at(s.x, s.z)) }
                }
                return path
            }
            // the ground tile is 17 m across, as in the game
            g.fill(Path(CGRect(origin: .zero, size: size)), with: .tiledImage(Image(uiImage: groundOf(def.theme)), scale: 17 * scale / 256))
            // the whole road, then the raised stretches again on top, so a bridge lies over the road it crosses
            var paths = [road(0, track.n)], start = -1
            for i in 0...track.n {
                let up = track.samples[i % track.n].y > RISE * 0.5
                if up && start < 0 { start = i }
                if !up && start >= 0 { paths.append(road(max(0, start - 1), i)); start = -1 }
            }
            let width = max(4, 2 * HALF_WIDTH * scale)
            for path in paths {
                g.stroke(path, with: .color(Color(hex: 0x111111)), style: StrokeStyle(lineWidth: width + 3, lineCap: .round, lineJoin: .round))
                g.stroke(path, with: .color(Color(hex: 0x51565f)), style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round))
            }
            let s = track.samples[0]
            var line = Path()
            line.move(to: at(s.x - s.dz * HALF_WIDTH, s.z + s.dx * HALF_WIDTH))
            line.addLine(to: at(s.x + s.dz * HALF_WIDTH, s.z - s.dx * HALF_WIDTH))
            g.stroke(line, with: .color(.white), lineWidth: 3)
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
