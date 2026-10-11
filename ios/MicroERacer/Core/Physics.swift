import Foundation

// shared/src/physics.ts: boxes that only turn about the vertical axis, on the Track's road and between its walls.
// `PhysicsFixtureTests` replays shared/src/physics.fixture.json, so this has to step exactly like the TypeScript.

struct Vec3 { var x, y, z: Double }
let DT = 1.0 / 60
private let GRAVITY = -20.0
/// Passes of the solver over all contacts per step.
private let ITERATIONS = 4
/// How bouncy E-Cars are against each other and the walls (not the road), when they meet faster than BOUNCE_FROM m/s.
private let BOUNCE = 0.3, BOUNCE_FROM = 1.0
/// Bodies closer than this are touching.
private let TOUCH = 0.01

func wrapAngle(_ a: Double) -> Double { a > .pi ? a - 2 * .pi : a < -.pi ? a + 2 * .pi : a }
func angleDiff(_ a: Double, _ b: Double) -> Double { atan2(sin(b - a), cos(b - a)) }

/// A box `half` in size that only turns about the vertical axis. A dynamic body is moved by the world; a kinematic one goes
/// where `moveTo` says and pushes without being pushed.
final class RigidBody: Box {
    var x, y, z, yaw: Double
    var vx = 0.0, vy = 0.0, vz = 0.0
    /// Turning speed about the vertical axis in rad/s (positive turns left).
    var yawRate = 0.0
    let half: Vec3
    let dynamic: Bool
    let invMass: Double
    let invInertia: Double
    /// The sample this body is over, so the road under it is found by a short search; -1 when not known.
    var idx = -1
    /// Kinematic: where to be after the next step.
    var next: Pose?

    init(half: Vec3, mass: Double, dynamic: Bool, pose: Pose) {
        self.half = half; self.dynamic = dynamic
        x = pose.x; y = pose.y; z = pose.z; yaw = wrapAngle(pose.yaw)
        invMass = dynamic ? 1 / mass : 0
        invInertia = dynamic ? 3 / (mass * (half.x * half.x + half.z * half.z)) : 0
    }

    var translation: Vec3 { Vec3(x: x, y: y, z: z) }
    var linvel: Vec3 {
        get { Vec3(x: vx, y: vy, z: vz) }
        set { vx = newValue.x; vy = newValue.y; vz = newValue.z }
    }
    /// Puts the body at `pose` at once, without touching anything in between.
    func setPose(_ pose: Pose) { x = pose.x; y = pose.y; z = pose.z; yaw = wrapAngle(pose.yaw); next = nil; idx = -1 }
    /// Kinematic: moves to `pose` over the next step, at the speed that takes.
    func moveTo(_ pose: Pose) { next = pose }
}

/// One contact for the solver; `a` is nil for the road and the walls. `ka`, `kb`: how much turning moves it along n.
private struct Contact {
    let a: RigidBody?, b: RigidBody
    let nx, ny, nz, ka, kb, sep, mass: Double
    var target = 0.0, impulse = 0.0
}

/// Speed at which the contact's two sides are coming apart along its normal (negative: closing).
private func closing(_ c: Contact) -> Double {
    let b = c.b, vb = b.vx * c.nx + b.vy * c.ny + b.vz * c.nz + b.yawRate * c.kb
    guard let a = c.a else { return vb }
    return vb - (a.vx * c.nx + a.vy * c.ny + a.vz * c.nz + a.yawRate * c.ka)
}

private func applyImpulse(_ c: Contact, _ j: Double) {
    let b = c.b
    b.vx += j * c.nx * b.invMass; b.vy += j * c.ny * b.invMass; b.vz += j * c.nz * b.invMass; b.yawRate += j * c.kb * b.invInertia
    if let a = c.a { a.vx -= j * c.nx * a.invMass; a.vy -= j * c.ny * a.invMass; a.vz -= j * c.nz * a.invMass; a.yawRate -= j * c.ka * a.invInertia }
}

private func contact(_ a: RigidBody?, _ b: RigidBody, _ m: Meeting, bouncy: Bool) -> Contact {
    // a contact point off a body's middle turns it: the lever arm across the normal
    let ka = a.map { (m.pz - $0.z) * m.nx - (m.px - $0.x) * m.nz } ?? 0, kb = (m.pz - b.z) * m.nx - (m.px - b.x) * m.nz
    let inv = (a.map { $0.invMass + $0.invInertia * ka * ka } ?? 0) + b.invMass + b.invInertia * kb * kb
    var c = Contact(a: a, b: b, nx: m.nx, ny: m.ny, nz: m.nz, ka: ka, kb: kb, sep: m.sep, mass: inv > 0 ? 1 / inv : 0)
    // closing the gap and no more; meeting this step at speed, they bounce off each other instead
    let v = closing(c), gap = max(0, m.sep) / DT
    c.target = bouncy && v < -BOUNCE_FROM && v < -gap ? -BOUNCE * v : -gap
    return c
}

/// The Track's road and walls, and the E-Cars on them.
final class World {
    let track: Track
    private(set) var bodies: [RigidBody] = []
    private let walls: [[Wall]]
    /// Pairs of bodies in contact during the last step.
    private var touches: [(RigidBody, RigidBody)] = []

    init(_ track: Track) {
        self.track = track
        walls = wallFaces(track)
    }

    @discardableResult func add(_ body: RigidBody) -> RigidBody { bodies.append(body); return body }
    func remove(_ body: RigidBody) { bodies.removeAll { $0 === body } }

