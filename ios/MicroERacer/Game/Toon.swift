import SceneKit
import UIKit

// The comic look of client/src/scene.ts in SceneKit: cel shading in three flat tones, black outlines, and textures drawn in code.

func color(_ hex: Int, _ alpha: CGFloat = 1) -> UIColor {
    UIColor(red: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: alpha)
}

/// The outlines' ink.
let INK = UIColor(red: 0.07, green: 0.05, blue: 0.05, alpha: 1)

/// The sun's light in three flat tones (scene.ts `GRADIENT`: 120, 195 and 255 of 255, picked by how much a face turns to it).
private let TOON_LIGHTING = """
float d = dot(_surface.normal, _light.direction);
float band = d < -0.3333 ? 0.47 : (d < 0.3333 ? 0.765 : 1.0);
_lightingContribution.diffuse += _light.intensity.rgb * band;
"""

/// A material without an outline (the road's markings, lamps, glows) is named so `outline(_:)` passes it by.
private let FLAT = "flat"

func toon(_ hex: Int, outline: Bool = true, map: UIImage? = nil, opacity: CGFloat? = nil, doubleSided: Bool = false) -> SCNMaterial {
    let m = SCNMaterial()
    m.lightingModel = .lambert
    m.shaderModifiers = [.lightingModel: TOON_LIGHTING]
    m.diffuse.contents = map ?? color(hex)
    m.isDoubleSided = doubleSided
    if map != nil { m.diffuse.wrapS = .repeat; m.diffuse.wrapT = .repeat }
    if let opacity { m.transparency = opacity; m.writesToDepthBuffer = false; m.blendMode = .alpha }
    if !outline { m.name = FLAT }
    return m
}

/// Unlit, for lamps and glows (three's MeshBasicMaterial), never outlined.
func glow(_ hex: Int, opacity: CGFloat = 1) -> SCNMaterial {
    let m = SCNMaterial()
    m.lightingModel = .constant
    m.diffuse.contents = color(hex)
    m.name = FLAT
    if opacity < 1 { m.transparency = opacity; m.writesToDepthBuffer = false; m.blendMode = .alpha }
    return m
}

/// The inverted hull: the same mesh pushed out along its normals, drawn inside out in ink. `width` in metres; about 4 cm
/// matches the browsers' outlines at the chase camera's distance.
private func hull(_ width: Float) -> SCNMaterial {
    let m = SCNMaterial()
    m.lightingModel = .constant
    m.diffuse.contents = INK
    m.cullMode = .front
    m.shaderModifiers = [.geometry: "_geometry.position.xyz += _geometry.normal * \(width);"]
    return m
}
private let HULLS = (thin: hull(0.045), thick: hull(0.09))

/// Outlines every mesh under `root` whose materials want one. Each costs a second draw call, as `OutlineEffect` does on the web.
func outline(_ root: SCNNode, thick: Bool = false) {
    var meshes: [SCNNode] = []
    root.enumerateHierarchy { node, _ in if node.geometry != nil, node.name != "hull" { meshes.append(node) } }
    for node in meshes {
        guard let g = node.geometry, g.materials.contains(where: { $0.name != FLAT && $0.transparency == 1 }) else { continue }
        let copy = g.copy() as! SCNGeometry
        copy.materials = [thick ? HULLS.thick : HULLS.thin]
        let h = SCNNode(geometry: copy)
        h.name = "hull"
        node.addChildNode(h)
    }
}

func mesh(_ g: SCNGeometry, _ m: SCNMaterial, _ x: Double = 0, _ y: Double = 0, _ z: Double = 0) -> SCNNode {
    g.materials = [m]
    let n = SCNNode(geometry: g)
    n.position = SCNVector3(x, y, z)
    return n
}
func rbox(_ w: Double, _ h: Double, _ d: Double, _ r: Double, _ m: SCNMaterial, _ x: Double = 0, _ y: Double = 0, _ z: Double = 0) -> SCNNode {
    mesh(SCNBox(width: w, height: h, length: d, chamferRadius: min(r, min(w, h, d) / 2)), m, x, y, z)
}
func cyl(_ rt: Double, _ rb: Double, _ h: Double, _ m: SCNMaterial, _ x: Double = 0, _ y: Double = 0, _ z: Double = 0, _ seg: Int = 16) -> SCNNode {
    let g: SCNGeometry
    if rt == rb { let c = SCNCylinder(radius: rt, height: h); c.radialSegmentCount = seg; g = c } else {
        let c = SCNCone(topRadius: rt, bottomRadius: rb, height: h); c.radialSegmentCount = seg; g = c
    }
    return mesh(g, m, x, y, z)
}
func cone(_ r: Double, _ h: Double, _ m: SCNMaterial, _ x: Double = 0, _ y: Double = 0, _ z: Double = 0, _ seg: Int = 12) -> SCNNode { cyl(0, r, h, m, x, y, z, seg) }
func sph(_ r: Double, _ m: SCNMaterial, _ x: Double = 0, _ y: Double = 0, _ z: Double = 0, _ seg: Int = 16) -> SCNNode {
    let s = SCNSphere(radius: r)
    s.segmentCount = seg
    return mesh(s, m, x, y, z)
}
func group(_ children: SCNNode...) -> SCNNode { group(children) }
func group(_ children: [SCNNode]) -> SCNNode {
    let g = SCNNode()
    children.forEach(g.addChildNode)
    return g
}

/// A flat disc lying on the ground, like three's CircleGeometry turned flat.
func disc(_ r: Double, _ m: SCNMaterial, _ x: Double = 0, _ y: Double = 0, _ z: Double = 0) -> SCNNode {
    mesh(SCNCylinder(radius: r, height: 0.001), m, x, y, z)
}

/// three's rotation order 'YXZ': turned to `yaw`, then tilted by `pitch` about its own sideways axis.
func setYawPitch(_ node: SCNNode, yaw: Double, pitch: Double, roll: Double = 0) {
    node.simdOrientation = simd_quatf(angle: Float(yaw), axis: [0, 1, 0]) * simd_quatf(angle: Float(pitch), axis: [1, 0, 0]) * simd_quatf(angle: Float(roll), axis: [0, 0, 1])
}

/// A texture drawn in code (scene.ts `canvasTexture`).
func picture(_ w: Int, _ h: Int, _ draw: (CGContext) -> Void) -> UIImage {
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    return UIGraphicsImageRenderer(size: CGSize(width: w, height: h), format: format).image { draw($0.cgContext) }
}

/// The comic lettering, Bangers, bundled with the app (`Fonts.register`).
func bangers(_ size: CGFloat) -> UIFont { UIFont(name: "Bangers-Regular", size: size) ?? .systemFont(ofSize: size, weight: .black) }

/// Draws `text` centred at (x, y), outlined first when `stroke` is given.
func letter(_ text: String, _ x: CGFloat, _ y: CGFloat, size: CGFloat, fill: UIColor, stroke: (UIColor, CGFloat)? = nil) {
    var attrs: [NSAttributedString.Key: Any] = [.font: bangers(size), .foregroundColor: fill]
    let width = (text as NSString).size(withAttributes: attrs).width
    let at = CGPoint(x: x - width / 2, y: y - size * 0.55)
    if let (ink, w) = stroke {
        var outlined = attrs
        outlined[.strokeColor] = ink
        outlined[.strokeWidth] = w / size * 200
        (text as NSString).draw(at: at, withAttributes: outlined)
    }
    attrs[.foregroundColor] = fill
    (text as NSString).draw(at: at, withAttributes: attrs)
}
