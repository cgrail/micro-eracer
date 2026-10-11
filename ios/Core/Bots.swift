import Foundation

// shared/src/bots.ts: how a Bot drives.

/// Follow the centreline in a per-Seat lane; low on Energy, pull into the Charging Station and stay until charged;
/// otherwise swerve for a Battery just ahead, else try to Ram the Racer just ahead.
func botInput(_ sim: RaceSim, _ s: Seat) -> Input {
    let track = sim.track!, rb = s.car.rb
    let t = rb.translation, v = rb.linvel
    let fx = sin(rb.yaw), fz = cos(rb.yaw), r = right(fx, fz)
    let speed = hypot(v.x, v.z)
    let look = Int((4 + speed * 0.4).rounded())
    let ahead = { (idx: Int) in (idx - s.progress.idx + track.n) % track.n }
    let bay = track.samples[(s.progress.idx + look) % track.n].bay, bayAhead = track.samples[(s.progress.idx + 2 * look) % track.n].bay

    var lane = Double(s.index % 3 - 1) * 1.6
    // seen early enough to get across from the far lane before the bay opens
    let charging = max(bay, bayAhead) > 1 && (s.energy < 35 || (inStation(track, s.progress.idx, t.x, t.z) && s.energy < 90))
    let battery = sim.batteries.filter { ahead($0.idx) > 4 && ahead($0.idx) < 30 }.min { ahead($0.idx) < ahead($1.idx) }
    let near = !sim.botsAttack() ? [] : sim.seats.filter { $0 !== s && $0.progress.u - s.progress.u > 3 && $0.progress.u - s.progress.u < 14 }
    // Players first
    let prey = near.first { !$0.owner.isEmpty } ?? near.first
    if charging { lane = HALF_WIDTH + BAY_WIDTH / 2 } else if let battery { lane = lateralOf(track, battery.idx, battery.x, battery.z) } else if let prey {
        let p = prey.car.rb.translation
        lane = lateralOf(track, prey.progress.idx, p.x, p.z)
    }

    let target = poseAt(track, s.progress.idx + look, clamp(lane, -HALF_WIDTH + 1, HALF_WIDTH - 1 + bay))
    let tx = target.x - t.x, tz = target.z - t.z
    let angle = atan2(tx * r.x + tz * r.z, tx * fx + tz * fz)
    let far = track.samples[(s.progress.idx + look * 2) % track.n]
    let bend = acos(clamp(far.dx * fx + far.dz * fz, -1, 1))
    return Input(throttle: bend > 0.9 && speed > 13 ? -0.4 : 1, steer: clamp(angle * 2.2, -1, 1))
}
