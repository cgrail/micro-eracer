import SceneKit

// client/src/practice.ts: the Practice Ground behind the start screen's Controls button. The picked Body on an endless flat
// lawn with streets painted on it and nothing to bump into, driven by the touch controls as they are set right there, so each
// way of steering can be felt. Like `Game`, it runs on SceneKit's render thread.

/// One block of the street grid, in metres: a street through its middle each way, as wide as a Track's road.
private let BLOCK = 64.0
/// How many blocks the ground reaches across, centred on the E-Car: past the fog all round. Even, so the streets stay put.
private let BLOCKS = 12
/// Texture pixels per metre.
private let PX = 16.0

/// One block of the ground: a striped lawn, the two streets with white edges and dashed centre lines, and zebra crossings.
private func streets() -> UIImage {
    let size = BLOCK * PX, mid = size / 2, half = HALF_WIDTH * PX
    let m = { (metres: Double) -> Double in metres * PX }
    return picture(Int(size), Int(size)) { g in
        let fill = { (hex: Int, x: Double, y: Double, w: Double, h: Double) -> Void in
            g.setFillColor(color(hex).cgColor)
            g.fill(CGRect(x: x, y: y, width: w, height: h))
        }
        for i in 0..<Int(BLOCK / 8) { fill(i % 2 == 1 ? 0x6cc04a : 0x78cb55, 0, m(Double(i) * 8), size, m(8)) }
        let r = rng("practice")
        for _ in 0..<500 {
            let x = (r() * size).rounded(.down), y = (r() * size).rounded(.down)
            fill(0x4f9e35, x, y, 3, 8)
            fill(0x4f9e35, x + 4, y + 2, 3, 6)
        }
        // drawn along x, then turned a quarter for the street along y
        let street = { () -> Void in
            fill(0x51565f, 0, mid - half, size, 2 * half)
            for y in [mid - half, mid + half - m(0.45)] {
                fill(0xffffff, 0, y, mid - half, m(0.45))
                fill(0xffffff, mid + half, y, mid - half, m(0.45))
            }
            // a zebra crossing each side of the crossroads
            for x in [mid - half - m(4.5), mid + half + m(1.5)] {
                for k in 0..<8 { fill(0xffffff, x, mid - half + m(0.75 + Double(k)), m(3), m(0.5)) }
            }
            // 4 m on, 4 m off, so the dashes run on into the next block
            for k in 0..<Int(BLOCK / 8) where abs(Double(k) * 8 + 4 - BLOCK / 2) > 8 {
                fill(0xfff3b0, m(Double(k) * 8 + 2), mid - m(0.15), m(4), m(0.3))
            }
        }
        street()
        g.translateBy(x: mid, y: mid)
        g.rotate(by: .pi / 2)
        g.translateBy(x: -mid, y: -mid)
        street()
    }
}

final class Practice: NSObject, SCNSceneRendererDelegate {
    let scene = SCNScene()
    let cameraNode = SCNNode()
    /// Width over height of the view, set by the view as it lays out.
    var aspect = 1.0
    private let controls: Controls, sound: Sound
    private let car: Car, model: CarModel, ground: SCNNode
    private let smoke = Particles(0xf4f4f4, 300, gravity: 1.5, grow: 2.2)
    private var shots: [(node: SCNNode, vx: Double, vz: Double, until: Double)] = []
    private var acc = 0.0, last = -1.0, clock = 0.0, nextShot = 0.0, before = (x: 0.0, z: 0.0, yaw: 0.0)
    private var lastTarget = SIMD3<Float>(0, -1e6, 0), gone = false
    /// Held for a whole frame, so `stop` (on the main thread) never cuts one short.
    private let frameLock = NSLock()

