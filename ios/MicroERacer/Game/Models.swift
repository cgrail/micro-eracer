import SceneKit
import UIKit

// client/src/cars.ts and the small models of client/src/scene.ts: E-Cars, Batteries, Item Boxes, weapons, drones, name tags.

let SEAT_COLORS = [0xff4d4d, 0x2f9bff, 0xffa62b, 0x1fd1b2, 0xa66cff, 0xffd60a, 0x5ad45a, 0xff6fb5]

/// What the game animates on an E-Car model.
final class CarModel {
    let node: SCNNode, wheels: [SCNNode], beacon: SCNNode, halo: SCNNode, shield: SCNNode
    init(node: SCNNode, wheels: [SCNNode], beacon: SCNNode, halo: SCNNode, shield: SCNNode) {
        self.node = node; self.wheels = wheels; self.beacon = beacon; self.halo = halo; self.shield = shield
    }
}

private typealias Build = (_ paint: SCNMaterial, _ glass: SCNMaterial, _ white: SCNMaterial, _ lamp: SCNMaterial) -> [SCNNode]
/// Each Body's look: the bodywork, where its axles sit and how high its roof is (for the warning light).
private let LOOKS: [BodyKind: (axles: [Double], roof: Double, build: Build)] = [
    // a low generic Roadster
    .roadster: ([1.2, -1.2], 0.55, { paint, glass, _, _ in [
        rbox(1.9, 0.5, 3.9, 0.22, paint, 0, -0.12, 0), rbox(1.45, 0.42, 1.3, 0.2, glass, 0, 0.3, -0.35), rbox(1.6, 0.12, 0.5, 0.05, paint, 0, 0.42, -1.75),
        cyl(0.08, 0.08, 0.4, paint, 0.6, 0.25, -1.75), cyl(0.08, 0.08, 0.4, paint, -0.6, 0.25, -1.75),
    ] }),
    // a rounded family SUV
    .suv: ([1.25, -1.25], 1.05, { paint, glass, white, _ in [
        rbox(1.95, 0.72, 3.9, 0.3, paint, 0, 0, 0), rbox(1.82, 0.62, 2.5, 0.32, paint, 0, 0.6, -0.25), rbox(1.86, 0.36, 2.3, 0.12, glass, 0, 0.64, -0.25),
        rbox(1.5, 0.08, 1.6, 0.03, white, 0, 0.95, -0.3),
    ] }),
    // a two-tone retro Microbus
    .microbus: ([1.2, -1.2], 1.3, { paint, glass, white, _ in [
        rbox(1.9, 0.8, 3.7, 0.3, paint, 0, -0.02, 0), rbox(1.85, 0.95, 3.3, 0.35, white, 0, 0.78, -0.12), rbox(1.92, 0.42, 2.9, 0.15, glass, 0, 0.86, -0.15),
        rbox(1.2, 0.5, 0.2, 0.1, paint, 0, 0.32, 1.85),
    ] }),
    // a big pickup with its open bed and a light bar right across the front
    .pickup: ([1.45, -1.35], 1.05, { paint, glass, _, lamp in [
        rbox(2, 0.72, 4.3, 0.22, paint, 0, -0.02, 0), rbox(1.9, 0.68, 1.6, 0.22, paint, 0, 0.62, 0.35), rbox(1.94, 0.34, 1.4, 0.1, glass, 0, 0.7, 0.35),
        rbox(1.7, 0.1, 1.9, 0.05, toon(0x2b2f36), 0, 0.36, -1.1), rbox(1.8, 0.1, 0.08, 0.04, lamp, 0, 0.24, 2.16),
    ] }),
    // a truck cab pulling a box trailer with a stripe in the Racer's colour
    .semi: ([1.7, -0.6, -1.7], 1.45, { paint, glass, white, _ in [
        rbox(1.95, 1.25, 1.5, 0.3, paint, 0, 0.35, 1.6), rbox(1.98, 0.45, 0.6, 0.1, glass, 0, 0.62, 2.05),
        rbox(1.95, 1.55, 3.2, 0.15, white, 0, 0.55, -0.8), rbox(1.99, 0.3, 3, 0.05, paint, 0, 0.3, -0.8),
    ] }),
]

/// A generic look-alike of the Body, facing +z, origin at the physics body's centre.
func makeCar(_ kind: BodyKind, _ hex: Int) -> CarModel {
    let paint = toon(hex), glass = toon(0x1d2b45), white = toon(0xfafafa), tyre = toon(0x1a1a1a), rim = toon(0xc9ced6), lamp = toon(0xfff6b0, outline: false)
    let look = LOOKS[kind]!, length = kind.spec.length
    let g = group(look.build(paint, glass, white, lamp))
    g.addChildNode(sph(0.2, lamp, 0.6, 0.08, length + 0.08))
    g.addChildNode(sph(0.2, lamp, -0.6, 0.08, length + 0.08))
    // red warning light on the roof, flashing while the battery runs low
    let z = kind == .semi ? 1.6 : 0
    let halo = sph(0.9, glow(0xff3030, opacity: 0.35), 0, look.roof + 0.15, z, 12)
    let beacon = group(cyl(0.18, 0.22, 0.12, toon(0x333333), 0, look.roof, z, 10), sph(0.2, glow(0xff2020), 0, look.roof + 0.15, z), halo)
    beacon.isHidden = true
    g.addChildNode(beacon)
    let bubble = sph(2.4, toon(0x7fd6ff, outline: false, opacity: 0.3), 0, 0.2, 0, 20)
    bubble.scale = SCNVector3(0.9, 0.75, 1.25 * (length / 1.8))
    bubble.isHidden = true
    g.addChildNode(bubble)
    var wheels: [SCNNode] = []
    for az in look.axles { for x in [0.88, -0.88] {
        // the tyre rolls about its own axis, which lies across the car
        let w = group(cyl(0.44, 0.44, 0.34, tyre, 0, 0, 0, 14), cyl(0.22, 0.22, 0.36, rim, 0, 0, 0, 8))
        let axle = group(w)
        axle.eulerAngles.z = .pi / 2
        axle.position = SCNVector3(x, -0.3, az)
        wheels.append(w)
        g.addChildNode(axle)
    } }
    let shadow = disc(2.2, glow(0x000000, opacity: 0.25), 0, -0.43, 0)
    shadow.scale = SCNVector3(0.55, 1, length / 1.8)
    g.addChildNode(shadow)
    outline(g)
    return CarModel(node: g, wheels: wheels, beacon: beacon, halo: halo, shield: bubble)
}

