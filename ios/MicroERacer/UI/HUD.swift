import SwiftUI

// client/src/hud.ts: Position, Lap, Energy, the Item, messages, results and popups over the game.

let ITEM_ICONS: [String: String] = ["zap": "⚡", "missile": "🚀", "mine": "💣", "shield": "🛡️"]
/// The Item an E-Car holds, with the Shots left in a Zap.
func itemLabel(_ c: CarState) -> String { (ITEM_ICONS[c.item] ?? "") + (c.item == "zap" ? "\(c.ammo)" : "") }

struct Popup: Identifiable, Equatable { let id: Int; let text: String; let gain: Bool; let born: Double }

/// What the HUD shows, worked out on the game's thread (`HudFeed`) and handed to SwiftUI when it changes.
struct HudState: Equatable {
    enum Board { case hidden, live, over }
    var pos = "", lap = "", msg = "", news = "", item = "", action = ""
    var energy = 100, danger = false, showBack = false, offline = false
    var board: [String] = [], me = "", boardMode = Board.hidden, title = ""
    var popups: [Popup] = []
    /// How far the view is greyed out: all the way while Stranded, colour coming back as the drone Recharges.
    var grey = 0.0
}

final class HudFeed {
    private let sound: Sound
    private var lastPhase: Phase?, lastCount = -1, goUntil = 0.0, newsUntil = 0.0, news = ""
    private var popups: [Popup] = [], nextPopup = 0, rouletteUntil = 0.0
    var offline = false

    init(sound: Sound) { self.sound = sound }

    /// `me` is our own E-Car; `status` a connection message that wins over everything else.
    func update(_ now: Double, _ state: RaceState, _ me: CarState?, _ status: String, showBack: Bool) -> HudState {
        if lastPhase == .grid && state.phase == .racing { goUntil = now + 1; sound.countdown(true) }
        lastPhase = state.phase
        let left = Int(state.timer.rounded(.up))
        if state.phase == .grid && left != lastCount && left > 0 && left <= 3 { sound.countdown(false) }
        lastCount = state.phase == .grid ? left : -1
        var h = HudState(offline: offline)
        // the grid counts down 3, 2, 1 in big numbers, after a Race too
        h.msg = !status.isEmpty ? status : state.phase == .grid ? "\(left)" : me?.mode == STRANDED ? "Battery empty!" : me?.mode == RECHARGE ? "Recharging…"
            : me?.finished == true ? "Finished P\(me!.position)!" : state.phase == .finishing ? "Race ends in \(left)" : now < goUntil ? "GO!" : ""
        if let me {
            h.pos = "P\(me.position)/\(SEATS)"
            h.lap = "Lap \(me.lap)/\(LAPS)"
            h.action = itemLabel(me)
            h.me = me.name
            // a short roulette before the Item shows
            h.item = now < rouletteUntil ? ["⚡", "🚀", "💣", "🛡️"][Int((rouletteUntil - now) * 10) % 4] : itemLabel(me)
        }
        h.energy = me?.energy ?? 100
        h.danger = me != nil && state.phase != .grid && (h.energy < 15 || me!.mode == STRANDED)
        h.grey = me?.mode == STRANDED ? 1 : me?.mode == RECHARGE ? 1 - Double(h.energy) / MAX_ENERGY : 0
        // once someone has finished, the standings fill up as each Racer crosses the line; on the grid, the last Race's final order
        if state.phase == .grid { h.board = state.results } else if state.phase == .finishing {
            h.board = state.cars.filter(\.finished).sorted { $0.position < $1.position }.map(\.name)
        }
        // finished (or on the grid after a Race) it's the end: the board moves to the middle under a title
        let over = state.phase == .grid ? !state.results.isEmpty : state.phase == .finishing && me?.finished == true
        h.title = !over ? "" : state.phase == .grid ? "🏁 Race over" : "🏁 Next race in \(left)"
        h.boardMode = h.board.isEmpty ? .hidden : over ? .over : .live
        h.news = now < newsUntil ? news : ""
        popups.removeAll { now - $0.born > 1.2 }
        h.popups = popups
        h.showBack = showBack
        return h
    }

    /// Shows a line of news for a few seconds; a newer one replaces it.
    func announce(_ text: String, _ now: Double) { news = text; newsUntil = now + 3.5 }
    func popup(_ text: String, gain: Bool, _ now: Double) { nextPopup += 1; popups.append(Popup(id: nextPopup, text: text, gain: gain, born: now)) }
    func roulette(_ now: Double) { rouletteUntil = now + 0.5 }
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
