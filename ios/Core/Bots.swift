import Foundation

// shared/src/bots.ts: how a Bot drives.

/// Whom the Bots go for, with Rams, Shots, Missiles and Mines: the Players, or anyone in a Race of Bots alone.
func isPrey(_ sim: RaceSim, _ o: Seat) -> Bool { !o.owner.isEmpty || !sim.seats.contains { !$0.owner.isEmpty } }

/// Bots stay close to the Players: faster when far behind the nearest one, slower when far ahead.
func catchUp(_ sim: RaceSim, _ bot: Seat) -> Double {
    var gap = Double.infinity
    for p in sim.seats where !p.owner.isEmpty && abs(Double(bot.progress.u - p.progress.u)) < abs(gap) { gap = Double(bot.progress.u - p.progress.u) }
    return gap == .infinity ? 1 : clamp(1 - gap / 80, 0.7, 1.3)
}

/// Follow the centreline in a per-Seat lane; low on Energy, pull into the Charging Station and stay until charged;
/// otherwise swerve for a Battery just ahead, else try to Ram the prey just ahead; and go round a Bot in the way.
func botInput(_ sim: RaceSim, _ s: Seat) -> Input {
    let track = sim.track!, rb = s.car.rb
    let t = rb.translation, v = rb.linvel
    let fx = sin(rb.yaw), fz = cos(rb.yaw), r = right(fx, fz)
    let speed = hypot(v.x, v.z)
    let look = Int((4 + speed * 0.4).rounded())
    let ahead = { (idx: Int) in (idx - s.progress.idx + track.n) % track.n }
    let bay = track.samples[(s.progress.idx + look) % track.n].bay, bayAhead = track.samples[(s.progress.idx + 2 * look) % track.n].bay

    var lane = Double(s.index % 3 - 1) * 2.4
    // seen early enough to get across from the far lane before the bay opens
    let charging = max(bay, bayAhead) > 1 && (s.energy < 35 || (inStation(track, s.progress.idx, t.x, t.z) && s.energy < 90))
    let battery = s.position == 1 ? nil : sim.batteries.filter { ahead($0.idx) > 4 && ahead($0.idx) < 30 }.min { ahead($0.idx) < ahead($1.idx) }
    // only the nearest Bot behind its prey goes for it; the others keep their lanes rather than all pile into one
    let prey = !sim.botsAttack() ? nil : sim.seats.first { o in
        o !== s && isPrey(sim, o) && o.progress.u - s.progress.u > 3 && o.progress.u - s.progress.u < 14
            && !sim.seats.contains { $0 !== s && $0 !== o && $0.owner.isEmpty && $0.progress.u > s.progress.u && $0.progress.u < o.progress.u }
    }
    let lat = { (o: Seat) -> Double in let p = o.car.rb.translation; return lateralOf(track, o.progress.idx, p.x, p.z) }
    if charging { lane = HALF_WIDTH + BAY_WIDTH / 2 } else if let battery { lane = lateralOf(track, battery.idx, battery.x, battery.z) } else if let prey { lane = lat(prey) }
    // a Bot alongside or just ahead where this one is heading: round it, not into it, so Bots closing on a Player don't pile up
    if !charging, let inWay = sim.seats.first(where: { $0 !== s && !isPrey(sim, $0) && $0.progress.u - s.progress.u > -3 && $0.progress.u - s.progress.u < 12 && abs(lat($0) - lane) < 2.4 }) {
        let b = lat(inWay), side = lane >= b ? 1.0 : -1
        lane = b + (abs(b + side * 2.6) < HALF_WIDTH - 1 ? side : -side) * 2.6
    }

    let target = poseAt(track, s.progress.idx + look, clamp(lane, -HALF_WIDTH + 1, HALF_WIDTH - 1 + bay))
    let tx = target.x - t.x, tz = target.z - t.z
    let angle = atan2(tx * r.x + tz * r.z, tx * fx + tz * fz)
    let far = track.samples[(s.progress.idx + look * 2) % track.n]
    let bend = acos(clamp(far.dx * fx + far.dz * fz, -1, 1))
    // right behind a slower Bot still: lift rather than shunt it
    let tailing = sim.seats.contains { $0 !== s && !isPrey(sim, $0) && $0.progress.u - s.progress.u > 0 && $0.progress.u - s.progress.u < 5 && abs(lat($0) - lat(s)) < 2 && hypot($0.vx, $0.vz) < speed }
    return Input(throttle: bend > 0.9 && speed > 13 ? -0.4 : tailing ? 0 : 1, steer: clamp(angle * 2.2, -1, 1))
}