    init(body: BodyKind, controls: Controls, sound: Sound) {
        self.controls = controls; self.sound = sound
        // on a street, heading for the crossroads
        let spec = body.spec
        car = Car(rb: RigidBody(half: Vec3(x: HALF.x, y: HALF.y, z: spec.length), mass: spec.mass, dynamic: true, pose: Pose(x: BLOCK / 2, y: HALF.y, z: 4, yaw: 0)), kind: body)
        model = makeCar(body, 0x2f9bff)
        let groundMat = toon(0xffffff, outline: false, map: streets())
        groundMat.diffuse.contentsTransform = SCNMatrix4MakeScale(Float(BLOCKS), Float(BLOCKS), 1)
        groundMat.diffuse.mipFilter = .linear
        groundMat.diffuse.maxAnisotropy = 8
        let reach = BLOCK * Double(BLOCKS), plane = mesh(SCNPlane(width: reach, height: reach), groundMat)
        plane.eulerAngles.x = -.pi / 2
        ground = plane
        super.init()
        before = (car.rb.x, car.rb.z, car.rb.yaw)
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
        // the Garden's sky
        scene.background.contents = picture(2, 256) { g in
            let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [color(0x4fb3ff).cgColor, color(0xc9ecff).cgColor] as CFArray, locations: [0, 1])!
            g.drawLinearGradient(grad, start: .zero, end: CGPoint(x: 0, y: 256), options: [])
        }
        scene.fogColor = color(0xc9ecff)
        scene.fogStartDistance = 140
        scene.fogEndDistance = 320
        for node in [ground, model.node, smoke.node] { scene.rootNode.addChildNode(node) }
        _ = controls.takeItemPress()
        controls.setReversing(false)
    }

    func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
        frameLock.lock()
        defer { frameLock.unlock() }
        if gone { return }
        let dt = last < 0 ? 0 : min(0.1, time - last)
        last = time
        let rb = car.rb
        acc += dt
        while acc >= DT {
            before = (rb.x, rb.z, rb.yaw)
            tick()
            acc -= DT
        }
        // drawn between its last two steps, so it moves evenly at any frame rate
        let k = acc / DT, yaw = before.yaw + angleDiff(before.yaw, rb.yaw) * k
        model.node.position = SCNVector3(before.x + (rb.x - before.x) * k, HALF.y, before.z + (rb.z - before.z) * k)
        setYawPitch(model.node, yaw: yaw, pitch: 0)
        // the ground moves along a block at a time, so the streets stay where they are
        ground.position = SCNVector3((rb.x / BLOCK).rounded() * BLOCK, 0, (rb.z / BLOCK).rounded() * BLOCK)

        let fx = sin(rb.yaw), fz = cos(rb.yaw), r = right(fx, fz)
        let forward = rb.vx * fx + rb.vz * fz, sideways = rb.vx * r.x + rb.vz * r.z
        for w in model.wheels { w.simdLocalRotate(by: simd_quatf(angle: Float(-forward * dt / 0.44), axis: [0, 1, 0])) }
        if abs(sideways) > 3.5 {
            let p = model.node.position, x = Double(p.x) - fx * 1.6, z = Double(p.z) - fz * 1.6
            smoke.emit(x + Double.random(in: -0.5..<0.5), 0.1, z + Double.random(in: -0.5..<0.5), 0, 0.5, 0, 0.7, 0.8)
        }
        sound.drive(hypot(rb.vx, rb.vz), controls.drive().throttle, (abs(sideways) - 3) / 4)
        for s in shots {
            s.node.position.x += Float(s.vx * dt)
            s.node.position.z += Float(s.vz * dt)
        }
        shots.removeAll { s in
            if s.until > clock { return false }
            s.node.removeFromParentNode()
            return true
        }
        let m = cameraNode.simdWorldTransform
        smoke.update(Float(dt), right: SIMD3(m.columns.0.x, m.columns.0.y, m.columns.0.z), up: SIMD3(m.columns.1.x, m.columns.1.y, m.columns.1.z))
        chase(cameraNode, model.node.simdPosition, yaw, aspect, &lastTarget, dt)
    }

    /// One step, as in a Race but with the ground flat everywhere and nothing to meet: no gravity, no walls, no contacts.
    private func tick() {
        let rb = car.rb
        handleCar(car, controls.drive())
        rb.x += rb.vx * DT
        rb.z += rb.vz * DT
        rb.yaw = wrapAngle(rb.yaw + rb.yawRate * DT)
        clock += DT
        // the action button fires Zap Shots, as many as you like
        let press = controls.takeItemPress()
        if (press || controls.firing()) && clock >= nextShot {
            nextShot = clock + SHOT_EVERY
            let fx = sin(rb.yaw), fz = cos(rb.yaw), vx = fx * SHOT_SPEED + rb.vx, vz = fz * SHOT_SPEED + rb.vz
            let shot = makeBolt("shot")
            shot.position = SCNVector3(rb.x + fx * 2.4, HALF.y + 0.45, rb.z + fz * 2.4)
            shot.eulerAngles.y = Float(atan2(vx, vz))
            scene.rootNode.addChildNode(shot)
            shots.append((node: shot, vx: vx, vz: vz, until: clock + SHOT_LIFE))
            sound.shot()
        }
    }

    /// Back to the start screen: the frame in flight finishes, and no other starts.
    func stop() {
        frameLock.lock()
        defer { frameLock.unlock() }
        gone = true
        sound.silenceLoops()
    }
}
