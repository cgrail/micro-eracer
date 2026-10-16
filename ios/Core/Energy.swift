import Foundation

// shared/src/energy.ts: Batteries, the Recharge's length, and the Leader's pace.

let BATTERY_CHARGE = 30.0
private let BATTERY_EVERY = 1.4, MAX_BATTERIES = 7, BATTERY_LIFE = 25.0, PICKUP_RADIUS = 2.4
/// For each Position from 2nd, how likely the next Battery is to appear just ahead of that Racer. The Leader gets none:
/// out in front, the Charging Station is the only way to keep going.
private let BATTERY_ODDS = [0.06, 0.1, 0.12, 0.17, 0.17, 0.17, 0.18]
/// The shortest Recharge, and the longest.
let RECHARGE_TIME = 1.6
private let RECHARGE_MAX = 9.0
/// How many Racers must be able to get past a Stranded E-Car in the top three before its Recharge is done.
private let MUST_PASS = [3, 2, 1]
/// Keeping the front three fighting (see `PACK` in energy.ts).
private let PACK: [(free: Double, full: Double, slowest: Double)] = [(2, 20, 0.75), (4, 25, 0.88)]
/// Second and third get a tow, up to TOW of top speed, once the E-Car ahead is more than TOW_FROM metres away.
private let TOW = 1.06, TOW_FROM = 6.0, TOW_FULL = 25.0

/// Which Racer, by Position from 0, a Battery appears ahead of: never the Leader, and behind them by BATTERY_ODDS, each share
/// spread over as many Racers in a field bigger than theirs (energy.ts `batteryRank`).
func batteryRank(_ field: Int) -> Int {
    var roll = Double.random(in: 0..<1), k = 0
    while k < BATTERY_ODDS.count - 1 { roll -= BATTERY_ODDS[k]; if roll > 0 { k += 1 } else { break } }
    let behind = field - 1
    return 1 + (behind > BATTERY_ODDS.count ? Int(floor((Double(k) + Double.random(in: 0..<1)) * Double(behind) / Double(BATTERY_ODDS.count))) : k)
}

func updateBatteries(_ sim: RaceSim, _ ranked: [Seat]) {
    sim.batteries = sim.batteries.filter { $0.until > sim.time }
    if sim.time >= sim.nextBatteryAt && sim.batteries.count < MAX_BATTERIES {
        // a Battery appears just ahead of one Racer, picked by Position: plenty at the back, scarce at the front
        let k = batteryRank(ranked.count), s = ranked[k]
        if !s.finished {
            // between that Racer and the one in front: further ahead, someone in front would get to it first
            let gap = Double(ranked[k - 1].progress.u - s.progress.u), reach = max(6, min(30, gap - 4))
            let idx = (s.progress.idx + 6 + Int(floor(Double.random(in: 0..<1) * (reach - 5)))) % sim.track.n
            let pose = poseAt(sim.track, idx, Double.random(in: -1..<1) * (HALF_WIDTH - 1.2))
            // never inside an Item Box; the next spawn tries elsewhere
            if !sim.track.itemBoxes.contains(where: { sq($0.x - pose.x) + sq($0.z - pose.z) < 9 }) {
                sim.batteryId += 1
                sim.batteries.append(Battery(id: sim.batteryId, x: pose.x, y: sim.track.samples[idx].y, z: pose.z, idx: idx, until: sim.time + BATTERY_LIFE))
            }
        }
        sim.nextBatteryAt = sim.time + BATTERY_EVERY
    }
    // the Leader drives through one, as from Item Boxes the front gets nothing
    for s in sim.seats where !sim.isRecharging(s) && s.position != 1 {
        let t = s.car.rb.translation
        guard let hit = sim.batteries.firstIndex(where: { sq($0.x - t.x) + sq($0.z - t.z) < sq(PICKUP_RADIUS) && sameLevel($0.y, t.y) }) else { continue }
        s.energy = min(MAX_ENERGY, s.energy + BATTERY_CHARGE)
        sim.batteries.remove(at: hit)
        sim.stats.pickups += 1
        sim.emit(.battery(s: s.index))
    }
}

/// How long the drone takes to fill a Stranded E-Car: RECHARGE_TIME at the back; near the front, until enough Racers behind
/// could drive past (`MUST_PASS`), at most RECHARGE_MAX.
func rechargeLength(_ s: Seat, _ ranked: [Seat]) -> Double {
    let behind = ranked.filter { $0.position > s.position && !$0.finished }
    let k = min(s.position - 1 < MUST_PASS.count ? MUST_PASS[s.position - 1] : 0, behind.count) - 1
    guard k >= 0 else { return RECHARGE_TIME }
    let chaser = behind[k]
    // a second more, so it is past and not alongside
    let gap = Double(s.progress.u - chaser.progress.u), speed = max(10, hypot(chaser.vx, chaser.vz))
    return clamp(gap / speed + 1, RECHARGE_TIME, RECHARGE_MAX)
}

/// Holds the front three together (`PACK`, `TOW`); everyone else drives at full pace.
func leadPace(_ ranked: [Seat]) {
    for s in ranked { s.pace = 1 }
    let gap = { (i: Int) in Double(ranked[i].progress.u - ranked[i + 1].progress.u) }
    let racing = { (i: Int) in i + 1 < ranked.count && !ranked[i].finished && !ranked[i + 1].finished }
    for (i, p) in PACK.enumerated() where racing(i) {
        ranked[i].pace = 1 - (1 - p.slowest) * clamp((gap(i) - p.free) / (p.full - p.free), 0, 1)
    }
    for i in [0, 1] where racing(i) { ranked[i + 1].pace *= 1 + (TOW - 1) * clamp((gap(i) - TOW_FROM) / (TOW_FULL - TOW_FROM), 0, 1) }
}
