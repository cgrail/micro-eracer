import SceneKit

// client/src/game.ts: one session. Our E-Car is simulated here, every other E-Car follows the server. Everything runs on
// SceneKit's render thread (`renderer(_:updateAtTime:)`); the HUD goes to SwiftUI on the main thread when it changes.

/// Our own E-Car: its view, its Seat, how far it has come and the last jump (`spawn`) the server asked for.
final class Own {
    let view: CarView, seat: Int
    var progress: Progress, spawn = -1, lockedUntil = 0.0
    init(view: CarView, seat: Int, progress: Progress) { self.view = view; self.seat = seat; self.progress = progress }
}

final class Game: NSObject, SCNSceneRendererDelegate {
    let scene = SCNScene()
    let cameraNode = SCNNode()
    let link: RaceLink, controls: Controls, sound: Sound, feed: HudFeed
    private let publish: (HudState) -> Void, left: () -> Void
    /// Width over height of the view, set by the view as it lays out.
    var aspect = 1.0
    /// Told of every event and our own Seat, on the game's thread (the watch taps the wrist with it).
    var heard: ((RaceEvent, Int) -> Void)?
    /// No Back button (the watch): stuck for `UNSTICK_TIME`, our E-Car is put back on the road where it is instead.
    var unstick = false
    /// Told on the game's thread when our E-Car is put back on the road or on a new grid (the watch straightens its Crown).
    var putBack: (() -> Void)?

    var track: Track?, world: World?, look: TrackScene?
    var state: RaceState?, me: CarState?, own: Own?
    var views = [CarView?](repeating: nil, count: SEATS)
    var batteries: [Int: (node: SCNNode, baseY: Double)] = [:], mines: [Int: (node: SCNNode, light: SCNMaterial)] = [:]
    var bolts: [Int: (node: SCNNode, s: BoltState, at: Double)] = [:], boxes: [SCNNode] = []
    var clock = 0.0, ticks = 0, status = "", shake = 0.0, nextShot = 0.0, nextBeep = 0.0, inPit = false, stuckFor = 0.0
    let splash = Particles(0xd4f1ff, 500), smoke = Particles(0xf4f4f4, 300, gravity: 1.5, grow: 2.2), sparks = Particles(0x8dff9e, 200, gravity: -6)
    let fire = Particles(0xffa424, 300, gravity: -4, grow: 1.5), soot = Particles(0x55565c, 200, gravity: 1.5, grow: 2.5)
    private var acc = 0.0, last = -1.0, ownBefore = Vec3(x: 1e9, y: 0, z: 0), ownBeforeYaw = 0.0, lastTarget = SIMD3<Float>(0, -1e6, 0)
    private var lastHud = HudState(), gone = false
    /// Held for a whole frame, so `stop` (on the main thread) never leaves the room in the middle of one.
    private let frameLock = NSLock()
    var now = 0.0

    init(link: RaceLink, controls: Controls, sound: Sound, offline: Bool, publish: @escaping (HudState) -> Void, left: @escaping () -> Void) {
        self.link = link; self.controls = controls; self.sound = sound; self.publish = publish; self.left = left
        feed = HudFeed(sound: sound)
        feed.offline = offline
        super.init()
        let camera = SCNCamera()
        camera.fieldOfView = 55
        camera.zNear = 0.5
        camera.zFar = 600
        cameraNode.camera = camera
        scene.rootNode.addChildNode(cameraNode)
        let ambient = SCNLight()
        ambient.type = .ambient
        ambient.intensity = 560
        scene.rootNode.addChildNode(SCNNode().with { $0.light = ambient })
        let sun = SCNLight()
        sun.type = .directional
        sun.intensity = 760
        let sunNode = SCNNode()
        sunNode.light = sun
        sunNode.position = SCNVector3(40, 80, 25)
        sunNode.look(at: SCNVector3(0, 0, 0))
        scene.rootNode.addChildNode(sunNode)
        scene.fogStartDistance = 140
        scene.fogEndDistance = 320
        for p in [splash, smoke, sparks, fire, soot] { scene.rootNode.addChildNode(p.node) }
    }

