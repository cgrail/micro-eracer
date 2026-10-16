import SwiftUI
import UIKit

extension Color {
    init(hex: Int, opacity: Double = 1) {
        self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255, opacity: opacity)
    }
}

extension Text {
    /// Lettering in Bangers. Its slanted letters reach up to 0.14 em past their advance, and iOS clips a Text's glyphs to its
    /// frame, so the last letter gets that much room after it.
    init(bangers text: String, size: CGFloat) {
        var s = AttributedString(text)
        s.font = .custom("Bangers-Regular", size: size)
        if let last = s.characters.indices.last { s[last...].tracking = size * 0.15 }
        self.init(s)
    }
}

extension HudState {
    /// A line of the board: "1. Name", or after a Race, for those who were still racing when it ended, "Name not finished".
    func standing(_ i: Int, _ name: String, size: CGFloat) -> Text {
        i < finishers ? Text(bangers: "\(i + 1). \(name)", size: size)
            : Text(bangers: name, size: size) + Text(bangers: " not finished", size: size * 0.6).foregroundColor(Color(hex: 0x1b1410, opacity: 0.6))
    }
}

/// Comic lettering: Bangers, outlined in ink with a hard shadow.
struct Comic: View {
    let text: String, size: CGFloat
    var fill = Color.white
    var body: some View {
        ZStack {
            ForEach(Array([(-2, -2), (2, -2), (-2, 2), (2, 2), (3, 3), (0, -2), (0, 2), (-2, 0), (2, 0)].enumerated()), id: \.offset) { _, o in
                Text(bangers: text, size: size).foregroundColor(Color(hex: 0x111111)).offset(x: CGFloat(o.0), y: CGFloat(o.1))
            }
            Text(bangers: text, size: size).foregroundColor(fill)
        }
        .kerning(1)
    }
}

/// Comic print: a faint halftone dot screen over the whole game (style.css `#halftone`), a dot every 5 points. The dots are
/// black, so drawing them plainly looks the same as the browsers' multiply blend.
struct Halftone: View {
    private static let tile: UIImage = {
        let scale = 3.0, size = Int(5 * scale), middle = CGPoint(x: 2.5 * scale, y: 2.5 * scale)
        let g = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        let ink = UIColor(white: 0, alpha: 0.18).cgColor, none = UIColor(white: 0, alpha: 0).cgColor
        let dot = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [ink, ink, none] as CFArray, locations: [0, 0.8 / 1.3, 1])!
        g.drawRadialGradient(dot, startCenter: middle, startRadius: 0, endCenter: middle, endRadius: 1.3 * scale, options: [])
        return UIImage(cgImage: g.makeImage()!, scale: scale, orientation: .up)
    }()

    var body: some View {
        Image(uiImage: Self.tile).resizable(resizingMode: .tile).opacity(0.35).ignoresSafeArea().allowsHitTesting(false).accessibilityHidden(true)
    }
}

/// The steering wheel (in the middle of the phone's pad, at the foot of the watch's screen), turned as the E-Car steers.
struct Wheel: View {
    var body: some View {
        Canvas { g, size in
            let s = min(size.width, size.height) / 100
            g.translateBy(x: size.width / 2, y: size.height / 2)
            g.scaleBy(x: s, y: s)
            let spokes = Path { p in p.move(to: CGPoint(x: -38, y: 0)); p.addLine(to: CGPoint(x: 38, y: 0)); p.move(to: .zero); p.addLine(to: CGPoint(x: 0, y: 38)) }
            let rim = Path(ellipseIn: CGRect(x: -38, y: -38, width: 76, height: 76))
            for (path, ink, w) in [(spokes, 0x111111, 17.0), (rim, 0x111111, 18), (spokes, 0x3a3f47, 9), (rim, 0x3a3f47, 10)] {
                g.stroke(path, with: .color(Color(hex: ink)), style: StrokeStyle(lineWidth: w, lineCap: .round))
            }
            g.stroke(Path { $0.addArc(center: .zero, radius: 38, startAngle: .degrees(-103.7), endAngle: .degrees(-76.3), clockwise: false) },
                     with: .color(Color(hex: 0xffd60a)), lineWidth: 10)
            g.fill(Path(ellipseIn: CGRect(x: -13, y: -13, width: 26, height: 26)), with: .color(Color(hex: 0xffd60a)))
            g.stroke(Path(ellipseIn: CGRect(x: -13, y: -13, width: 26, height: 26)), with: .color(Color(hex: 0x111111)), lineWidth: 4)
        }
        .allowsHitTesting(false)
    }
}
