import SwiftUI

// client/src/input.ts for touch: the E-Car accelerates by itself, the left thumb steers, the right thumb has one action
// button that uses the Item, and a Back button (reverse) shows only while the E-Car is stuck.

/// How the left thumb steers: by dragging on the pad, or by holding its left or right half.
enum Steering: String, CaseIterable { case slider, buttons }

private let STEER_DEAD = 6.0, STEER_FULL = 100.0
/// Drag distance (points) to steering: a small dead zone, then gentle near the middle for small corrections, full lock at STEER_FULL.
private func steerCurve(_ dx: Double) -> Double {
    let k = min(1, max(0, abs(dx) - STEER_DEAD) / (STEER_FULL - STEER_DEAD))
    return (dx < 0 ? -1 : 1) * pow(k, 1.4)
}

struct TouchControls: View {
    let controls: Controls
    let steering: Steering
    /// What the action button says: the Item, with the Shots left in a Zap.
    let action: String
    let showBack: Bool
    @State private var start: Double?
    @State private var turn = 0.0
    @State private var held = ""

    var body: some View {
        GeometryReader { box in
            ZStack(alignment: .bottom) {
                pad(width: box.size.width * 0.45, height: max(88, box.size.height * 0.28))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.leading, 16).padding(.bottom, 16)
                VStack(spacing: 26) {
                    if showBack { HoldButton(label: "◀\u{FE0E} Back", fill: Color(hex: 0xff4d4d, opacity: 0.85), ink: .white, size: CGSize(width: 96, height: 56), radius: 14) { controls.setReversing($0) } }
                    HoldButton(label: action, fill: Color(hex: 0xffc81e, opacity: 0.85), ink: Color(hex: 0x111111), size: CGSize(width: 108, height: 108), radius: 54) { controls.setFiring($0) }
                        // nothing to use: an Item Box will fill it
                        .opacity(action.isEmpty ? 0.45 : 1)
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.trailing, 24).padding(.bottom, 24)
            }
            .frame(maxHeight: .infinity, alignment: .bottom)
        }
        .onChange(of: showBack) { if !$0 { controls.setReversing(false) } }
    }

    private func pad(width: CGFloat, height: CGFloat) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 20).fill(Color.white.opacity(0.18))
            RoundedRectangle(cornerRadius: 20).strokeBorder(Color.black.opacity(0.5), lineWidth: 3)
            HStack(spacing: 0) {
                half(lit: held == "left")
                if steering == .buttons { Rectangle().fill(Color.black.opacity(0.5)).frame(width: 3) }
                half(lit: held == "right")
            }
            Wheel().frame(width: min(height * 0.8, width * 0.56), height: min(height * 0.8, width * 0.56)).rotationEffect(.degrees(turn * 90))
        }
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .frame(width: width, height: height)
        .contentShape(Rectangle())
        .gesture(DragGesture(minimumDistance: 0).onChanged { g in
            if start == nil { start = g.startLocation.x }
            // Buttons: the thumb can rock from one half to the other without lifting; the held half lights up
            let s = steering == .slider ? steerCurve(g.location.x - start!) : g.location.x < width / 2 ? -1 : 1
            turn = s
            held = steering == .slider ? "" : s < 0 ? "left" : "right"
            controls.setSteer(s)
        }.onEnded { _ in start = nil; turn = 0; held = ""; controls.setSteer(0) })
        .accessibilityLabel(steering == .buttons ? "Steer: hold left or right" : "Steer: drag left or right")
    }

    private func half(lit: Bool) -> some View {
        Rectangle().fill(lit ? Color.white.opacity(0.35) : .clear)
    }
}

/// A button for thumbs that acts while held (pointer events on the web, not clicks).
struct HoldButton: View {
    let label: String, fill: Color, ink: Color, size: CGSize, radius: CGFloat
    let onHold: (Bool) -> Void
    @State private var down = false

    var body: some View {
        Text(label).font(.custom("Bangers-Regular", size: size.height > 100 ? 30 : 20)).foregroundColor(ink)
            .frame(width: size.width, height: size.height)
            .background(RoundedRectangle(cornerRadius: radius).fill(fill))
            .overlay(RoundedRectangle(cornerRadius: radius).strokeBorder(Color(hex: 0x111111), lineWidth: 3))
            .background(RoundedRectangle(cornerRadius: radius).fill(Color(hex: 0x111111)).offset(x: 4, y: 4))
            .scaleEffect(down ? 0.94 : 1)
            .gesture(DragGesture(minimumDistance: 0).onChanged { _ in if !down { down = true; onHold(true) } }.onEnded { _ in down = false; onHold(false) })
            .accessibilityLabel(label.isEmpty ? "Use the Item" : label)
    }
}

/// The steering wheel in the middle of the pad, turning as the thumb steers.
private struct Wheel: View {
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
