import SceneKit

// client/src/motion.ts: how E-Cars move on screen.

/// How the game shows one E-Car: its model, its physics body here, and where it is drawn.
final class CarView {
    let model: CarModel, drone: SCNNode, rotors: [SCNNode]
    var tag: SCNNode
    var name: String
    let kind: BodyKind, mine: Bool, car: Car
    /// Where the server last said it was, and when that arrived.
    var target: (x: Double, y: Double, z: Double, yaw: Double, vx: Double, vz: Double, at: Double)
    var shown: Pose
    var energy: Int, mode: Int, prevMode: Int, modeSince: Double
    var lastY: Double
    /// Height of the road under the E-Car.
    var roadY = 0.0
    /// The model's eased slope along a ramp, and how it is turned.
    var tilt = 0.0, yaw = 0.0
    /// When we last shoved it ourselves (`ourRams`), so the server's word on that Ram isn't applied twice.
    var kickedAt = -9.0
    var wet = false

    init(model: CarModel, drone: (node: SCNNode, rotors: [SCNNode]), tag: SCNNode, c: CarState, mine: Bool, car: Car, now: Double) {
        self.model = model; self.drone = drone.node; rotors = drone.rotors; self.tag = tag; name = c.name; kind = c.body; self.mine = mine; self.car = car
        target = (c.x, c.y, c.z, c.yaw, c.vx, c.vz, now)
        shown = Pose(x: c.x, y: c.y, z: c.z, yaw: c.yaw)
        energy = c.energy; mode = c.mode; prevMode = c.mode; modeSince = now; lastY = c.y
    }
}

private func smooth(_ k: Double) -> Double { k * k * (3 - 2 * k) }

/// The other E-Cars glide on at their reported speed every frame and are only nudged towards where the server says they
/// are, so a late or early update shows as a little drift rather than a jump. Far off (a reset, a new Race) they snap.
func glide(_ views: [CarView], _ dt: Double, _ now: Double) {
    let pull = 1 - exp(-dt * 5), quick = 1 - exp(-dt * 12)
    for v in views where !v.mine {
        let age = min(now - v.target.at, 0.3)
        let x = v.target.x + v.target.vx * age, z = v.target.z + v.target.vz * age
        if hypot(x - v.shown.x, z - v.shown.z) > 6 { v.shown = Pose(x: x, y: v.target.y, z: z, yaw: v.target.yaw); continue }
        v.shown.x += v.target.vx * dt + (x - v.shown.x) * pull
        v.shown.z += v.target.vz * dt + (z - v.shown.z) * pull
        v.shown.y += (v.target.y - v.shown.y) * quick
        v.shown.yaw += angleDiff(v.shown.yaw, v.target.yaw) * quick
    }
}

/// Puts the model where the E-Car is drawn, tilted along a ramp and set down with no part of its underside in the road
/// (motion.ts `place`). `i` is the sample the E-Car is on.
func place(_ v: CarView, _ track: Track, _ i: Int, _ at: Vec3, _ yaw: Double, _ dt: Double) {
    var p = at
    v.roadY = track.samples[i].y
    let fx = sin(yaw), fz = cos(yaw), length = v.kind.spec.length
    let roads = { (x: Double, z: Double) -> [(a: Double, y: Double)] in
        [-1, -0.5, 0, 0.5, 1].compactMap { k in
            let a = k * length
            return roadAt(track, i, x + fx * a, z + fz * a).map { (a, $0.y) }
        }
    }
    let under = roads(p.x, p.z)
    let top = under.map(\.y).max() ?? -.infinity
    // the others' height eases in late, which would sink them into a ramp while climbing it: while the server has one on
    // the road, it rides the road here
    if !v.mine && !under.isEmpty && v.target.y - HALF.y - (roads(v.target.x, v.target.z).map(\.y).max() ?? -.infinity) < 0.3 { p.y = top + HALF.y }
    let slope = under.count > 1 && p.y - HALF.y - top < 0.3 ? (under.last!.y - under.first!.y) / (under.last!.a - under.first!.a) : 0
    v.tilt += (clamp(slope, -0.4, 0.4) - v.tilt) * (1 - exp(-dt * 12))
    let drop = under.isEmpty ? 0 : under.map { $0.y - v.tilt * $0.a }.max()! - top
    v.model.node.position = SCNVector3(p.x, p.y + drop, p.z)
    v.yaw = yaw
    setYawPitch(v.model.node, yaw: yaw, pitch: -atan(v.tilt))
}

