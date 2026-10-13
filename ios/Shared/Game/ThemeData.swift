import SceneKit
import UIKit

// The themes the web writes as data (client/src/themes/: every theme but the first four), read from Themes.json, which
// `npx tsx ios/themes.ts` writes from them. props.ts builds the same parts in the browsers.

/// Themes.json, parsed once: `themes` by id, `props` by name and each Track's staging by its id.
private let DATA: (themes: [String: [String: Any]], props: [String: [String: Any]], tracks: [String: [String: Any]]) = {
    guard let url = Bundle.main.url(forResource: "Themes", withExtension: "json"), let data = try? Data(contentsOf: url),
          let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return ([:], [:], [:]) }
    return (json["themes"] as? [String: [String: Any]] ?? [:], json["props"] as? [String: [String: Any]] ?? [:], json["tracks"] as? [String: [String: Any]] ?? [:])
}()

private func num(_ v: Any?) -> Double { (v as? NSNumber)?.doubleValue ?? 0 }
private func nums(_ v: Any?) -> [Double]? { (v as? [Any])?.map { num($0) } }

/// A data theme's ground tile, drawn as props.ts `paint` draws it (256 × 256, top down).
private func paint(_ g: CGContext, _ ops: [[String: Any]]) {
    g.setLineCap(.round)
    for p in ops {
        if let fill = p["fill"] {
            g.setFillColor(color(Int(num(fill))).cgColor)
            g.fill(CGRect(x: 0, y: 0, width: 256, height: 256))
            continue
        }
        let c = color(Int(num(p["c"]))).cgColor
        g.setFillColor(c)
        g.setStrokeColor(c)
        g.setLineWidth(CGFloat(num(p["w"])))
        if let r = nums(p["rect"]), r.count == 4 {
            g.fill(CGRect(x: r[0], y: r[1], width: r[2], height: r[3]))
        } else if let l = nums(p["line"]), l.count == 4 {
            g.move(to: CGPoint(x: l[0], y: l[1]))
            g.addLine(to: CGPoint(x: l[2], y: l[3]))
            g.strokePath()
        } else if let d = nums(p["dot"]), d.count == 3 {
            g.fillEllipse(in: CGRect(x: d[0] - d[2], y: d[1] - d[2], width: 2 * d[2], height: 2 * d[2]))
        } else if let d = nums(p["ring"]), d.count == 3 {
            g.strokeEllipse(in: CGRect(x: d[0] - d[2], y: d[1] - d[2], width: 2 * d[2], height: 2 * d[2]))
        } else if let q = nums(p["poly"]), q.count >= 6 {
            g.move(to: CGPoint(x: q[0], y: q[1]))
            for i in stride(from: 2, to: q.count - 1, by: 2) { g.addLine(to: CGPoint(x: q[i], y: q[i + 1])) }
            g.closePath()
            g.fillPath()
        }
    }
}

private let DATA_LOOKS: [String: ThemeLook] = DATA.themes.mapValues { t in
    let sky = nums(t["sky"]) ?? [0, 0], ops = t["ground"] as? [[String: Any]] ?? []
    return ThemeLook(sky: (Int(sky[0]), Int(sky[1])), groundY: -3, ground: { picture(256, 256) { paint($0, ops) } }, puddle: Int(num(t["puddle"])),
                     props: t["props"] as? [String] ?? [], title: t["title"] as? String ?? "", landmarks: t["landmarks"] as? [String] ?? [],
                     clouds: t["clouds"] as? Bool ?? false)
}

/// The look of any theme: the first four from Props.swift, the rest from Themes.json.
func themeLook(_ theme: Theme) -> ThemeLook { THEMES[theme] ?? DATA_LOOKS[theme.rawValue] ?? THEMES[.kitchen]! }

/// Unlit materials (screens, neon, lamps) per colour, as `glow` makes them.
typealias Glows = (_ hex: Int) -> SCNMaterial

/// Triangles with a flat normal each (no corner shared between them), for the cel look.
private func faces(_ tris: [[SIMD3<Float>]]) -> SCNGeometry {
    let pos = tris.flatMap { $0 }
    return geometry(pos, (0..<Int32(pos.count)).map { $0 })
}

