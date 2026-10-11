import SceneKit
import UIKit

// buildTrackScene from client/src/scene.ts: the road, its walls, the Charging Station, the start gantry, Puddles and the
// themed props around the Track.

struct TrackScene {
    let node: SCNNode
    let update: (Double) -> Void
    let water: Bool
    let groundY: Double
    let sky: UIImage
    /// The sky's bottom colour, so the fog melts into it.
    let horizon: UIColor
}

/// Flat geometry from positions and triangles, with normals worked out from the faces (three's computeVertexNormals).
func geometry(_ pos: [SIMD3<Float>], _ index: [Int32], uv: [CGPoint]? = nil) -> SCNGeometry {
    var normals = [SIMD3<Float>](repeating: .zero, count: pos.count)
    for t in stride(from: 0, to: index.count, by: 3) {
        let a = Int(index[t]), b = Int(index[t + 1]), c = Int(index[t + 2])
        let n = simd_cross(pos[b] - pos[a], pos[c] - pos[a])
        normals[a] += n; normals[b] += n; normals[c] += n
    }
    let ns = normals.map { simd_length($0) > 0 ? simd_normalize($0) : SIMD3<Float>(0, 1, 0) }
    var sources = [SCNGeometrySource(vertices: pos.map { SCNVector3($0) }), SCNGeometrySource(normals: ns.map { SCNVector3($0) })]
    if let uv { sources.append(SCNGeometrySource(textureCoordinates: uv)) }
    return SCNGeometry(sources: sources, elements: [SCNGeometryElement(indices: index, primitiveType: .triangles)])
}

/// A ribbon between two sideways offsets from the centreline, `lift` above the road; `keep` drops segments (dashes, kerbs).
private func ribbon(_ track: Track, _ from: Double, _ to: (Sample) -> Double, _ lift: Double, _ m: SCNMaterial, keep: (Int) -> Bool = { _ in true }) -> SCNNode {
    var pos: [SIMD3<Float>] = [], index: [Int32] = []
    for (i, s) in track.samples.enumerated() {
        let r = right(s.dx, s.dz), y = Float(s.y + lift), t = to(s)
        pos += [SIMD3(Float(s.x + r.x * from), y, Float(s.z + r.z * from)), SIMD3(Float(s.x + r.x * t), y, Float(s.z + r.z * t))]
        guard keep(i) else { continue }
        let j = Int32((i + 1) % track.n), k = Int32(i)
        index += [2 * k, 2 * k + 1, 2 * j, 2 * k + 1, 2 * j + 1, 2 * j]
    }
    // a ribbon `keep` drops entirely (the kicker's stripes on a Track without a jump) has no triangles, and Metal
    // refuses an index buffer of zero length
    guard !index.isEmpty else { return SCNNode() }
    return mesh(geometry(pos, index), m)
}
private func ribbon(_ track: Track, _ from: Double, _ to: Double, _ lift: Double, _ m: SCNMaterial, keep: (Int) -> Bool = { _ in true }) -> SCNNode {
    ribbon(track, from, { _ in to }, lift, m, keep: keep)
}

/// The road's side, 0.6 m deep, along an offset from the centreline.
private func skirt(_ track: Track, _ offset: (Sample) -> Double, _ m: SCNMaterial) -> SCNNode {
    var pos: [SIMD3<Float>] = [], index: [Int32] = []
    for (i, s) in track.samples.enumerated() {
        let r = right(s.dx, s.dz), x = Float(s.x + r.x * offset(s)), z = Float(s.z + r.z * offset(s))
        pos += [SIMD3(x, Float(s.y), z), SIMD3(x, Float(s.y - 0.6), z)]
        let j = Int32((i + 1) % track.n), k = Int32(i)
        index += [2 * k, 2 * k + 1, 2 * j, 2 * k + 1, 2 * j + 1, 2 * j]
    }
    return mesh(geometry(pos, index), m)
}