/// Our own Rams. Here the other E-Cars can't be pushed (they go where the server says), so when we drive into one, we shove
/// it at once and keep the way the collision leaves us, as the server works out too. `before` is our velocity going into
/// this physics step.
func ourRams(_ world: World, _ own: CarView, _ views: [CarView], _ before: Vec3, _ now: Double) {
    let rb = own.car.rb
    for v in views where !v.mine && now - v.kickedAt >= 0.5 && world.touching(rb, v.car.rb) {
        let o = v.car.rb, d = hypot(o.x - rb.x, o.z - rb.z) == 0 ? 1 : hypot(o.x - rb.x, o.z - rb.z), n = (x: (o.x - rb.x) / d, z: (o.z - rb.z) / d)
        let ours = before.x * n.x + before.z * n.z, theirs = -(v.target.vx * n.x + v.target.vz * n.z)
        // only when we drove into them; when they drive into us, the server's Ram shoves us
        if ours + theirs < RAM_MIN_SPEED || ours * own.kind.spec.mass < theirs * v.kind.spec.mass { continue }
        let r = ramResponse(own.car, v.car, n, ours + theirs)
        v.target.vx += n.x * r.kick
        v.target.vz += n.z * r.kick
        v.kickedAt = now
        let after = rb.linvel, along = after.x * n.x + after.z * n.z, want = -theirs + r.keep
        rb.linvel = Vec3(x: after.x + n.x * (want - along), y: after.y, z: after.z + n.z * (want - along))
    }
}

/// Out of Energy: Stranded and jerking on the spot while a drone flies in, then the drone hovers over the E-Car sending charge
/// down into it (the Recharge), and flies off once it's full. Returns whether the drone is out.
func dronePose(_ v: CarView, _ time: Double, _ now: Double, soot: Particles, sparks: Particles) -> Bool {
    let since = now - v.modeSince, node = v.model.node
    var droneY = -1.0, jerk = 0.0
    if v.mode == STRANDED {
        jerk = max(0, 1 - since / (STRANDED_TIME - 0.4))
        if since > 0.6 { droneY = 14 - smooth(min(1, (since - 0.6) / 0.6)) * 11.4 }
    } else if v.mode == RECHARGE {
        droneY = 2.6 + sin(time * 5) * 0.15
        let p = node.position
        if Double.random(in: 0..<1) < 0.6 { sparks.emit(Double(p.x) + .random(in: -0.3..<0.3), Double(p.y) + 2.2, Double(p.z) + .random(in: -0.3..<0.3), 0, -6, 0, 0.3, 0.35) }
    } else if v.prevMode == RECHARGE && since < 0.6 { droneY = 2.6 + since * since * 40 }
    node.position.y += Float(abs(sin(time * 23)) * 0.15 * jerk)
    if jerk > 0 { setYawPitch(node, yaw: v.yaw, pitch: -atan(v.tilt) + sin(time * 19) * 0.06 * jerk, roll: sin(time * 31) * 0.1 * jerk) }
    let p = node.position
    if jerk > 0 && Double.random(in: 0..<1) < 0.3 { soot.emit(Double(p.x), Double(p.y) + 0.3, Double(p.z), .random(in: -0.5..<0.5), 1.5, .random(in: -0.5..<0.5), 0.8, 0.9) }
    v.drone.isHidden = droneY < 0
    if !v.drone.isHidden {
        v.drone.position = SCNVector3(Double(p.x), Double(p.y) + droneY, Double(p.z))
        v.drone.eulerAngles.y = Float(v.yaw)
        for rotor in v.rotors { rotor.eulerAngles.y += 0.9 }
    }
    return !v.drone.isHidden
}
