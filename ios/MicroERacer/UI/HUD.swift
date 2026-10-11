import SwiftUI

// The HUD on iPhone and iPad, as client/src/hud.ts and style.css draw it: Position, Lap, Energy, the Item, messages, results
// and popups over the game. What it shows comes from `HudFeed` (Shared/HudFeed.swift).

struct HUDView: View {
    let hud: HudState
    @State private var pulse = false

    var body: some View {
        GeometryReader { box in
            ZStack(alignment: .topLeading) {
                if hud.danger {
                    Rectangle().fill(.clear).overlay(RadialGradient(colors: [.clear, Color(red: 1, green: 0.12, blue: 0.12, opacity: 0.55)], center: .center,
                                                                   startRadius: min(box.size.width, box.size.height) * 0.35, endRadius: max(box.size.width, box.size.height) * 0.7))
                        .opacity(pulse ? 1 : 0.35)
                        .onAppear { withAnimation(.easeInOut(duration: 0.6).repeatForever()) { pulse = true } }
                        .onDisappear { pulse = false }
                }
                VStack(alignment: .leading, spacing: 4) {
                    Comic(text: hud.pos, size: 52, fill: Color(hex: 0xffd60a))
                    energy
                    ZStack(alignment: .topLeading) {
                        ForEach(hud.popups) { p in PopupView(popup: p) }
                    }.padding(.leading, 44)
                }
                .padding(.leading, 16).padding(.top, 10)
                Comic(text: hud.lap, size: 32).frame(maxWidth: .infinity, alignment: .trailing).padding(.trailing, 16).padding(.top, 16)
                item.frame(maxWidth: .infinity).padding(.top, 12)
                VStack(spacing: 8) {
                    Comic(text: hud.msg, size: 64, fill: Color(hex: 0xffd60a))
                    Comic(text: hud.news, size: 24).multilineTextAlignment(.center).padding(.horizontal, 16)
                    if hud.boardMode == .over { board(size: 26) }
                }
                .frame(maxWidth: .infinity).padding(.top, box.size.height * 0.2)
                if hud.boardMode == .live { board(size: 18).frame(maxWidth: .infinity, alignment: .trailing).padding(.trailing, 16).padding(.top, 124) }
                if hud.offline {
                    Text("Offline Race: no server, just you and the Bots").font(.custom("Bangers-Regular", size: 16)).foregroundColor(Color(hex: 0x1b1410))
                        .padding(.horizontal, 12).padding(.vertical, 4)
                        .background(RoundedRectangle(cornerRadius: 10).fill(Color(hex: 0xfffdf6)))
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Color(hex: 0x111111), lineWidth: 2))
                        .frame(maxWidth: .infinity).padding(.top, 150)
                }
            }
            .frame(width: box.size.width, height: box.size.height, alignment: .topLeading)
            .background(hud.boardMode == .over ? Color.black.opacity(0.4) : .clear)
        }
        .allowsHitTesting(false)
    }

    private var energy: some View {
        HStack(spacing: 6) {
            Comic(text: "⚡", size: 28, fill: Color(hex: 0xffd60a))
            GeometryReader { bar in
                ZStack(alignment: .leading) {
                    Rectangle().fill(Color(hex: hud.energy < 25 ? 0xff4d4d : hud.energy < 50 ? 0xffd60a : 0x39e46b))
                        .frame(width: bar.size.width * CGFloat(hud.energy) / 100)
                        .animation(.linear(duration: 0.15), value: hud.energy)
                    // Limp Mode starts at a quarter
                    Path { p in p.move(to: CGPoint(x: bar.size.width / 4, y: 0)); p.addLine(to: CGPoint(x: bar.size.width / 4, y: bar.size.height)) }
                        .stroke(Color(hex: 0x111111), style: StrokeStyle(lineWidth: 3, dash: [4, 3]))
                }
            }
            .frame(width: 180, height: 20)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Color(hex: 0x111111), lineWidth: 3))
            .background(RoundedRectangle(cornerRadius: 10).fill(Color(hex: 0x111111)).offset(x: 3, y: 3))
        }
        .accessibilityElement().accessibilityLabel("Energy").accessibilityValue("\(hud.energy)")
    }

    private var item: some View {
        Text(hud.item).font(.system(size: 38))
            .frame(width: 64, height: 64)
            .background(RoundedRectangle(cornerRadius: 14).fill(Color(hex: 0xfffdf6)))
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color(hex: 0x111111), lineWidth: 3))
            .background(RoundedRectangle(cornerRadius: 14).fill(Color(hex: 0x111111)).offset(x: 4, y: 4))
            .accessibilityLabel("Item")
    }

    private func board(size: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            if !hud.title.isEmpty { Text(hud.title).font(.custom("Bangers-Regular", size: size + 6)) }
            ForEach(Array(hud.board.enumerated()), id: \.offset) { i, name in
                Text("\(i + 1). \(name)").font(.custom("Bangers-Regular", size: size)).foregroundColor(name == hud.me ? Color(hex: 0x2f9bff) : Color(hex: 0x1b1410))
            }
        }
        .foregroundColor(Color(hex: 0x1b1410))
        .padding(.horizontal, 18).padding(.vertical, 10)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0xfffdf6)))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color(hex: 0x111111), lineWidth: 3))
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(hex: 0x111111)).offset(x: 5, y: 5))
        .rotationEffect(.degrees(1))
    }
}

/// "+30" or "-12" rising from the Energy bar and fading.
private struct PopupView: View {
    let popup: Popup
    @State private var risen = false
    var body: some View {
        Comic(text: popup.text, size: 34, fill: Color(hex: popup.gain ? 0x39e46b : 0xff4d4d))
            .scaleEffect(risen ? 1 : 1.4).offset(y: risen ? -50 : 0).opacity(risen ? 0 : 1)
            .onAppear { withAnimation(.easeOut(duration: 1.2)) { risen = true } }
    }
}
