import Combine
import SceneKit
#if os(watchOS)
import WatchKit
private var reduceMotion: Bool { WKAccessibilityIsReduceMotionEnabled() }
#else
import UIKit
private var reduceMotion: Bool { UIAccessibility.isReduceMotionEnabled }
#endif

// The start screens' two pictures (client/src/garage.ts and trackmap.ts), on the phone and on the watch: the picked Body on
// its turntable, and the picked Track from above. Each is a scene with its camera, turned by its renderer's delegate.

/// The turntable: the picked Body turning slowly, with a quick whirl on each pick.
final class Garage: NSObject, ObservableObject, SCNSceneRendererDelegate {
    let scene = SCNScene(), camera = SCNNode(), turntable = SCNNode()
    private var cars: [BodyKind: SCNNode] = [:], speed = 0.0, last = -1.0
    private let still = reduceMotion

    override init() {
        super.init()
        camera.camera = SCNCamera()
        camera.camera!.fieldOfView = 30
        // close enough that the Body fills its picture, with room for the Semi side on
        camera.position = SCNVector3(0, 2.7, 6.9)
        camera.look(at: SCNVector3(0, 0, 0))
        scene.rootNode.addChildNode(camera)
        let ambient = SCNLight(); ambient.type = .ambient; ambient.intensity = 560
        let sun = SCNLight(); sun.type = .directional; sun.intensity = 760
        let sunNode = SCNNode(); sunNode.light = sun; sunNode.position = SCNVector3(4, 8, 3); sunNode.look(at: SCNVector3(0, 0, 0))
        scene.rootNode.addChildNode(SCNNode().with { $0.light = ambient })
        scene.rootNode.addChildNode(sunNode)
        for k in BODY_KINDS { let car = makeCar(k, 0x2f9bff).node; cars[k] = car; turntable.addChildNode(car) }
        // the headlights' beams would sweep right across the little picture
        for car in cars.values { car.childNode(withName: "beams", recursively: false)?.isHidden = true }
        turntable.eulerAngles.y = 0.6
        scene.rootNode.addChildNode(turntable)
    }

    func show(_ kind: BodyKind, whirl: Bool) {
        for (k, car) in cars { car.isHidden = k != kind }
        if whirl && !still { speed = 9 }
    }

    func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
        let dt = last < 0 ? 0 : min(0.1, time - last)
        last = time
        // settling into a slow turn
        speed += ((still ? 0 : 0.8) - speed) * min(1, 3 * dt)
        turntable.eulerAngles.y += Float(speed * dt)
    }
}

// how steeply the camera looks down on the Track; and how long a pick rests before its Track is built (◀ ▶ held step
// every 60 ms, far quicker than a Track builds)
private let TILT = 0.95, SETTLE = 0.15

/// The Track on its turntable (trackmap.ts `createCourse`): the picked Track with all its scenery, seen from above and
/// turning slowly, with a whirl as each one comes up. It is built on the render thread once the pick has rested; for none
/// (any Track) it draws nothing, and the start form shows a question mark instead.
final class Course: NSObject, ObservableObject, SCNSceneRendererDelegate {
    let scene = SCNScene(), camera = SCNNode()
    /// The view's width over its height, from its layout.
    var aspect = 1.0
    // the pick, set on the main thread and read on the render thread (hence the lock), and the Track shown, on the render thread
    private let lock = NSLock()
    private var wanted: TrackDef?, shown: TrackDef?, rest = 0.0
    private var look: TrackScene?, centre = SCNVector3(0, 0, 0), reach = 1.0, angle = 0.0, speed = 0.0, last = -1.0
    private let still = reduceMotion

    override init() {
        super.init()
        camera.camera = SCNCamera()
        camera.camera!.fieldOfView = 30
        scene.rootNode.addChildNode(camera)
        let ambient = SCNLight(); ambient.type = .ambient; ambient.intensity = 560
        let sun = SCNLight(); sun.type = .directional; sun.intensity = 760
        let sunNode = SCNNode(); sunNode.light = sun; sunNode.position = SCNVector3(40, 80, 25); sunNode.look(at: SCNVector3(0, 0, 0))
        scene.rootNode.addChildNode(SCNNode().with { $0.light = ambient })
        scene.rootNode.addChildNode(sunNode)
    }

    func show(_ def: TrackDef?) {
        lock.lock()
        wanted = def
        lock.unlock()
        rest = 0
    }

    private func build(_ def: TrackDef?) {
        look?.node.removeFromParentNode()
        look = nil
        shown = def
        guard let def else { return }
        let track = buildTrack(def), xs = track.samples.map(\.x), zs = track.samples.map(\.z), s0 = track.samples[0]
        let look = buildTrackScene(track)
        self.look = look
        scene.rootNode.addChildNode(look.node)
        scene.background.contents = look.sky
        let cx = (xs.min()! + xs.max()!) / 2, cz = (zs.min()! + zs.max()!) / 2
        centre = SCNVector3(cx, 0, cz)
        reach = track.samples.map { hypot($0.x - cx, $0.z - cz) }.max()! + HALF_WIDTH + 2
        // first from behind the start line, as the chase camera sees it
        angle = atan2(-s0.dx, -s0.dz)
        if !still { speed = 2 }
    }

    func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
        let dt = last < 0 ? 0 : min(0.1, time - last)
        last = time
        rest += dt
        lock.lock()
        let pick = wanted
        lock.unlock()
        if pick != shown && rest > SETTLE { build(pick) }
        guard let look, let lens = camera.camera else { return }
        speed += ((still ? 0 : 0.15) - speed) * min(1, 3 * dt)
        angle += speed * dt
        look.update(time)
        // back far enough for the whole Track: across, and up and down, where the slant squashes it
        let half = tan(lens.fieldOfView * .pi / 360), dist = 1.1 * max(reach / (half * aspect), reach * sin(TILT) / half)
        lens.zNear = dist / 4
        lens.zFar = dist * 3
        camera.position = SCNVector3(Double(centre.x) + sin(angle) * cos(TILT) * dist, sin(TILT) * dist, Double(centre.z) + cos(angle) * cos(TILT) * dist)
        // world up: the one-argument look(at:) keeps the camera's own up, so the picture would roll a little more each turn
        camera.look(at: centre, up: SCNVector3(0, 1, 0), localFront: SCNVector3(0, 0, -1))
    }
}