/// A flat ring (or a piece of one) lying on the ground.
func ring(_ inner: Double, _ outer: Double, _ m: SCNMaterial, from: Double = 0, length: Double = 2 * .pi, seg: Int = 32) -> SCNNode {
    var pos: [SIMD3<Float>] = [], index: [Int32] = []
    for i in 0...seg {
        let a = from + length * Double(i) / Double(seg)
        pos += [SIMD3(Float(cos(a) * inner), 0, Float(-sin(a) * inner)), SIMD3(Float(cos(a) * outer), 0, Float(-sin(a) * outer))]
        if i < seg { let k = Int32(2 * i); index += [k, k + 1, k + 2, k + 1, k + 3, k + 2] }
    }
    return mesh(geometry(pos, index), m)
}

/// A ring growing out from the middle of a Puddle or pond and fading as it goes.
private func ripple(_ x: Double, _ y: Double, _ z: Double, _ r: Double, _ phase: Double, _ animated: inout [(Double) -> Void]) -> SCNNode {
    let m = toon(0xffffff, outline: false, opacity: 0.7), node = ring(0.85, 1, m)
    node.position = SCNVector3(x, y, z)
    animated.append { t in
        let k = (t / 1.8 + phase).truncatingRemainder(dividingBy: 1), s = Float(0.2 + k * r)
        node.scale = SCNVector3(s, s, s)
        m.transparency = 0.7 * (1 - k)
    }
    return node
}

private func sign(_ text: String, _ w: Int, _ h: Int, _ size: CGFloat, _ fill: Int) -> UIImage {
    picture(w, h) { g in
        g.setFillColor(color(fill).cgColor); g.fill(CGRect(x: 0, y: 0, width: w, height: h))
        letter(text, CGFloat(w) / 2, CGFloat(h) * 0.56, size: size, fill: INK)
    }
}

