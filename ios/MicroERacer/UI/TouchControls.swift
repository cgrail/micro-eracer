import SwiftUI

// client/src/input.ts for touch: the E-Car accelerates by itself, a thumb anywhere on the screen steers, one action button
// above the steering pad uses the Item, and a Back button (reverse) shows only while the E-Car is stuck.

/// How the thumb steers: by dragging, or by holding left or right of the pad's middle.
enum Steering: String, CaseIterable { case slider, buttons }
/// Which bottom corner the steering pad, with the action button above it, sits in.
enum PadSide: String, CaseIterable { case left, right }

private let STEER_DEAD = 6.0, STEER_FULL = 100.0
/// Drag distance (points) to steering: a small dead zone, then gentle near the middle for small corrections, full lock at STEER_FULL.
private func steerCurve(_ dx: Double) -> Double {
    let k = min(1, max(0, abs(dx) - STEER_DEAD) / (STEER_FULL - STEER_DEAD))
    return (dx < 0 ? -1 : 1) * pow(k, 1.4)
}

struct TouchControls: View {
    let controls: Controls
    let steering: Steering
    let side: PadSide
    /// What the action button says: the Item, with the Shots left in a Zap.
    let action: String
    let showBack: Bool
    @State private var start: Double?
    @State private var turn = 0.0
    @State private var held = ""

    var body: some View {
        GeometryReader { box in
            let w = box.size.width * 0.45, h = max(88, box.size.height * 0.28), left = side == .left
            ZStack(alignment: left ? .bottomLeading : .bottomTrailing) {
                // the whole screen steers but for the buttons on it; the pad's middle (in the window) splits left from right
                Touch(onTouch: steer(middle: box.frame(in: .global).minX + (left ? 16 + w / 2 : box.size.width - 16 - w / 2))).ignoresSafeArea()
                    .accessibilityLabel(steering == .buttons ? "Steer: hold left or right" : "Steer: drag left or right")
                pad(width: w, height: h).allowsHitTesting(false)
                    .padding(left ? .leading : .trailing, 16).padding(.bottom, 16)
                HoldButton(label: action, fill: Color(hex: 0xffc81e, opacity: 0.85), ink: Color(hex: 0x111111), size: CGSize(width: 108, height: 108), radius: 54) { controls.setFiring($0) }
                    // nothing to use: an Item Box will fill it
                    .opacity(action.isEmpty ? 0.45 : 1)
                    .frame(width: w)
                    .padding(left ? .leading : .trailing, 16).padding(.bottom, 16 + h + 16)
                if showBack {
                    HoldButton(label: "◀\u{FE0E} Back", fill: Color(hex: 0xff4d4d, opacity: 0.85), ink: .white, size: CGSize(width: 96, height: 56), radius: 14) { controls.setReversing($0) }
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: left ? .bottomTrailing : .bottomLeading)
                        .padding(24)
                }
            }
        }
        .onChange(of: showBack) { if !$0 { controls.setReversing(false) } }
    }

    /// One finger steers, from wherever it lands: Slider by how far it has dragged, Buttons by its side of the pad's middle.
    private func steer(middle: CGFloat) -> (CGPoint?) -> Void {
        { at in
            guard let at else { start = nil; turn = 0; held = ""; controls.setSteer(0); return }
            if start == nil { start = at.x }
            // Buttons: the thumb can rock from one side to the other without lifting; the held half of the pad lights up
            let s = steering == .slider ? steerCurve(at.x - start!) : at.x < middle ? -1 : 1
            turn = s
            held = steering == .slider ? "" : s < 0 ? "left" : "right"
            controls.setSteer(s)
        }
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
            .overlay(Touch { at in if (at != nil) != down { down = at != nil; onHold(down) } })
            .accessibilityLabel(label.isEmpty ? "Use the Item" : label)
    }
}

/// One finger's raw touches, as the browser's pointer events: down the moment it lands (SwiftUI's DragGesture waited for it to
/// move), then where it is in the window while it moves, and nil when it lifts. Further fingers on the same view are ignored.
private struct Touch: UIViewRepresentable {
    let onTouch: (CGPoint?) -> Void

    func makeUIView(context: Context) -> Surface { Surface() }
    func updateUIView(_ view: Surface, context: Context) { view.onTouch = onTouch }

    final class Surface: UIView {
        var onTouch: (CGPoint?) -> Void = { _ in }
        override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) { onTouch(touches.first?.location(in: nil)) }
        override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) { onTouch(touches.first?.location(in: nil)) }
        override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) { onTouch(nil) }
        override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) { onTouch(nil) }
    }
}