/// A roof: a triangle of base w and height h in the xy plane, drawn out d along z (props.ts `wedge`).
private func wedgeGeometry(_ w: Double, _ h: Double, _ d: Double) -> SCNGeometry {
    let x = Float(w / 2), y = Float(h / 2), z = Float(d / 2)
    let a = SIMD2<Float>(-x, -y), b = SIMD2<Float>(x, -y), c = SIMD2<Float>(0, y)
    func v(_ p: SIMD2<Float>, _ s: Float) -> SIMD3<Float> { SIMD3(p.x, p.y, s * z) }
    return faces([
        [v(a, 1), v(b, 1), v(c, 1)], [v(a, -1), v(c, -1), v(b, -1)],
        [v(a, 1), v(a, -1), v(b, -1)], [v(a, 1), v(b, -1), v(b, 1)],
        [v(a, 1), v(c, 1), v(c, -1)], [v(a, 1), v(c, -1), v(a, -1)],
        [v(b, 1), v(b, -1), v(c, -1)], [v(b, 1), v(c, -1), v(c, 1)],
    ])
}

/// A pyramid on a w × d base, h tall (props.ts `pyramid`).
private func pyramidGeometry(_ w: Double, _ h: Double, _ d: Double) -> SCNGeometry {
    let x = Float(w / 2), y = Float(h / 2), z = Float(d / 2)
    let p1 = SIMD3<Float>(-x, -y, -z), p2 = SIMD3<Float>(x, -y, -z), p3 = SIMD3<Float>(x, -y, z), p4 = SIMD3<Float>(-x, -y, z), top = SIMD3<Float>(0, y, 0)
    return faces([[p4, p3, top], [p3, p2, top], [p2, p1, top], [p1, p4, top], [p1, p2, p3], [p1, p3, p4]])
}

/// A sign's face: its text in Bangers in `ink` on its colour, filling the board (props.ts `lettering`).
private func lettering(_ text: String, _ w: Double, _ h: Double, _ bg: Int, _ ink: Int) -> UIImage {
    let (tw, th) = w >= h ? (512, max(32, Int((512 * h / w).rounded()))) : (max(32, Int((512 * w / h).rounded())), 512)
    let size = min(CGFloat(th) * 0.72, CGFloat(tw) / (CGFloat(text.count) * 0.5))
    return picture(tw, th) { g in
        g.setFillColor(color(bg).cgColor)
        g.fill(CGRect(x: 0, y: 0, width: tw, height: th))
        letter(text, CGFloat(tw) / 2, CGFloat(th) * 0.55, size: size, fill: color(ink))
    }
}

/// Each sign's face, shared by every sign alike, so a street of phone boxes doesn't cost a draw call each.
private var signFaces: [String: SCNMaterial] = [:]

/// Builds a data prop, part by part as props.ts `buildProp` does; `r` picks its colour first, as there. Small balls, thin
/// cylinders and rings get fewer segments, as there, so a theme full of them stays light.
private func buildProp(_ def: [String: Any], _ m: @escaping Mats, _ glows: @escaping Glows, _ r: @escaping () -> Double) -> SCNNode {
    let pick = nums(def["pick"]) ?? []
    let picked = pick.isEmpty ? 0 : Int(pick[Int(r() * Double(pick.count))])
    func build(_ p: [String: Any]) -> SCNNode {
        let node: SCNNode
        if let parts = p["parts"] as? [[String: Any]] {
            node = group(parts.map(build))
        } else {
            let c = (p["c"] as? String) == "pick" ? picked : Int(num(p["c"]))
            let mat = p["glow"] != nil ? glows(c) : m(c, p["flat"] == nil)
            if let s = nums(p["box"]) {
                node = rbox(s[0], s[1], s[2], num(p["r"]), mat)
            } else if let s = nums(p["cyl"]) {
                node = cyl(s[0], s[1], s[2], mat, 0, 0, 0, p["seg"] != nil ? Int(num(p["seg"])) : max(s[0], s[1]) < 0.3 ? 8 : 16)
            } else if p["ball"] != nil {
                let radius = num(p["ball"])
                node = sph(radius, mat, 0, 0, 0, radius < 0.5 ? 8 : radius < 1.5 ? 12 : 16)
            } else if p["dome"] != nil {
                node = dome(num(p["dome"]), mat)
            } else if let t = nums(p["torus"]) {
                // SceneKit's ring lies flat; the data's stands upright in the xy plane, as three's does
                let torus = SCNTorus(ringRadius: t[0], pipeRadius: t[1])
                torus.ringSegmentCount = 16
                torus.pipeSegmentCount = 6
                let ring = mesh(torus, mat)
                ring.eulerAngles.x = .pi / 2
                node = group(ring)
            } else if let s = nums(p["wedge"]) {
                node = mesh(wedgeGeometry(s[0], s[1], s[2]), mat)
            } else if let s = nums(p["pyramid"]) {
                node = mesh(pyramidGeometry(s[0], s[1], s[2]), mat)
            } else if let s = nums(p["sign"]) {
                let text = p["text"] as? String ?? "", ink = Int(num(p["ink"])), key = "\(text),\(s[0]),\(s[1]),\(c),\(ink),\(p["flat"] == nil)"
                let face = signFaces[key] ?? {
                    let made = toon(0xffffff, outline: p["flat"] == nil, map: lettering(text, s[0], s[1], c, ink))
                    made.diffuse.wrapS = .clamp
                    made.diffuse.wrapT = .clamp
                    signFaces[key] = made
                    return made
                }()
                node = mesh(SCNBox(width: s[0], height: s[1], length: s[2], chamferRadius: 0), face)
            } else {
                node = SCNNode()
            }
        }
        // placed like three places an object: moved, turned about x, then y, then z (its Euler order), and sized
        if let at = nums(p["at"]) { node.simdPosition = SIMD3(Float(at[0]), Float(at[1]), Float(at[2])) }
        if let rot = nums(p["rot"]) {
            node.simdOrientation = simd_quatf(angle: Float(rot[0]), axis: [1, 0, 0]) * simd_quatf(angle: Float(rot[1]), axis: [0, 1, 0]) * simd_quatf(angle: Float(rot[2]), axis: [0, 0, 1])
        }
        if let scale = nums(p["scale"]) { node.simdScale = SIMD3(Float(scale[0]), Float(scale[1]), Float(scale[2])) }
        return node
    }
    return group((def["parts"] as? [[String: Any]] ?? []).map(build))
}

