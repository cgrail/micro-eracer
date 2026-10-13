import SwiftUI
import UIKit

/// Behind the start form (style.css `#backdrop`, client/index.html): comic rays from the middle, a chequered flag across the
/// top and the bottom, and stickers of the game's things bobbing about, under the halftone dots.
struct Backdrop: View {
    @Environment(\.colorScheme) private var scheme
    @State private var up = false
    private let still = UIAccessibility.isReduceMotionEnabled
    /// What each sticker shows, where its middle is (in parts of the screen) and how far it leans, as in index.html.
    private static let stickers: [(String, CGFloat, CGFloat, Double)] = [
        ("⚡", 0.08, 0.12, -16), ("🔋", 0.88, 0.09, 12), ("🚀", 0.85, 0.34, 24), ("🛡️", 0.10, 0.40, -10),
        ("💣", 0.90, 0.64, -12), ("🏁", 0.07, 0.72, 14), ("⚡", 0.82, 0.90, 18), ("🔋", 0.16, 0.91, -20),
    ]

    var body: some View {
        let dark = scheme == .dark, ink = Color(hex: dark ? 0xfff6e6 : 0x1b1410)
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack {
                Color(hex: dark ? 0x2a2118 : 0xffe9c9)
                // 24 rays of 7.5°, every other one painted, from the top round clockwise
                Canvas { g, size in
                    let c = CGPoint(x: size.width / 2, y: size.height / 2), r = hypot(size.width, size.height)
                    var rays = Path()
                    for i in 0..<24 {
                        let a = Double(i) * .pi / 12 - .pi / 2
                        rays.move(to: c)
                        rays.addLine(to: CGPoint(x: c.x + r * cos(a), y: c.y + r * sin(a)))
                        rays.addLine(to: CGPoint(x: c.x + r * cos(a + .pi / 24), y: c.y + r * sin(a + .pi / 24)))
                        rays.closeSubpath()
                    }
                    g.fill(rays, with: .color(Color(hex: dark ? 0x33281e : 0xffdcae)))
                }
                flag(w).position(x: w / 2, y: h * 0.05 + 19)
                flag(w).position(x: w / 2, y: h * 0.95 - 19)
                ForEach(Array(Self.stickers.enumerated()), id: \.offset) { i, s in
                    // every other one is half a bob behind
                    let high = !still && up == i.isMultiple(of: 2)
                    Text(s.0).font(.system(size: 42)).shadow(color: ink, radius: 0, x: 3, y: 3).rotationEffect(.degrees(s.3))
                        .offset(y: high ? -8 : 0).position(x: w * s.1, y: h * s.2)
                }
                Halftone()
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear { if !still { withAnimation(.easeInOut(duration: 1.6).repeatForever()) { up = true } } }
    }

    /// A chequered flag a fifth wider than the screen: 16-point checks in two rows between two ink lines, leaning a little.
    private func flag(_ w: CGFloat) -> some View {
        Canvas { g, size in
            g.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Color(hex: 0x111111)))
            for col in 0..<Int(size.width / 16) + 1 {
                for row in 0..<2 where (col + row).isMultiple(of: 2) {
                    g.fill(Path(CGRect(x: CGFloat(col) * 16, y: 3 + CGFloat(row) * 16, width: 16, height: 16)), with: .color(.white))
                }
            }
        }
        .frame(width: w * 1.2, height: 38)
        .rotationEffect(.degrees(-4))
    }
}
