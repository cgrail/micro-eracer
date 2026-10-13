import SwiftUI

// The Practice Ground's screen (`#practice` in client/index.html, main.ts): the game view under the touch controls as in a
// Race, with the Steering and Pad settings over it, so each can be tried out at once.

private let STEER_HINTS: [Steering: String] = [
    .buttons: "Hold a thumb anywhere left or right of the wheel's middle, and rock it across to turn the other way.",
    .slider: "Put a thumb down anywhere and drag it left or right: the further, the sharper.",
]

struct PracticeView: View {
    @ObservedObject var model: AppModel
    let practice: Practice
    @Environment(\.colorScheme) private var scheme
    @Environment(\.verticalSizeClass) private var vertical

    private var paper: Color { scheme == .dark ? Color(hex: 0x2f2620) : Color(hex: 0xfffdf6) }
    private var ink: Color { scheme == .dark ? Color(hex: 0xfff6e6) : Color(hex: 0x1b1410) }

    var body: some View {
        // a phone lying down has no height to spare above the action button: one row, without the title and the hint
        let low = vertical == .compact
        ZStack {
            GameView(game: practice).ignoresSafeArea()
            Halftone()
            TouchControls(controls: model.controls, steering: model.steering, side: model.side, action: "⚡", showBack: false)
            panel(low: low)
                .frame(maxWidth: low ? 560 : 440)
                .padding(.horizontal, 12).padding(.top, 12)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        // otherwise iOS holds back a touch near the screen's edges until it moves, so a still thumb on the pad did nothing
        .defersSystemGestures(on: .all)
    }

    private func panel(low: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if !low {
                HStack {
                    Comic(text: "Controls", size: 30, fill: Color(hex: 0xffd60a))
                    Spacer()
                    done
                }
            }
            HStack(alignment: .bottom, spacing: 12) {
                choice("Steering") {
                    pick(model.steering == .slider, "Slider", "drag left or right") { model.steering = .slider }
                    pick(model.steering == .buttons, "Buttons", "hold left or right") { model.steering = .buttons }
                }
                choice("Pad") {
                    pick(model.side == .left, "Left", "for the left thumb") { model.side = .left }
                    pick(model.side == .right, "Right", "for the right thumb") { model.side = .right }
                }
                if low { done }
            }
            if !low {
                Text("\(STEER_HINTS[model.steering]!) The E-Car drives by itself, and the yellow button shoots.")
                    .font(.system(size: 14)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .foregroundColor(ink)
        .padding(.horizontal, 14).padding(.vertical, low ? 8 : 10)
        .background(RoundedRectangle(cornerRadius: 18).fill(paper))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(ink, lineWidth: 4))
        .background(RoundedRectangle(cornerRadius: 18).fill(ink).offset(x: 6, y: 6))
        .rotationEffect(.degrees(-1))
    }

    private var done: some View {
        Button { model.closePractice() } label: {
            Text("Done").font(.custom("Bangers-Regular", size: 22)).foregroundColor(Color(hex: 0x1b1410))
                .padding(.horizontal, 20).frame(minHeight: 44)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0xffd60a)))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(ink, lineWidth: 3))
                .background(RoundedRectangle(cornerRadius: 12).fill(ink).offset(x: 3, y: 3))
        }
    }

    private func choice<Buttons: View>(_ title: String, @ViewBuilder _ buttons: () -> Buttons) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.custom("Bangers-Regular", size: 18)).kerning(0.5)
            HStack(spacing: 6) { buttons() }
        }
    }

    /// One of two choices; the hint is for VoiceOver, as the browsers keep it in a tooltip.
    private func pick(_ on: Bool, _ title: String, _ hint: String, _ choose: @escaping () -> Void) -> some View {
        Button(action: choose) {
            Text(title).font(.custom("Bangers-Regular", size: 18))
                .foregroundColor(on ? .white : ink).frame(maxWidth: .infinity, minHeight: 44)
                .background(RoundedRectangle(cornerRadius: 12).fill(on ? Color(hex: 0x2f9bff) : .clear))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(ink, lineWidth: 3))
        }
        .accessibilityHint(hint)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}
