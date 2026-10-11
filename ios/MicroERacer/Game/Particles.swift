import SceneKit
import UIKit

/// One draw call of round, fading, growing particles: water splashes, drift smoke, sparks (client/src/effects.ts). The
/// quads are rebuilt every frame, turned to face the camera.
final class Particles {
    let node = SCNNode()
    private let capacity: Int, gravity: Float, grow: Float
    private var pos: [SIMD3<Float>], vel: [SIMD3<Float>], life: [Float], maxLife: [Float], size: [Float]
    private var next = 0
    private let material = SCNMaterial()

    init(_ hex: Int, _ capacity: Int = 400, gravity: Float = -18, grow: Float = 0) {
        self.capacity = capacity; self.gravity = gravity; self.grow = grow
        pos = Array(repeating: .zero, count: capacity); vel = pos
        life = Array(repeating: 0, count: capacity); maxLife = Array(repeating: 1, count: capacity); size = life
        material.lightingModel = .constant
        material.diffuse.contents = Particles.dot(color(hex))
        material.writesToDepthBuffer = false
        material.blendMode = .alpha
        material.isDoubleSided = true
        node.renderingOrder = 5
    }

    /// A round dot with a darker rim (effects.ts' fragment shader).
    private static func dot(_ c: UIColor) -> UIImage {
        picture(64, 64) { g in
            g.setFillColor(UIColor(white: 0.1, alpha: 1).cgColor)
            g.fillEllipse(in: CGRect(x: 0, y: 0, width: 64, height: 64))
            var r: CGFloat = 0, gr: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
            c.getRed(&r, green: &gr, blue: &b, alpha: &a)
            g.setFillColor(UIColor(red: r * 0.4 + 0.06, green: gr * 0.4 + 0.06, blue: b * 0.4 + 0.06, alpha: 1).cgColor)
            g.fillEllipse(in: CGRect(x: 1, y: 1, width: 62, height: 62))
            g.setFillColor(c.cgColor)
            g.fillEllipse(in: CGRect(x: 8, y: 8, width: 48, height: 48))
        }
    }

    func emit(_ x: Double, _ y: Double, _ z: Double, _ vx: Double, _ vy: Double, _ vz: Double, _ size: Double, _ life: Double) {
        let i = next
        next = (next + 1) % capacity
        pos[i] = SIMD3(Float(x), Float(y), Float(z))
        vel[i] = SIMD3(Float(vx), Float(vy), Float(vz))
        self.life[i] = Float(life); maxLife[i] = Float(life)
        self.size[i] = Float(size)
    }

    /// `right` and `up`: the camera's, so every particle faces it.
    func update(_ dt: Float, right: SIMD3<Float>, up: SIMD3<Float>) {
        var verts: [SCNVector3] = [], uvs: [CGPoint] = [], colors: [SIMD4<Float>] = [], index: [Int32] = []
        for i in 0..<capacity where life[i] > 0 {
            life[i] -= dt
            vel[i].y += gravity * dt
            pos[i] += vel[i] * dt
            size[i] += grow * dt
            let alpha = max(0, life[i] / maxLife[i]) * 0.9, h = size[i] / 2, k = Int32(verts.count)
            for (sx, sy) in [(-1, -1), (1, -1), (1, 1), (-1, 1)] as [(Float, Float)] {
                verts.append(SCNVector3(pos[i] + right * (sx * h) + up * (sy * h)))
                uvs.append(CGPoint(x: CGFloat(sx + 1) / 2, y: CGFloat(1 - sy) / 2))
                colors.append(SIMD4(1, 1, 1, alpha))
            }
            index += [k, k + 1, k + 2, k, k + 2, k + 3]
        }
        guard !index.isEmpty else { node.geometry = nil; return }
        let colorData = colors.withUnsafeBufferPointer { Data(buffer: $0) }
        let colorSource = SCNGeometrySource(data: colorData, semantic: .color, vectorCount: colors.count, usesFloatComponents: true,
                                            componentsPerVector: 4, bytesPerComponent: 4, dataOffset: 0, dataStride: 16)
        let g = SCNGeometry(sources: [SCNGeometrySource(vertices: verts), SCNGeometrySource(textureCoordinates: uvs), colorSource],
                            elements: [SCNGeometryElement(indices: index, primitiveType: .triangles)])
        g.materials = [material]
        node.geometry = g
    }
}
