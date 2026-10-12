import SceneKit
import UIKit

// The first four themes and their props, from client/src/props.ts (the rest are data: ThemeData.swift), and how scene.ts
// places the props and landmarks of any theme round a Track (`placeProps`).

/// Small deterministic random (scene.ts `rng`), so every device decorates a Track the same way.
func rng(_ seed: String) -> () -> Double {
    var h: UInt32 = 2166136261
    for unit in seed.utf16 { h = (h ^ UInt32(unit)) &* 16777619 }
    return {
        h = ((h ^ (h >> 15)) &* 2246822507) ^ ((h ^ (h >> 13)) &* 3266489909)
        h ^= h >> 16
        return Double(h) / 4294967296
    }
}

/// Materials shared per colour while a Track is built, so the merge can group by them.
typealias Mats = (_ hex: Int, _ outline: Bool) -> SCNMaterial

/// A dome: the top half of a sphere, standing on its flat side.
func dome(_ r: Double, _ m: SCNMaterial, _ x: Double = 0, _ y: Double = 0, _ z: Double = 0, seg: Int = 16) -> SCNNode {
    var pos: [SCNVector3] = [], normals: [SCNVector3] = [], index: [Int32] = []
    let rings = seg / 2
    for i in 0...rings { for j in 0...seg {
        let a = Double(i) / Double(rings) * .pi / 2, b = Double(j) / Double(seg) * 2 * .pi
        let n = SCNVector3(cos(a) * cos(b), sin(a), cos(a) * sin(b))
        normals.append(n)
        pos.append(SCNVector3(Double(n.x) * r, Double(n.y) * r, Double(n.z) * r))
        if i < rings && j < seg {
            let k = Int32(i * (seg + 1) + j), up = k + Int32(seg + 1)
            index += [k, up, k + 1, k + 1, up, up + 1]
        }
    } }
    let g = SCNGeometry(sources: [SCNGeometrySource(vertices: pos), SCNGeometrySource(normals: normals)], elements: [SCNGeometryElement(indices: index, primitiveType: .triangles)])
    return mesh(g, m, x, y, z)
}

private func pick(_ r: () -> Double, _ list: [Int]) -> Int { list[Int(r() * Double(list.count))] }

typealias PropMaker = (_ m: Mats, _ r: @escaping () -> Double) -> SCNNode