    func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
        frameLock.lock()
        defer { frameLock.unlock() }
        if gone { return }
        now = time
        let dt = last < 0 ? 0 : min(0.1, time - last)
        last = time
        link.pump(dt)
        if let s = link.takeState() { onState(s) }
        for e in link.takeEvents() { onEvent(e) }
        if link.status == .left { gone = true; sound.silenceLoops(); DispatchQueue.main.async(execute: left); return }
        status = link.status == .reconnecting ? "Reconnecting…" : ""
        acc += dt
        while acc >= DT {
            if let own { ownBefore = own.view.car.rb.translation; ownBeforeYaw = own.view.car.rb.yaw }
            tick()
            acc -= DT
        }
        draw(dt, time)
        sound.schedule()
        if let state {
            let hud = feed.update(time, state, me, status, showBack: stuckFor > 0.8 && !controls.usesPad)
            if hud != lastHud { lastHud = hud; DispatchQueue.main.async { [publish] in publish(hud) } }
        }
    }

    /// One physics step of our own E-Car, 60 times a second.
    private func tick() {
        guard let world, let track, let state else { return }
        for v in views.compactMap({ $0 }) where !v.mine { setKinematicPose(v.car, v.shown) }
        if let own, let me {
            let t = own.view.car.rb.translation
            let locked = state.phase == .grid || clock < own.lockedUntil || me.mode != DRIVING
            let input = me.mode != DRIVING ? HALT : locked ? NO_INPUT : controls.drive()
            // the Charging Station has a speed limit; a chime says it's charging
            let pit = inStation(track, own.progress.idx, t.x, t.z)
            if pit && !inPit { sound.battery() }
            inPit = pit
            // the server slows a Leader who is far ahead (`pace`, in percent)
            driveCar(world, own.view.car, input, limpScale(Double(me.energy)) * (pit ? PIT_SPEED : 1) * Double(me.pace == 0 ? 100 : me.pace) / 100, inPuddle(track, t.x, t.y, t.z))
            // pushing on but hardly moving for a moment means stuck (nose on a wall, after a spin): touch gets its Back button
            let v = own.view.car.rb.linvel, yaw = own.view.car.rb.yaw, forward = v.x * sin(yaw) + v.z * cos(yaw)
            stuckFor = !locked && forward < 1 ? stuckFor + DT : 0
            // one press uses the Item; held down, a Zap keeps firing (the server allows three Shots a second)
            let press = controls.takeItemPress()
            if !locked && !me.item.isEmpty && (press || (me.item == "zap" && controls.firing())) && now >= nextShot { link.useItem(); nextShot = now + 0.34 }
        }
        let before = own?.view.car.rb.linvel
        world.step()
        clock += DT
        guard let own else { return }
        if state.phase != .grid { ourRams(world, own.view, views.compactMap { $0 }, before!, now) }
        let rb = own.view.car.rb
        let fell = rb.y < track.samples[own.progress.idx].y + FALL_Y, stuck = unstick && stuckFor > UNSTICK_TIME
        if fell || stuck {
            let others = views.compactMap { $0 }.filter { $0 !== own.view }.map { Vec3(x: $0.shown.x, y: $0.shown.y, z: $0.shown.z) }
            teleport(own.view.car, fell ? resetToCheckpoint(track, &own.progress, others) : ontoRoad(track, &own.progress, others))
            own.lockedUntil = clock + 1
            stuckFor = 0
            putBack?()
        } else { updateProgress(track, &own.progress, rb.x, rb.z) }
        // 30 times a second, as often as the server sends its state
        ticks += 1
        if ticks % 2 == 0 { link.send(PoseReport(x: rb.x, y: rb.y, z: rb.z, yaw: rb.yaw, vx: rb.vx, vz: rb.vz, spawn: own.spawn)) }
    }

    private func draw(_ dt: Double, _ time: Double) {
        guard let track else { return }
        glide(views.compactMap { $0 }, dt, time)
        for v in views.compactMap({ $0 }) {
            var p = Vec3(x: v.shown.x, y: v.shown.y, z: v.shown.z), yaw = v.shown.yaw
            if v.mine {
                // drawn between its last two physics steps, so it moves evenly at any frame rate (a jump isn't blended)
                let rb = v.car.rb, k = hypot(hypot(ownBefore.x - rb.x, ownBefore.y - rb.y), ownBefore.z - rb.z) < 5 ? acc / DT : 1
                p = Vec3(x: ownBefore.x + (rb.x - ownBefore.x) * k, y: ownBefore.y + (rb.y - ownBefore.y) * k, z: ownBefore.z + (rb.z - ownBefore.z) * k)
                yaw = ownBeforeYaw + angleDiff(ownBeforeYaw, rb.yaw) * k
            }
            place(v, track, v.mine ? own!.progress.idx : nearestSample(track, p.x, p.y, p.z), p, yaw, dt)
        }
        animate(dt, time)
        let m = cameraNode.simdWorldTransform
        for p in [splash, smoke, sparks, fire, soot] { p.update(Float(dt), right: SIMD3(m.columns.0.x, m.columns.0.y, m.columns.0.z), up: SIMD3(m.columns.1.x, m.columns.1.y, m.columns.1.z)) }
        look?.update(time)
        follow(dt)
    }

    /// The chase camera behind our E-Car (before we have one, behind the first).
    private func follow(_ dt: Double) {
        guard let target = own?.view ?? views.compactMap({ $0 }).first else { return }
        chase(cameraNode, target.model.node.simdPosition, target.yaw, aspect, &lastTarget, dt)
        if shake > 0 {
            shake = max(0, shake - dt)
            cameraNode.simdPosition += SIMD3(Float.random(in: -0.5..<0.5) * Float(shake) * 1.5, Float.random(in: -0.5..<0.5) * Float(shake) * 1.5, 0)
        }
        // running dry greys the view out, and the colour comes back as the drone Recharges the battery
        let grey = lastHud.grey
        cameraNode.camera!.saturation = CGFloat(1 - grey)
        cameraNode.camera!.contrast = CGFloat(grey * 0.2)
    }

    /// Louder the closer it happens to our E-Car.
    func near(_ x: Double, _ z: Double) -> Double {
        let p = own?.view.model.node.simdPosition ?? cameraNode.simdPosition
        return max(0, 1 - hypot(Double(p.x) - x, Double(p.z) - z) / 70)
    }
    func posOf(_ seat: Int) -> SIMD3<Float> { seat >= 0 && seat < views.count ? views[seat]?.model.node.simdPosition ?? .zero : .zero }

    /// Leaving on purpose: the room is left, and the app goes back to its start screen.
    func stop() {
        frameLock.lock()
        defer { frameLock.unlock() }
        gone = true
        sound.silenceLoops()
        link.leave()
    }
}

/// How long the watch's E-Car may be stuck before it is put back on the road.
let UNSTICK_TIME = 2.5

/// Moves progress to a free spot on the road where the E-Car is (or a little behind it, as `resetToCheckpoint` does) and
/// returns the pose to put it at, in the road's middle and facing along it.
private func ontoRoad(_ track: Track, _ p: inout Progress, _ others: [Vec3]) -> Pose {
    guard let spot = freeSpot(track, [p.idx, p.idx - 6, p.idx - 12], others) else { return poseAt(track, p.idx) }
    p.u -= p.idx - spot.idx
    p.idx = (spot.idx + track.n) % track.n
    return spot.pose
}

extension SCNNode {
    func with(_ f: (SCNNode) -> Void) -> SCNNode { f(self); return self }
}
