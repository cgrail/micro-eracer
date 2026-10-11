import Foundation

// shared/src/combat.ts: Item Boxes and the Items (Zaps and their Shots, Missiles, Mines, Shields) of one Race.

enum ItemKind: String { case zap, missile, mine, shield }
/// What an Item Box hands out; the Zap, the everyday weapon, twice as often as the others.
let ITEMS: [ItemKind] = [.zap, .zap, .missile, .mine, .shield]
/// Shots in a Zap.
let ZAP_SHOTS = 5
/// Item Boxes only give to Racers from this Position back: goodies are for those behind.
let GOODIES_FROM = 4
enum HitKind: String { case shot, missile, mine }

struct Bolt { let id: Int; let kind: HitKind; let owner: Int; var x, y, z, vx, vz: Double; let until: Double; let target: Int }
struct Mine { let id: Int; let owner: Int; let x, y, z, armedAt, until: Double }

private let SHOT_EVERY = 1.0 / 3, SHOT_SPEED = 45.0, SHOT_LIFE = 1.1
private let MISSILE_SPEED = 30.0, MISSILE_TURN = 3.5, MISSILE_LIFE = 4.0
private let MINE_LIFE = 40.0, MINE_ARM = 0.8, HIT_RADIUS = 1.8, BOX_RADIUS = 2.2, BOX_RESPAWN = 4.0
/// What a Hit does: Energy drained, spin-out (rad/s), sideways shove and hop (m/s).
let HITS: [HitKind: (drain: Double, spin: Double, shove: Double, hop: Double)] = [
    .shot: (5, 1.5, 3, 0),
    .missile: (20, 7, 3, 4),
    .mine: (15, 6, 2, 5),
]

final class Combat {
    var bolts: [Bolt] = []
    var mines: [Mine] = []
    /// Per Item Box: the time it is back after being taken (0 = there).
    private var boxes: [Double]
    /// Per Item Box: out on the Track. A box comes out once third place has passed it and goes once the last Racer has.
    private(set) var out: [Bool]
    /// When the Bots may next fire at a Player in the lead; shared, so the Leader is shot about once a second.
    private var leaderShotAt = 0.0
    private var id = 0
    private unowned let sim: RaceSim

    init(_ sim: RaceSim) {
        self.sim = sim
        boxes = sim.track.itemBoxes.map { _ in 0 }
        out = boxes.map { _ in false }
    }

    private func pose(_ s: Seat) -> (x: Double, y: Double, z: Double, fx: Double, fz: Double) {
        let rb = s.car.rb
        return (rb.x, rb.y, rb.z, sin(rb.yaw), cos(rb.yaw))
    }

    /// Uses the Item. A Zap fires one of its Shots, at most three a second (Bots may aim it `at` someone).
    func useItem(_ s: Seat, at: Seat? = nil) {
        guard let item = s.item, sim.canAct(s) else { return }
        var (x, y, z, fx, fz) = pose(s)
        switch item {
        case .zap:
            if sim.time < s.nextShotAt { return }
            s.nextShotAt = sim.time + SHOT_EVERY
            if let at {
                // aim where the target will be when the Shot gets there
                let t = at.car.rb.translation, lead = hypot(t.x - x, t.z - z) / SHOT_SPEED
                let ax = t.x + at.vx * lead - x, az = t.z + at.vz * lead - z, d = hypot(ax, az) == 0 ? 1 : hypot(ax, az)
                fx = ax / d; fz = az / d
            }
            id += 1
            bolts.append(Bolt(id: id, kind: .shot, owner: s.index, x: x + fx * 2.4, y: y, z: z + fz * 2.4, vx: fx * SHOT_SPEED + s.vx, vz: fz * SHOT_SPEED + s.vz,
                              until: sim.time + SHOT_LIFE, target: -1))
            sim.emit(.shot(s: s.index))
            s.ammo -= 1
            if s.ammo <= 0 { s.item = nil }
            return
        case .missile:
            // homes in on the Racer one Position ahead
            let target = sim.seats.first { $0.position == s.position - 1 }
            id += 1
            bolts.append(Bolt(id: id, kind: .missile, owner: s.index, x: x + fx * 2.6, y: y, z: z + fz * 2.6, vx: fx * MISSILE_SPEED, vz: fz * MISSILE_SPEED,
                              until: sim.time + MISSILE_LIFE, target: target?.index ?? -1))
        case .mine:
            id += 1
            mines.append(Mine(id: id, owner: s.index, x: x - fx * 3, y: y - 0.45, z: z - fz * 3, armedAt: sim.time + MINE_ARM, until: sim.time + MINE_LIFE))
        case .shield:
            s.shield = true
        }
        sim.emit(.item(s: s.index, item: item))
        s.item = nil
    }