/// A prop of any theme, by name: from Props.swift, or built from Themes.json.
func makeProp(_ kind: String, _ m: @escaping Mats, _ glows: @escaping Glows, _ r: @escaping () -> Double) -> SCNNode {
    if let maker = PROPS[kind] { return maker(m, r) }
    if let def = DATA.props[kind] { return buildProp(def, m, glows, r) }
    return SCNNode()
}

/// How far a data prop reaches from its middle, any way it's turned (the same number the browsers use).
func reachOf(_ kind: String) -> Double? { DATA.props[kind].map { num($0["reach"]) } }

/// Where client/src/themes/staging.ts put a Track's river, bridge and landmarks; worked out there, only read here.
struct Staging {
    /// The middles of the tiles small props leave alone.
    let blocked: [(x: Double, z: Double)]
    let landmarks: [(kind: String, x: Double, z: Double, yaw: Double, scale: Double)]
    /// The river, its bridge, piers and hills, as parts in the Track's own coordinates.
    let parts: [[String: Any]]
    /// The bridge's samples, whose walls are its railings in `rail` and which stand on its own piers instead of pillars.
    let bridge: (from: Int, to: Int, rail: Int)?
    /// For the Track's picture: a point on the water's middle line, the line's direction, its width and colour.
    let river: (x: Double, z: Double, dx: Double, dz: Double, width: Double, color: Int)?
}

private var stagings: [String: Staging] = [:]
/// A Track's staging, if its theme is data (none for the first four themes).
func stagingOf(_ def: TrackDef) -> Staging? {
    // worked out for the Tracks this app came with: a layout the server changed, or a Track only it has, gets none, so
    // nothing of it stands on the road
    guard TRACKS.contains(def) else { return nil }
    let id = def.id
    if let s = stagings[id] { return s }
    guard let t = DATA.tracks[id] else { return nil }
    let landmarks = (t["landmarks"] as? [[String: Any]] ?? []).map { l in
        (kind: l["kind"] as? String ?? "", x: num(l["x"]), z: num(l["z"]), yaw: num(l["yaw"]), scale: l["scale"] != nil ? num(l["scale"]) : 1)
    }
    let bridge = (t["bridge"] as? [String: Any]).map { b in (from: Int(num(b["from"])), to: Int(num(b["to"])), rail: Int(num(b["rail"]))) }
    let river = (t["river"] as? [String: Any]).map { r in (x: num(r["x"]), z: num(r["z"]), dx: num(r["dx"]), dz: num(r["dz"]), width: num(r["width"]), color: Int(num(r["color"]))) }
    let staging = Staging(blocked: (t["blocked"] as? [Any] ?? []).compactMap { nums($0) }.filter { $0.count == 2 }.map { (x: $0[0], z: $0[1]) },
                          landmarks: landmarks, parts: t["parts"] as? [[String: Any]] ?? [], bridge: bridge, river: river)
    stagings[id] = staging
    return staging
}

/// One part of a Track's staging, built (it picks no colours, so it needs no random numbers).
func stagingPart(_ part: [String: Any], _ m: @escaping Mats, _ glows: @escaping Glows) -> SCNNode { buildProp(["parts": [part]], m, glows, { 0 }) }