func makeBattery() -> SCNNode {
    let g = group(cyl(0.55, 0.55, 1.3, toon(0x39e46b)), cyl(0.57, 0.57, 0.35, toon(0xffffff), 0, 0.1, 0), cyl(0.25, 0.25, 0.3, toon(0xc9ced6), 0, 0.8, 0, 10))
    outline(g)
    g.addChildNode(sph(1.2, glow(0x8dff9e, opacity: 0.25), 0, 0, 0, 12))
    return g
}

private let BOX_FACE = picture(64, 64) { g in
    let colors = [0xff4d4d, 0xffd60a, 0x39e46b, 0x2f9bff, 0xa66cff].map { color($0).cgColor }
    let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors as CFArray, locations: [0, 0.25, 0.5, 0.75, 1])!
    g.drawLinearGradient(grad, start: .zero, end: CGPoint(x: 64, y: 64), options: [])
    letter("?", 32, 35, size: 48, fill: .white, stroke: (INK, 4))
}

func makeItemBox() -> SCNNode {
    let g = group(rbox(1.6, 1.6, 1.6, 0.25, toon(0xffffff, map: BOX_FACE)))
    outline(g)
    return g
}

func makeBolt(_ kind: String) -> SCNNode {
    if kind == "shot" {
        let b = mesh(SCNCapsule(capRadius: 0.2, height: 1.8), glow(0xfff15c))
        b.eulerAngles.x = .pi / 2
        return group(b)
    }
    let fins = (0..<4).map { i -> SCNNode in
        let a = Double(i) * .pi / 2, f = rbox(0.05, 0.4, 0.5, 0.02, toon(0x333333), cos(a) * 0.3, -0.5, sin(a) * 0.3)
        f.eulerAngles.y = Float(a)
        return f
    }
    let missile = group([cyl(0.25, 0.25, 1.4, toon(0xff3b3b), 0, 0, 0, 10), cone(0.25, 0.5, toon(0xffffff), 0, 0.95, 0, 10)] + fins)
    missile.eulerAngles.x = .pi / 2
    let g = group(missile)
    outline(g)
    return g
}

/// A Mine, and its blinking light.
func makeMine() -> (node: SCNNode, light: SCNMaterial) {
    let light = glow(0xff2020)
    let spikes = (0..<6).map { i -> SCNNode in
        let a = Double(i) * .pi / 3, sp = cone(0.15, 0.5, toon(0x555b66), cos(a) * 0.7, 0.3, sin(a) * 0.7, 6)
        sp.eulerAngles = SCNVector3(sin(a) * 1.2, 0, -cos(a) * 1.2)
        return sp
    }
    let dome = SCNSphere(radius: 0.7)
    dome.segmentCount = 14
    // a dome: its lower half is under the road
    let g = group([mesh(dome, toon(0x2b2f36)), sph(0.18, light, 0, 0.72, 0)] + spikes)
    outline(g)
    return (g, light)
}

/// The Recharge drone, and its rotors.
func makeDrone() -> (node: SCNNode, rotors: [SCNNode]) {
    let dark = toon(0x2b2f36), prop = toon(0xd8dde4)
    let d = group(rbox(1.6, 0.5, 1.6, 0.2, dark), sph(0.15, toon(0xff3b3b, outline: false), 0, 0.3, 0.8), cyl(0.04, 0.04, 2.6, dark, 0, -1.5, 0, 4))
    var rotors: [SCNNode] = []
    for (x, z) in [(1.2, 1.2), (-1.2, 1.2), (1.2, -1.2), (-1.2, -1.2)] {
        let arm = rbox(hypot(x, z), 0.15, 0.25, 0.05, dark, x / 2, 0, z / 2)
        arm.eulerAngles.y = Float(atan2(-z, x))
        let rotor = cyl(0.7, 0.7, 0.05, prop, x, 0.3, z, 12)
        rotors.append(rotor)
        d.addChildNode(arm)
        d.addChildNode(rotor)
    }
    outline(d)
    return (d, rotors)
}

/// A Player's name in gold, a Bot's in grey, so you can tell who is who.
func makeNameTag(_ name: String, human: Bool) -> SCNNode {
    let image = picture(256, 64) { _ in letter(name, 128, 34, size: 40, fill: human ? color(0xffd60a) : color(0xc9ced6), stroke: (INK, 7)) }
    let m = SCNMaterial()
    m.lightingModel = .constant
    m.diffuse.contents = image
    m.readsFromDepthBuffer = false
    m.writesToDepthBuffer = false
    let tag = SCNNode(geometry: SCNPlane(width: 4, height: 1))
    tag.geometry!.materials = [m]
    tag.position.y = 2.6
    tag.renderingOrder = 10
    tag.constraints = [SCNBillboardConstraint()]
    return tag
}