    /// Whether `a` and `b` touched in the last step.
    func touching(_ a: RigidBody, _ b: RigidBody) -> Bool { touches.contains { ($0.0 === a && $0.1 === b) || ($0.0 === b && $0.1 === a) } }

    /// Whether the road is under the body's middle, at most `reach` below it (another E-Car's roof doesn't count).
    func onRoad(_ body: RigidBody, _ reach: Double) -> Bool {
        locate(body)
        guard let road = roadAt(track, body.idx, body.x, body.z) else { return false }
        return body.y - road.y > -0.1 && body.y - road.y < reach
    }

    func step() {
        let dynamic = bodies.filter { $0.dynamic }
        var contacts: [Contact] = []
        for b in bodies {
            if b.dynamic { b.vy += GRAVITY * DT; locate(b) } else if let next = b.next {
                b.vx = (next.x - b.x) / DT; b.vy = (next.y - b.y) / DT; b.vz = (next.z - b.z) / DT
                b.yawRate = angleDiff(b.yaw, next.yaw) / DT
            } else { b.vx = 0; b.vy = 0; b.vz = 0; b.yawRate = 0 }
        }
        for b in dynamic {
            if let road = roadUnder(track, b) {
                // the road pushes along its normal, so on a ramp it lifts an E-Car, and gravity pulls it back down the slope
                let g = hypot(1, road.grade), sep = (b.y - b.half.y - road.y) / g
                if sep < max(0, -b.vy) * DT + 0.05 {
                    contacts.append(contact(nil, b, Meeting(sep: sep, nx: -road.grade * road.dx / g, ny: 1 / g, nz: -road.grade * road.dz / g, px: b.x, pz: b.z), bouncy: false))
                }
            }
            let margin = 0.1 + (hypot(b.vx, b.vz) + abs(b.yawRate) * hypot(b.half.x, b.half.z)) * DT
            for w in wallsNear(b) {
                if let m = wallMeet(w, b), m.sep < margin { contacts.append(contact(nil, b, m, bouncy: true)) }
            }
        }
        for i in 0..<bodies.count { for j in (i + 1)..<max(i + 1, bodies.count) { pair(&contacts, bodies[i], bodies[j]) } }

        for _ in 0..<ITERATIONS { for k in contacts.indices {
            let c = contacts[k], total = max(0, c.impulse + (c.target - closing(c)) * c.mass)
            applyImpulse(c, total - c.impulse)
            contacts[k].impulse = total
        } }
        touches = contacts.compactMap { c in c.a.flatMap { a in c.impulse > 0 || c.sep <= TOUCH ? (a, c.b) : nil } }

        for b in bodies {
            if b.dynamic { b.x += b.vx * DT; b.y += b.vy * DT; b.z += b.vz * DT; b.yaw = wrapAngle(b.yaw + b.yawRate * DT) } else if let next = b.next {
                b.x = next.x; b.y = next.y; b.z = next.z; b.yaw = wrapAngle(next.yaw); b.next = nil
            }
        }
        // whatever still overlaps is pushed apart, the lighter body further; then out of the walls and back onto the road
        for c in contacts {
            guard let a = c.a else { continue }
            let b = c.b, share = a.invMass + b.invMass
            if share == 0 { continue }
            let m = meet(a, b)
            if m.sep >= 0 { continue }
            let da = m.sep * a.invMass / share, db = -m.sep * b.invMass / share
            a.x += m.nx * da; a.y += m.ny * da; a.z += m.nz * da
            b.x += m.nx * db; b.y += m.ny * db; b.z += m.nz * db
        }
        for b in dynamic {
            for w in wallsNear(b) {
                if let m = wallMeet(w, b), m.sep < 0 { b.x -= m.nx * m.sep; b.z -= m.nz * m.sep }
            }
            // out of the road along its normal: on a slope it pushes back as well as up
            if let road = roadUnder(track, b) {
                let sunk = road.y - (b.y - b.half.y)
                if sunk > 0 {
                    let k = sunk / (1 + road.grade * road.grade)
                    b.x -= k * road.grade * road.dx; b.y += k; b.z -= k * road.grade * road.dz
                }
            }
        }
    }

    private func wallsNear(_ b: RigidBody) -> [Wall] {
        (-5...5).flatMap { walls[(b.idx + $0 + track.n) % track.n] }
    }

    /// Keeps `idx` on the sample under the body: a short search as it drives, the whole Track after a jump.
    private func locate(_ b: RigidBody) {
        if b.idx < 0 || b.idx >= track.n || sq(track.samples[b.idx].x - b.x) + sq(track.samples[b.idx].y - b.y) + sq(track.samples[b.idx].z - b.z) > 12 * 12 {
            b.idx = nearestSample(track, b.x, b.y, b.z)
        } else { b.idx = nearestBy(track, b.idx, b.x, b.z, 10) }
    }

    private func pair(_ contacts: inout [Contact], _ a: RigidBody, _ b: RigidBody) {
        // how far they could close in on each other this step, turning included
        let ra = hypot(a.half.x, a.half.z), rb = hypot(b.half.x, b.half.z)
        let dv = (b.vx - a.vx) * (b.vx - a.vx) + (b.vy - a.vy) * (b.vy - a.vy) + (b.vz - a.vz) * (b.vz - a.vz)
        let margin = 0.1 + (dv.squareRoot() + abs(a.yawRate) * ra + abs(b.yawRate) * rb) * DT
        if sq(b.x - a.x) + sq(b.z - a.z) > sq(ra + rb + margin) || abs(b.y - a.y) > a.half.y + b.half.y + margin { return }
        let m = meet(a, b)
        if m.sep < margin { contacts.append(contact(a, b, m, bouncy: true)) }
    }
}