    func step(_ dt: Double) {
        let near = { (s: Seat, x: Double, y: Double, z: Double, r: Double) -> Bool in
            let t = s.car.rb.translation
            return sq(t.x - x) + sq(t.z - z) < r * r && sameLevel(t.y, y)
        }

        // how far third place and the last Racer have come, and how often each has passed a sample
        let u = sim.seats.map { $0.progress.u }.sorted(by: >), third = u[GOODIES_FROM - 2], last = u[u.count - 1]
        let passes = { (at: Int, idx: Int) in Int(floor(Double(at - idx) / Double(self.sim.track.n))) }
        for (i, box) in sim.track.itemBoxes.enumerated() {
            out[i] = boxes[i] <= sim.time && passes(third, box.idx) > passes(last, box.idx)
            if !out[i] { continue }
            // holding an Item already, or in the top three, driving through a box does nothing
            guard let s = sim.seats.first(where: { $0.item == nil && $0.position >= GOODIES_FROM && sim.canAct($0) && near($0, box.x, box.y, box.z, BOX_RADIUS) }) else { continue }
            let item = ITEMS.randomElement()!
            s.item = item
            if item == .zap { s.ammo = ZAP_SHOTS }
            boxes[i] = sim.time + BOX_RESPAWN
            out[i] = false
            sim.emit(.box(s: s.index, item: item))
        }

        var flying: [Bolt] = []
        for var b in bolts {
            if b.kind == .missile && b.target >= 0 {
                let t = sim.seats[b.target].car.rb.translation
                let want = atan2(t.x - b.x, t.z - b.z), have = atan2(b.vx, b.vz)
                let turn = max(-MISSILE_TURN * dt, min(MISSILE_TURN * dt, angleDiff(have, want)))
                b.vx = sin(have + turn) * MISSILE_SPEED
                b.vz = cos(have + turn) * MISSILE_SPEED
            }
            b.x += b.vx * dt
            b.z += b.vz * dt
            if let victim = sim.seats.first(where: { $0.index != b.owner && !sim.isRecharging($0) && near($0, b.x, b.y, b.z, HIT_RADIUS) }) {
                let speed = hypot(b.vx, b.vz)
                hit(victim, b.kind, b.vx / speed, b.vz / speed, b.owner)
                continue
            }
            if b.until > sim.time { flying.append(b) }
        }
        bolts = flying

        mines = mines.filter { m in
            if m.until < sim.time { return false }
            if m.armedAt > sim.time { return true }
            guard let victim = sim.seats.first(where: { !sim.isRecharging($0) && near($0, m.x, m.y, m.z, HIT_RADIUS) }) else { return true }
            let v = hypot(victim.vx, victim.vz) == 0 ? 1 : hypot(victim.vx, victim.vz)
            hit(victim, .mine, victim.vx / v, victim.vz / v, m.owner)
            return false
        }
    }

    /// A Shield blocks the Hit; otherwise it drains Energy and throws the E-Car around.
    func hit(_ victim: Seat, _ kind: HitKind, _ dx: Double, _ dz: Double, _ by: Int) {
        let at = victim.car.rb.translation
        if kind != .shot { sim.emit(.boom(x: at.x, z: at.z)) }
        if victim.shield { victim.shield = false; sim.emit(.block(s: victim.index)); return }
        let h = HITS[kind]!
        victim.energy = max(0, victim.energy - h.drain)
        // heavier Bodies get thrown around less
        let mass = victim.kind.spec.mass, spin = (Bool.random() ? -1 : 1) * h.spin / mass
        let ix = dx * h.shove / mass, iz = dz * h.shove / mass, hop = h.hop / mass
        if victim.owner.isEmpty {
            let v = victim.car.rb.linvel
            victim.car.rb.linvel = Vec3(x: v.x + ix, y: v.y + hop, z: v.z + iz)
            victim.car.spin = spin
        }
        // a Player's own device drives their E-Car, so it applies the same shove when it gets this
        sim.emit(.hit(s: victim.index, by: by, kind: kind, ix: ix, iz: iz, hop: hop, spin: spin))
        sim.stats.hits += 1
    }

    /// Bots use Items right away when they make sense and fire a Zap at whoever is lined up ahead. A Player in the lead is
    /// everyone's target: Bots with a Zap up to 45 m behind aim at them in a 45° cone and, all together, fire about once a second.
    func botTurn(_ s: Seat) {
        if s.item == .shield || (s.item == .missile && s.position > 1) { useItem(s) }
        if s.item == .mine && sim.seats.contains(where: { $0 !== s && s.progress.u - $0.progress.u > 2 && s.progress.u - $0.progress.u < 20 }) { useItem(s) }
        if s.item != .zap || !sim.botsAttack() || sim.time < s.nextShotAt { return }
        let p = pose(s), r = right(p.fx, p.fz)
        // within `range` ahead and at most `slack` metres plus `cone` per metre ahead to the side
        let ahead = { (o: Seat, range: Double, slack: Double, cone: Double) -> Bool in
            let t = o.car.rb.translation, ax = t.x - p.x, az = t.z - p.z
            let along = ax * p.fx + az * p.fz, side = ax * r.x + az * r.z
            return o !== s && along > 3 && along < range && abs(side) < slack + cone * along
        }
        if let leader = sim.seats.first(where: { !$0.owner.isEmpty && $0.position == 1 && !$0.finished }),
           sim.time >= leaderShotAt && ahead(leader, 45, 0, 1) && sameLevel(leader.car.rb.y, p.y) {
            useItem(s, at: leader)
            leaderShotAt = sim.time + 0.8 + Double.random(in: 0..<0.5)
            s.nextShotAt = sim.time + 1
            return
        }
        let target = sim.seats.first { ahead($0, 25, 1.2, 0) }
        // Bots save their Shots mostly for the Players, so the action happens around them
        guard let target, !target.owner.isEmpty || Double.random(in: 0..<1) >= 0.7 else { s.nextShotAt = sim.time + 0.5; return }
        useItem(s)
        s.nextShotAt = sim.time + 1.5 + Double.random(in: 0..<2)
    }
}