func buildTrackScene(_ track: Track) -> TrackScene {
    let look = THEMES[track.def.theme]!, random = rng(track.def.id)
    var cache: [String: SCNMaterial] = [:]
    let m: Mats = { hex, outlined in
        let key = "\(hex)-\(outlined)"
        if let c = cache[key] { return c }
        let made = toon(hex, outline: outlined)
        cache[key] = made
        return made
    }
    let statics = SCNNode(), live = SCNNode()
    var animated: [(Double) -> Void] = []

    // ground: the bath is a tub of water with a rim; everything else stands on an endless surface
    let xs = track.samples.map(\.x), zs = track.samples.map(\.z)
    let cx = (xs.min()! + xs.max()!) / 2, cz = (zs.min()! + zs.max()!) / 2
    let w = xs.max()! - xs.min()! + 80, d = zs.max()! - zs.min()! + 80
    let (gw, gd) = look.water ? (w, d) : (700.0, 700.0)
    let groundMat = toon(0xffffff, outline: false, map: look.ground())
    groundMat.diffuse.contentsTransform = SCNMatrix4MakeScale(Float(gw / 17), Float(gd / 17), 1)
    let ground = mesh(SCNPlane(width: gw, height: gd), groundMat, cx, look.groundY, cz)
    ground.eulerAngles.x = -.pi / 2
    live.addChildNode(ground)
    if look.water {
        animated.append { t in
            groundMat.diffuse.contentsTransform = SCNMatrix4Mult(SCNMatrix4MakeScale(Float(gw / 17), Float(gd / 17), 1), SCNMatrix4MakeTranslation(Float(t * 0.01 * gw / 17), Float(t * 0.006 * gd / 17), 0))
        }
        for (x, z, sx, sz) in [(cx, cz - d / 2, w + 8, 8.0), (cx, cz + d / 2, w + 8, 8), (cx - w / 2, cz, 8, d), (cx + w / 2, cz, 8, d)] {
            statics.addChildNode(rbox(sx, 7, sz, 3, m(0xffffff, true), x, look.groundY + 1, z))
        }
        let tiles = toon(0xffffff, outline: false, map: picture(64, 64) { g in
            g.setFillColor(color(0xeef5f8).cgColor); g.fill(CGRect(x: 0, y: 0, width: 64, height: 64))
            g.setFillColor(color(0xc4d3da).cgColor); g.fill(CGRect(x: 0, y: 0, width: 64, height: 3)); g.fill(CGRect(x: 0, y: 0, width: 3, height: 64))
        })
        tiles.diffuse.contentsTransform = SCNMatrix4MakeScale(120, 120, 1)
        let floor = mesh(SCNPlane(width: 700, height: 700), tiles, cx, look.groundY - 6, cz)
        floor.eulerAngles.x = -.pi / 2
        live.addChildNode(floor)
    }

    // the road: asphalt, white edges on straights, red/white kerbs in turns, dashed centre line
    statics.addChildNode(ribbon(track, -HALF_WIDTH, HALF_WIDTH, 0, m(0x51565f, false)))
    let white = m(0xffffff, false), red = m(0xff3b3b, false), turn = { (i: Int) in track.samples[i].turn }
    for (a, b) in [(-HALF_WIDTH, -HALF_WIDTH + 0.45), (HALF_WIDTH - 0.45, HALF_WIDTH)] {
        statics.addChildNode(ribbon(track, a, b, 0.01, white) { !turn($0) })
        statics.addChildNode(ribbon(track, a - 0.15, b + 0.15, 0.012, red) { turn($0) && ($0 / 2) % 2 == 0 })
        statics.addChildNode(ribbon(track, a - 0.15, b + 0.15, 0.012, white) { turn($0) && ($0 / 2) % 2 == 1 })
    }
    statics.addChildNode(ribbon(track, -0.15, 0.15, 0.01, m(0xfff3b0, false)) { !turn($0) && !track.samples[$0].kick && ($0 / 3) % 2 == 0 })
    // a jump's kicker in hazard stripes, just under the edge lines, which would otherwise flicker through it
    statics.addChildNode(ribbon(track, -HALF_WIDTH, HALF_WIDTH, 0.006, m(0xffd60a, false)) { track.samples[$0].kick && $0 % 2 == 0 })
    let side = toon(0x3a3f47, outline: false, doubleSided: true)
    statics.addChildNode(skirt(track, { _ in -HALF_WIDTH }, side))
    statics.addChildNode(skirt(track, { HALF_WIDTH + $0.bay }, side))

    // the Charging Station: a blue bay with green charging pads under a canopy with its sign
    statics.addChildNode(ribbon(track, HALF_WIDTH, { HALF_WIDTH + $0.bay }, 0, m(0x4a6a8f, false)) { track.samples[$0].bay > 0 })
    statics.addChildNode(ribbon(track, HALF_WIDTH + 0.8, HALF_WIDTH + BAY_WIDTH - 0.8, 0.012, m(0x39e46b, false)) { track.samples[$0].bay >= BAY_WIDTH && $0 % 5 < 3 })
    let mid = track.samples[track.n - 17], rm = right(mid.dx, mid.dz), at = HALF_WIDTH + BAY_WIDTH / 2
    // turned along the road, the canopy's +x points left, so its posts stand at -x on the bay's outer edge; the roof is
    // see-through so the high camera still shows the E-Cars under it, and the sign faces the E-Cars coming in (-z)
    let board = mesh(SCNBox(width: BAY_WIDTH, height: 1.2, length: 0.2, chamferRadius: 0), toon(0xffffff, map: sign("⚡ CHARGE", 256, 64, 46, 0x39e46b)), 0, 5.1, -9.9)
    board.geometry!.firstMaterial!.diffuse.wrapS = .clamp
    let canopy = group([-9.0, 9].map { cyl(0.25, 0.25, 4.2, m(0x333a44, true), -(BAY_WIDTH / 2 + 0.2), 2.1, $0, 10) }
                       + [rbox(BAY_WIDTH + 1.2, 0.35, 20, 0.12, toon(0xffffff, opacity: 0.45), 0, 4.3, 0), board])
    canopy.position = SCNVector3(mid.x + rm.x * at, mid.y, mid.z + rm.z * at)
    canopy.eulerAngles.y = Float(atan2(mid.dx, mid.dz))
    outline(canopy)
    live.addChildNode(canopy)

    for (i, wall) in track.walls.enumerated() {
        let node = rbox(0.5, 1, wall.length + 0.06, 0.12, (i / 4) % 2 == 1 ? m(0xffffff, true) : m(0xff3b3b, true), wall.x, wall.y + 0.5, wall.z)
        setYawPitch(node, yaw: wall.yaw, pitch: wall.pitch)
        statics.addChildNode(node)
    }
    // pillars hold the road up, except where they would stand on the road under a bridge
    let overRoad = { (p: Sample) in track.samples.contains { $0.y < p.y - 1 && sq($0.x - p.x) + sq($0.z - p.z) < sq(HALF_WIDTH + 1) } }
    for i in stride(from: 0, to: track.n, by: 12) where !overRoad(track.samples[i]) {
        let s = track.samples[i]
        statics.addChildNode(cyl(0.35, 0.5, s.y - look.groundY, m(0xb8c0cc, true), s.x, (s.y + look.groundY) / 2 - 0.3, s.z, 8))
    }

    // start/finish: checkered line and a banner gantry
    let s0 = track.samples[0]
    let checker = toon(0xffffff, outline: false, map: picture(16, 4) { g in
        for x in 0..<16 { for y in 0..<4 { g.setFillColor(color((x + y) % 2 == 1 ? 0x111111 : 0xffffff).cgColor); g.fill(CGRect(x: x, y: y, width: 1, height: 1)) } }
    })
    checker.diffuse.magnificationFilter = .nearest
    let line = mesh(SCNPlane(width: HALF_WIDTH * 2, height: 2), checker, s0.x, s0.y + 0.02, s0.z)
    line.eulerAngles = SCNVector3(-Double.pi / 2, 0, atan2(-s0.dx, -s0.dz))
    live.addChildNode(line)
    let banner = mesh(SCNBox(width: HALF_WIDTH * 2 + 3.6, height: 1.6, length: 0.5, chamferRadius: 0), toon(0xffffff, map: sign("MICRO E-RACER", 512, 96, 64, 0xffd60a)), 0, 6, 0)
    banner.geometry!.firstMaterial!.diffuse.wrapS = .clamp
    let gantry = group(cyl(0.4, 0.4, 6, m(0x333a44, true), HALF_WIDTH + 1.4, 3, 0, 10), cyl(0.4, 0.4, 6, m(0x333a44, true), -HALF_WIDTH - 1.4, 3, 0, 10), banner)
    gantry.position = SCNVector3(s0.x, s0.y, s0.z)
    gantry.eulerAngles.y = Float(atan2(s0.dx, s0.dz))
    outline(gantry)
    live.addChildNode(gantry)

    // Puddles on the road
    for p in track.puddles {
        live.addChildNode(disc(p.r, toon(look.puddle, outline: false, opacity: 0.85), p.x, p.y + 0.03, p.z))
        let shine = ring(p.r * 0.5, p.r * 0.62, toon(0xffffff, outline: false, opacity: 0.6), from: 0.4, length: 1.3, seg: 24)
        shine.position = SCNVector3(p.x, p.y + 0.04, p.z)
        live.addChildNode(shine)
        live.addChildNode(ripple(p.x, p.y + 0.05, p.z, p.r * 0.9, random(), &animated))
    }

    placeProps(track, look, m, random, statics, live, &animated)

    // merged per material: far fewer draw calls (and outline passes) on phones
    let outlined = SCNNode(), flat = SCNNode()
    for child in statics.childNodes {
        var wantsOutline = false
        child.enumerateHierarchy { n, _ in if n.geometry?.materials.contains(where: { $0.name == nil }) == true { wantsOutline = true } }
        (wantsOutline ? outlined : flat).addChildNode(child)
    }
    let merged = outlined.flattenedClone()
    outline(merged, thick: true)
    let root = group(merged, flat.flattenedClone(), live)
    let sky = picture(2, 256) { g in
        let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [color(look.sky.0).cgColor, color(look.sky.1).cgColor] as CFArray, locations: [0, 1])!
        g.drawLinearGradient(grad, start: .zero, end: CGPoint(x: 0, y: 256), options: [])
    }
    return TrackScene(node: root, update: { t in animated.forEach { $0(t) } }, water: look.water, groundY: look.groundY, sky: sky, horizon: color(look.sky.1))
}

