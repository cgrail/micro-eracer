import Foundation

// The logic of client/src/hud.ts: what the HUD shows, worked out on the game's thread. Each device draws it its own way
// (`HUDView` on iPhone and iPad, `WatchHUD` on the watch).

let ITEM_ICONS: [String: String] = ["zap": "⚡", "missile": "🚀", "mine": "💣", "shield": "🛡️"]
/// The Item an E-Car holds, with the Shots left in a Zap.
func itemLabel(_ c: CarState) -> String { (ITEM_ICONS[c.item] ?? "") + (c.item == "zap" ? "\(c.ammo)" : "") }

struct Popup: Identifiable, Equatable { let id: Int; let text: String; let gain: Bool; let born: Double }

/// What the HUD shows, worked out on the game's thread (`HudFeed`) and handed to SwiftUI when it changes.
struct HudState: Equatable {
    enum Board { case hidden, live, over }
    var pos = "", lap = "", news = "", item = "", action = ""
    /// The big message in the middle: until the game first hands over its HUD, the Race is still loading.
    var msg = "Loading…"
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
            h.pos = "P\(me.position)/\(state.cars.count)"
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