let PROPS: [String: PropMaker] = [
    "plate": { m, r in group(cyl(6, 5, 0.5, m(0xffffff, true)), sph(1.6, m(pick(r, [0xff5a3c, 0x7ac943, 0xffc93c]), true), 1.5, 0.6, -1)) },
    "mug": { m, _ in
        let handle = mesh(SCNTorus(ringRadius: 1.3, pipeRadius: 0.35), m(0x3a86ff, true), 3.1, 1.6, 0)
        handle.eulerAngles.x = .pi / 2
        return group(cyl(3, 3, 3.6, m(0x3a86ff, true), 0, 1.8), cyl(2.7, 2.7, 0.1, m(0x6b3e26, false), 0, 3.5), handle)
    },
    "toaster": { m, _ in group(rbox(9, 5, 5, 1, m(0xd9dde3, true), 0, 2.5), rbox(6, 0.3, 1, 0.1, m(0x333333, true), 0, 5, -1), rbox(6, 0.3, 1, 0.1, m(0x333333, true), 0, 5, 1), rbox(0.5, 1.5, 0.8, 0.2, m(0x222222, true), 4.6, 3, 0)) },
    "apple": { m, _ in group(sph(2.4, m(0xe63946, true), 0, 2.2), cyl(0.15, 0.15, 1, m(0x6b3e26, true), 0, 4.8), sph(0.6, m(0x5ad45a, true), 0.6, 4.7)) },
    "cheese": { m, _ in let w = cyl(4, 4, 2.5, m(0xffd166, true), 0, 1.25, 0, 3); w.eulerAngles.y = 0.4; return w },
    "flower": { m, r in
        let petal = m(pick(r, [0xff6fb5, 0xffd60a, 0xa66cff, 0xff4d4d]), true), h = 3 + r() * 3
        let petals = (0..<5).map { i in sph(0.9, petal, cos(Double(i) * 2 * .pi / 5) * 1.1, h, sin(Double(i) * 2 * .pi / 5) * 1.1) }
        return group([cyl(0.2, 0.2, h, m(0x3d9a3d, true), 0, h / 2), sph(0.7, m(0xffe066, true), 0, h + 0.2)] + petals)
    },
    "bush": { m, _ in group(sph(3, m(0x4caf50, true), 0, 2), sph(2.4, m(0x5cc05c, true), 2.4, 1.6, 1), sph(2.2, m(0x43a047, true), -2.2, 1.5, -0.6)) },
    "stone": { m, r in
        let s = SCNSphere(radius: 1.5 + r() * 1.5)
        s.isGeodesic = true
        s.segmentCount = 1
        let n = mesh(s, m(0xa0a4ab, true), 0, 0.6, 0)
        n.scale.y = 0.6
        return group(n)
    },
    "mushroom": { m, _ in group(cyl(0.7, 0.9, 2.2, m(0xfff3e0, true), 0, 1.1), dome(2, m(0xe63946, true), 0, 2), sph(0.35, m(0xffffff, true), 0.9, 3.3, 0.6), sph(0.3, m(0xffffff, true), -0.8, 3.4, -0.4)) },
    "gnome": { m, _ in group(cyl(1.4, 1.8, 3.4, m(0x2f6fdb, true), 0, 1.7), sph(1.1, m(0xffd2b0, true), 0, 4), cone(1, 2.2, m(0xffffff, true), 0, 3.4, 0.7), cone(1.2, 3, m(0xe63946, true), 0, 5.8)) },
    "pencil": { m, r in
        let p = group(cyl(0.6, 0.6, 12, m(pick(r, [0xffd60a, 0x2f9bff, 0xff4d4d]), true), 0, 0, 0, 6), cone(0.6, 2, m(0xf4d6a0, true), 0, 7, 0, 6), cyl(0.62, 0.62, 1.2, m(0xff9fb5, true), 0, -6.6, 0, 6))
        p.eulerAngles.z = .pi / 2
        p.position.y = 0.6
        return group(p)
    },
    "books": { m, r in
        let count = 1 + Int(r() * 3)
        return group((0..<count).map { i in
            let b = group(rbox(9, 1.8, 6.5, 0.2, m([0xe63946, 0x2f9bff, 0x1fd1b2, 0xffa62b][(i + Int(r() * 4)) % 4], true)), rbox(8.6, 1.5, 6.3, 0.1, m(0xfffaf0, true), 0.3, 0, 0))
            b.position.y = Float(0.9 + Double(i) * 1.8)
            b.eulerAngles.y = Float(r() * 0.6 - 0.3)
            return b
        })
    },
    "cup": { m, _ in group(cyl(2.4, 2, 4, m(0xffffff, true), 0, 2), cyl(2.2, 2.2, 0.1, m(0x6b3e26, false), 0, 3.8)) },
    "note": { m, r in let n = rbox(5, 0.2, 5, 0.05, m(pick(r, [0xffe066, 0xff9fb5, 0x9be7ff]), true), 0, 0.1); n.eulerAngles.y = Float(r()); return group(n) },
    "eraser": { m, _ in rbox(4, 1.4, 2.2, 0.4, m(0xff9fb5, true), 0, 0.7) },
    "duck": { m, _ in
        let beak = cone(0.6, 1.4, m(0xff8c1a, true), 3.4, 2.8, 0, 8)
        beak.eulerAngles.z = -.pi / 2
        return group(sph(2.4, m(0xffd60a, true), 0, 1), sph(1.5, m(0xffd60a, true), 1.6, 3, 0), beak, sph(0.25, m(0x111111, true), 2.4, 3.5, 0.7), sph(0.25, m(0x111111, true), 2.4, 3.5, -0.7))
    },
    "foam": { m, r in group((0..<5).map { _ in let s = 0.8 + r() * 1.2, x = r() * 4 - 2; return sph(s, m(0xffffff, true), x, 0.3, r() * 4 - 2) }) },
    "soap": { m, _ in rbox(4.5, 1.4, 2.8, 0.6, m(0xff9fb5, true), 0, 0.6) },
]