/// Scenery in the tiles the road does not use: every prop stays inside its tile, clear of the road, the next tile's props
/// and the other prop in its tile.
private func placeProps(_ track: Track, _ look: ThemeLook, _ m: @escaping Mats, _ random: @escaping () -> Double, _ statics: SCNNode, _ live: SCNNode, _ animated: inout [(Double) -> Void]) {
    let key = { (x: Double, z: Double) in "\(Int(x.rounded())),\(Int(z.rounded()))" }
    let used = Set(track.tiles.map { key($0.x, $0.z) })
    let tx = track.tiles.map(\.x), tz = track.tiles.map(\.z)
    var footprints: [String: Double] = [:]
    let footprint = { (kind: String) -> Double in
        if let f = footprints[kind] { return f }
        let (lo, hi) = PROPS[kind]!(m, rng(kind)).boundingBox
        // any way it's turned, the prop fits in this circle
        let f = [lo.x, hi.x].flatMap { bx in [lo.z, hi.z].map { bz in Double(hypot(bx, bz)) } }.max()!
        footprints[kind] = f
        return f
    }
    var ponds = 0
    for x in stride(from: tx.min()! - 2 * TILE, through: tx.max()! + 2 * TILE, by: TILE) {
        for z in stride(from: tz.min()! - 2 * TILE, through: tz.max()! + 2 * TILE, by: TILE) {
            if used.contains(key(x, z)) { continue }
            let count = random() < 0.8 ? 1 + Int(random() * 2) : 0
            var placed: [(x: Double, z: Double, r: Double)] = []
            for _ in 0..<count {
                var kind = look.props[Int(random() * Double(look.props.count))]
                // a pond takes a whole tile to itself
                if kind == "pond" && (ponds >= 2 || !placed.isEmpty) { kind = "flower" }
                if kind == "pond" { ponds += 1 }
                let r = kind == "pond" ? 0 : footprint(kind), room = max(0, TILE / 2 - 0.5 - r)
                var px = x, pz = z, fits = false, tries = 0
                while tries < 6 && !fits {
                    px = x + (random() * 2 - 1) * room
                    pz = z + (random() * 2 - 1) * room
                    fits = placed.allSatisfy { hypot($0.x - px, $0.z - pz) > $0.r + r + 0.5 }
                    tries += 1
                }
                if !fits { continue }
                placed.append((px, pz, r))
                if kind == "pond" {
                    live.addChildNode(disc(5.5, toon(0x4fb3e8, outline: false), x, look.groundY + 0.05, z))
                    live.addChildNode(ripple(x, look.groundY + 0.08, z, 5, random(), &animated))
                    for a in 0..<12 {
                        let stone = PROPS["stone"]!(m, random)
                        stone.position = SCNVector3(x + cos(Double(a) / 1.9) * 5.6, look.groundY, z + sin(Double(a) / 1.9) * 5.6)
                        statics.addChildNode(stone)
                    }
                    break
                }
                let prop = group(PROPS[kind]!(m, random))
                prop.position = SCNVector3(px, look.groundY, pz)
                prop.eulerAngles.y = Float(random() * .pi * 2)
                if kind == "duck" {
                    // ducks float, so they stay out of the merge to bob on the bath water
                    let phase = random() * 6
                    animated.append { t in prop.position.y = Float(look.groundY + sin(t * 2 + phase) * 0.25); prop.eulerAngles.z = Float(sin(t * 1.6 + phase) * 0.08) }
                    outline(prop, thick: true)
                    live.addChildNode(prop)
                } else { statics.addChildNode(prop) }
            }
            if look.water && random() < 0.3 { live.addChildNode(ripple(x, look.groundY + 0.05, z, 4, random(), &animated)) }
        }
    }
    if track.def.theme == .garden {
        // a few comic clouds far away
        let xs = track.samples.map(\.x), zs = track.samples.map(\.z), cx = (xs.min()! + xs.max()!) / 2, cz = (zs.min()! + zs.max()!) / 2
        for i in 0..<8 {
            let a = Double(i) / 8 * .pi * 2, d = 170 + random() * 40
            let cloud = group(sph(8, m(0xffffff, true)), sph(6, m(0xffffff, true), 8, -1, 0), sph(6, m(0xffffff, true), -8, -1.5, 0), sph(5, m(0xffffff, true), 3, 4, 0))
            cloud.position = SCNVector3(cx + cos(a) * d, 45 + random() * 20, cz + sin(a) * d)
            cloud.look(at: SCNVector3(cx, Double(cloud.position.y), cz))
            statics.addChildNode(cloud)
        }
    }
}
