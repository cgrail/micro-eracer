import SwiftUI
import UIKit

extension Color {
    init(hex: Int, opacity: Double = 1) {
        self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255, opacity: opacity)
    }
}

/// Comic lettering: Bangers, outlined in ink with a hard shadow.
struct Comic: View {
    let text: String, size: CGFloat
    var fill = Color.white
    var body: some View {
        let font = Font.custom("Bangers-Regular", size: size)
        ZStack {
            ForEach(Array([(-2, -2), (2, -2), (-2, 2), (2, 2), (3, 3), (0, -2), (0, 2), (-2, 0), (2, 0)].enumerated()), id: \.offset) { _, o in
                Text(text).font(font).foregroundColor(Color(hex: 0x111111)).offset(x: CGFloat(o.0), y: CGFloat(o.1))
            }
            Text(text).font(font).foregroundColor(fill)
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