struct ThemeLook {
    let sky: (Int, Int)
    let groundY: Double
    let ground: () -> UIImage
    let puddle: Int
    let props: [String]
    var water = false
    /// The place, as the start screen names it.
    var title = ""
    /// Big props, each once, in a free tile of its own beside the road (ThemeData.swift).
    var landmarks: [String] = []
    /// Comic clouds far away.
    var clouds = false
}

private func rect(_ g: CGContext, _ hex: Int, _ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) { g.setFillColor(color(hex).cgColor); g.fill(CGRect(x: x, y: y, width: w, height: h)) }

let THEMES: [Theme: ThemeLook] = [
    .kitchen: ThemeLook(sky: (0xffe9c9, 0xf6cfa0), groundY: -3, ground: { picture(256, 256) { g in
        rect(g, 0xd4955a, 0, 0, 256, 256)
        for y in stride(from: 0, to: 256, by: 64) {
            rect(g, y % 128 != 0 ? 0xcb8b50 : 0xd99e64, 0, CGFloat(y), 256, 64)
            rect(g, 0x9c5f30, 0, CGFloat(y), 256, 3)
            g.setStrokeColor(color(0xb97a44).cgColor); g.setLineWidth(2)
            for i in 0..<4 {
                let base = CGFloat(y + 14 + i * 12)
                g.move(to: CGPoint(x: 0, y: base))
                g.addCurve(to: CGPoint(x: 256, y: base), control1: CGPoint(x: 80, y: base - 6), control2: CGPoint(x: 170, y: base + 8))
                g.strokePath()
            }
        }
    } }, puddle: 0x9fdcff, props: ["plate", "mug", "toaster", "apple", "cheese"], title: "Kitchen"),
    .garden: ThemeLook(sky: (0x4fb3ff, 0xc9ecff), groundY: -3, ground: { picture(256, 256) { g in
        rect(g, 0x6cc04a, 0, 0, 256, 256)
        rect(g, 0x7cd058, 0, 0, 128, 256)
        for i in 0..<90 { let x = CGFloat((i * 97) % 256), y = CGFloat((i * 57) % 256); rect(g, 0x4f9e35, x, y, 3, 8); rect(g, 0x4f9e35, x + 4, y + 2, 3, 6) }
    } }, puddle: 0x5fb0de, props: ["flower", "flower", "bush", "stone", "mushroom", "gnome", "pond"], title: "Garden", clouds: true),
    .desk: ThemeLook(sky: (0xe8eef5, 0xc3cfdc), groundY: -3, ground: { picture(256, 256) { g in
        rect(g, 0xeee6d8, 0, 0, 256, 256)
        g.setStrokeColor(color(0xddd2c0).cgColor); g.setLineWidth(2)
        for y in stride(from: 8, to: 256, by: 22) { g.move(to: CGPoint(x: 0, y: y)); g.addLine(to: CGPoint(x: 256, y: y + 6)); g.strokePath() }
    } }, puddle: 0x6b3e26, props: ["pencil", "books", "cup", "note", "note", "eraser"], title: "Office Desk"),
    .bathtub: ThemeLook(sky: (0xd9f3fb, 0xa9dcec), groundY: -2.3, ground: { picture(256, 256) { g in
        rect(g, 0x5cc6ef, 0, 0, 256, 256)
        g.setStrokeColor(color(0xa8e6ff).cgColor); g.setLineWidth(5); g.setLineCap(.round)
        for i in 0..<14 {
            let x = CGFloat((i * 71) % 256), y = CGFloat((i * 113) % 256)
            g.move(to: CGPoint(x: x, y: y)); g.addQuadCurve(to: CGPoint(x: x + 28, y: y), control: CGPoint(x: x + 14, y: y - 8)); g.strokePath()
        }
    } }, puddle: 0xd8f4ff, props: ["duck", "foam", "foam", "soap"], water: true, title: "Bathtub"),
]

