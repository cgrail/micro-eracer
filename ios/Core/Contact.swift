import Foundation

// shared/src/contact.ts: contacts between E-Cars, Rams and one ending up on another's roof.

let RAM_MIN_SPEED = 3.0
private let RAM_ENERGY_PER_MS = 3.0, RAM_MAX = 25.0, RAM_COOLDOWN = 1.0
/// How bouncy a Ram is, how much it swings an E-Car hit off-centre (rad/s per m/s), and how long the victim skids.
private let RAM_BOUNCE = 0.3, RAM_SWING = 0.12, RAM_SKID = 0.6
/// Resting on another E-Car this long (not just flying over it), an E-Car is put down beside it.
private let STACKED_FOR = 0.5

/// How much of a Ram's shove, swing and skid the victim takes: all of it from an E-Car as heavy or heavier, and from a lighter
/// one only the square of their weights' ratio, so a Roadster barely moves a Semi (9%) and a Microbus (21%).
func give(_ rammer: BodyKind, _ victim: BodyKind) -> Double { pow(min(1, rammer.spec.mass / victim.spec.mass), 2) }

/// What a Ram does, as a collision of the two weights: the speed along the contact the victim gets (`kick`) and the rammer
/// keeps (`keep`), and the victim's swing. `n` points from rammer to victim, `closing` along it.
func ramResponse(_ rammer: Car, _ victim: Car, _ n: (x: Double, z: Double), _ closing: Double) -> (kick: Double, keep: Double, spin: Double) {
    let mr = rammer.kind.spec.mass, mv = victim.kind.spec.mass, g = give(rammer.kind, victim.kind)
    let fx = sin(victim.rb.yaw), fz = cos(victim.rb.yaw), r = right(fx, fz)
    // hit at the nose or tail rather than the middle, the victim swings round
    let along = (rammer.rb.x - victim.rb.x) * fx + (rammer.rb.z - victim.rb.z) * fz, side = n.x * r.x + n.z * r.z
    let sign = along > 0 ? 1.0 : along < 0 ? -1 : 0
    return (g * closing * (1 + RAM_BOUNCE) * mr / (mr + mv), closing * (mr - RAM_BOUNCE * mv) / (mr + mv), -g * sign * side * closing * RAM_SWING)
}

/// The victim's side of a Ram: shoved (`ix`, `iz`), skidding for as much of RAM_SKID as it `give`s, maybe swinging round. Each
/// side applies it to its own E-Cars.
func shove(_ car: Car, _ ix: Double, _ iz: Double, _ spin: Double, _ give: Double) {
    let v = car.rb.linvel
    car.rb.linvel = Vec3(x: v.x + ix, y: v.y, z: v.z + iz)
    car.slide = max(car.slide, RAM_SKID * give)
    if abs(spin) > abs(car.spin) { car.spin = spin }
}

/// A Ram moves Energy from the hit E-Car to the one that drove into the contact harder (speed times weight), and shoves the victim away.
func judgeRams(_ sim: RaceSim) {
    let n = sim.seats.count
    for i in 0..<n { for j in (i + 1)..<max(i + 1, n) {
        let a = sim.seats[i], b = sim.seats[j], key = i * n + j
        if sim.isRecharging(a) || sim.isRecharging(b) || sim.time < sim.ramCooldown[key, default: 0] { continue }
        if !sim.world.touching(a.car.rb, b.car.rb) { continue }
        let pa = a.car.rb.translation, pb = b.car.rb.translation
        let d = hypot(pb.x - pa.x, pb.z - pa.z) == 0 ? 1 : hypot(pb.x - pa.x, pb.z - pa.z), nx = (pb.x - pa.x) / d, nz = (pb.z - pa.z) / d
        let sa = a.vx * nx + a.vz * nz, sb = -(b.vx * nx + b.vz * nz)
        if sa + sb < RAM_MIN_SPEED { continue }
        let (rammer, victim) = sa * a.kind.spec.mass >= sb * b.kind.spec.mass ? (a, b) : (b, a)
        sim.ramCooldown[key] = sim.time + RAM_COOLDOWN
        if victim.shield { victim.shield = false; sim.emit(.block(s: victim.index)); continue }
        let amount = min(RAM_MAX, 5 + (sa + sb - RAM_MIN_SPEED) * RAM_ENERGY_PER_MS, victim.energy)
        victim.energy -= amount
        rammer.energy = min(MAX_ENERGY, rammer.energy + amount)
        let away = rammer === a ? 1.0 : -1, dir = (x: nx * away, z: nz * away)
        let response = ramResponse(rammer.car, victim.car, dir, sa + sb), ix = dir.x * response.kick, iz = dir.z * response.kick
        // between two Bots the physics has shared the momentum already; a Player's E-Car barely pushes, so a Bot it rams gets the shove from us
        if victim.owner.isEmpty { shove(victim.car, rammer.owner.isEmpty ? 0 : ix, rammer.owner.isEmpty ? 0 : iz, response.spin, give(rammer.car.kind, victim.car.kind)) }
        sim.stats.rams += 1
        // a Player's own device drives their E-Car, so it applies the shove when it gets this, as for a Hit
        sim.emit(.ram(a: rammer.index, b: victim.index, n: Int(amount.rounded()), ix: ix, iz: iz, spin: response.spin))
    } }
}

/// An E-Car on another's roof is put down next to it where there's room; a Player's device follows the `spawn` jump.
func unstack(_ sim: RaceSim, _ dt: Double) {
    for s in sim.seats {
        let t = s.car.rb.translation
        // above another's middle by more than half a car's height, but not on a bridge over it
        let onTop = sim.seats.contains { o in
            let p = o.car.rb.translation, dy = t.y - p.y
            return o !== s && dy > 0.5 && dy < 2.5 && sq(t.x - p.x) + sq(t.z - p.z) < 9
        }
        s.stackedFor = onTop ? s.stackedFor + dt : 0
        if s.stackedFor < STACKED_FOR { continue }
        s.stackedFor = 0
        let others = sim.seats.filter { $0 !== s }.map { $0.car.rb.translation }
        guard let spot = freeSpot(sim.track, [s.progress.idx, s.progress.idx + 5, s.progress.idx - 5], others) else { continue }
        teleport(s.car, spot.pose, s.vx, s.vz)
        // a jump, not driving, so it costs no Energy
        s.lastX = spot.pose.x
        s.lastZ = spot.pose.z
        if !s.owner.isEmpty { s.spawn += 1 }
    }
}