/// Scenery in the tiles the road does not use: every prop stays inside its tile, clear of the road, the next tile's props
/// and the other prop in its tile.
func placeProps(_ track: Track, _ look: ThemeLook, _ m: @escaping Mats, _ glows: @escaping Glows, _ random: @escaping () -> Double, _ statics: SCNNode, _ live: SCNNode, _ animated: inout [(Double) -> Void]) {
    let key = { (x: Double, z: Double) in "\(Int(x.rounded())),\(Int(z.rounded()))" }
    var used = Set(track.tiles.map { key($0.x, $0.z) })
    let tx = track.tiles.map(\.x), tz = track.tiles.map(\.z)
    var footprints: [String: Double] = [:]
    let footprint = { (kind: String) -> Double in
        if let f = footprints[kind] { return f }
        // any way it's turned, the prop fits in this circle (a data prop knows it)
        if let f = reachOf(kind) { footprints[kind] = f; return f }
        let (lo, hi) = makeProp(kind, m, glows, rng(kind)).boundingBox
        let f = [lo.x, hi.x].flatMap { bx in [lo.z, hi.z].map { bz in Double(hypot(bx, bz)) } }.max()!
        footprints[kind] = f
        return f
    }
    // landmarks first: each in a free tile of its own beside the road, turned to face it (scene.ts does the same)
    let road = used
    let facing = { (x: Double, z: Double) in [(TILE, 0.0), (-TILE, 0), (0, TILE), (0, -TILE)].first { road.contains(key(x + $0.0, z + $0.1)) } }
    var spots: [(x: Double, z: Double)] = []
    if !look.landmarks.isEmpty {
        for x in stride(from: tx.min()! - 2 * TILE, through: tx.max()! + 2 * TILE, by: TILE) {
            for z in stride(from: tz.min()! - 2 * TILE, through: tz.max()! + 2 * TILE, by: TILE) where !road.contains(key(x, z)) && facing(x, z) != nil { spots.append((x, z)) }
        }
    }
    for kind in look.landmarks {
        if spots.isEmpty { break }
        let spot = spots.remove(at: Int(random() * Double(spots.count))), toward = facing(spot.x, spot.z)!
        let prop = group(makeProp(kind, m, glows, random))
        prop.position = SCNVector3(spot.x, look.groundY, spot.z)
        prop.eulerAngles.y = Float(atan2(toward.0, toward.1))
        statics.addChildNode(prop)
        used.insert(key(spot.x, spot.z))
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
                let prop = group(makeProp(kind, m, glows, random))
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
    if look.clouds {
        // a few comic clouds far away
        let xs = track.samples.map(\.x), zs = track.samples.map(\.z), cx = (xs.min()! + xs.max()!) / 2, cz = (zs.min()! + zs.max()!) / 2
        for i in 0..<8 {
            let a = Double(i) / 8 * .pi * 2, d = 170 + random() * 40
            let cloud = group(sph(8, m(0xffffff, true)), sph(6, m(0xffffff, true), 8, -1, 0), sph(6, m(0xffffff, true), -8, -1.5, 0), sph(5, m(0xffffff, true), 3, 4, 0))
            cloud.position = SCNVector3(cx + cos(a) * d, 45 + random() * 20, cz + sin(a) * d)
            cloud.look(at: SCNVector3(cx, Double(cloud.position.y), cz), up: SCNVector3(0, 1, 0), localFront: SCNVector3(0, 0, -1))
            statics.addChildNode(cloud)
        }
    }
}
