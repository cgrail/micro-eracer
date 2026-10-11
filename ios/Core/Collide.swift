import Foundation

// shared/src/collide.ts: where bodies touch the Track and each other, for Physics.swift.

/// A body as the collision tests see it; `idx` is the sample it is over.
protocol Box: AnyObject { var x: Double { get }; var y: Double { get }; var z: Double { get }; var yaw: Double { get }; var half: Vec3 { get }; var idx: Int { get } }

/// The road under a point: its height, and its slope `grade` along the Track's direction (`dx`, `dz`) there.
struct Road { let y, grade, dx, dz: Double }

/// How two things meet: `sep` apart (negative: overlapping) along `n`, which points from the first to the second; `p` is where.
struct Meeting { let sep, nx, ny, nz, px, pz: Double }

/// A stretch of a wall's face towards the road (see `Wall` in collide.ts).
struct Wall { let x, y, z, ux, uz, nx, nz, half, slope: Double }

/// Road this far above a body's underside is road it is under, not on (the far side of a jump's drop, say).
private let UNDER = 0.9
/// A wall's height, and half its thickness.
private let WALL_HEIGHT = 1.0, WALL_HALF = 0.2
/// Where under a body the road can hold it up, in halves of its length and width.
private let FEET: [(a: Double, l: Double)] = [-1, -0.5, 0, 0.5, 1].flatMap { a in [-1.0, 0, 1].map { l in (a, l) } }

/// Nearest sample to (x, z) within `reach` of sample `near`: never one on another level, which is always further along.
func nearestBy(_ track: Track, _ near: Int, _ x: Double, _ z: Double, _ reach: Int) -> Int {
    var best = near, bestD = Double.infinity
    for k in -reach...reach {
        let i = (near + k + track.n) % track.n, s = track.samples[i], d = sq(s.x - x) + sq(s.z - z)
        if d < bestD { bestD = d; best = i }
    }
    return best
}

/// The road at (x, z) near sample `near`, or nil if (x, z) is off it.
func roadAt(_ track: Track, _ near: Int, _ x: Double, _ z: Double) -> Road? {
    let samples = track.samples, n = track.n, best = nearestBy(track, near, x, z, 6)
    let s = samples[best], r = right(s.dx, s.dz), lateral = (x - s.x) * r.x + (z - s.z) * r.z
    if lateral < -HALF_WIDTH || lateral > HALF_WIDTH + s.bay { return nil }
    // between this sample and the next one along, or the one before
    let along = (x - s.x) * s.dx + (z - s.z) * s.dz, o = samples[(best + (along >= 0 ? 1 : n - 1)) % n]
    let dist = hypot(o.x - s.x, o.z - s.z)
    let grade = (along >= 0 ? o.y - s.y : s.y - o.y) / (dist == 0 ? 1 : dist)
    return Road(y: s.y + grade * along, grade: grade, dx: s.dx, dz: s.dz)
}

/// The highest road under a body's underside, that it rests on or will land on; nil with no road under it.
func roadUnder(_ track: Track, _ b: Box) -> Road? {
    let fx = sin(b.yaw), fz = cos(b.yaw), r = right(fx, fz), bottom = b.y - b.half.y
    var best: Road?
    for f in FEET {
        if let road = roadAt(track, b.idx, b.x + fx * f.a * b.half.z + r.x * f.l * b.half.x, b.z + fz * f.a * b.half.z + r.z * f.l * b.half.x),
           road.y - bottom < UNDER, best == nil || road.y > best!.y { best = road }
    }
    return best
}

/// A body's corners in the ground plane.
private func corners(_ b: Box) -> [(x: Double, z: Double)] {
    let fx = sin(b.yaw), fz = cos(b.yaw), sx = -fz, sz = fx
    return [(1.0, 1.0), (1, -1), (-1, 1), (-1, -1)].map { f, s in
        (b.x + fx * f * b.half.z + sx * s * b.half.x, b.z + fz * f * b.half.z + sz * s * b.half.x)
    }
}

/// The middle of the corners that reach deepest by `depth`, and how deep that is.
private func deepest(_ cs: [(x: Double, z: Double)], _ depth: ((x: Double, z: Double)) -> Double) -> (least: Double, x: Double, z: Double) {
    let least = cs.map(depth).min()!, deep = cs.filter { depth($0) < least + 0.05 }
    return (least, deep.reduce(0) { $0 + $1.x } / Double(deep.count), deep.reduce(0) { $0 + $1.z } / Double(deep.count))
}

/// Separating axis test of two bodies on their sides and the vertical: the axis they are furthest apart on (or overlap least).
func meet(_ a: Box, _ b: Box) -> Meeting {
    func radius(_ o: Box, _ x: Double, _ z: Double) -> Double {
        o.half.z * abs(sin(o.yaw) * x + cos(o.yaw) * z) + o.half.x * abs(-cos(o.yaw) * x + sin(o.yaw) * z)
    }
    let dx = b.x - a.x, dz = b.z - a.z, dy = b.y - a.y
    var sep = abs(dy) - a.half.y - b.half.y, nx = 0.0, ny = dy < 0 ? -1.0 : 1, nz = 0.0, ref: Box?
    for o in [a, b] { for (x, z) in [(sin(o.yaw), cos(o.yaw)), (-cos(o.yaw), sin(o.yaw))] {
        let d = dx * x + dz * z, s = abs(d) - radius(a, x, z) - radius(b, x, z)
        if s > sep { sep = s; ref = o; nx = d < 0 ? -x : x; ny = 0; nz = d < 0 ? -z : z }
    } }
    guard let ref else { return Meeting(sep: sep, nx: nx, ny: ny, nz: nz, px: (a.x + b.x) / 2, pz: (a.z + b.z) / 2) }
    // a side of `ref` against the corners of the other body that reach furthest towards it, kept within that side
    let sign = ref === a ? 1.0 : -1
    let p = deepest(corners(ref === a ? b : a)) { sign * (($0.x - ref.x) * nx + ($0.z - ref.z) * nz) }
    let tx = -nz, tz = nx, along = (p.x - ref.x) * tx + (p.z - ref.z) * tz, room = radius(ref, tx, tz)
    let over = along - max(-room, min(room, along))
    return Meeting(sep: sep, nx: nx, ny: ny, nz: nz, px: p.x - tx * over, pz: p.z - tz * over)
}

/// The faces of the Track's walls, by the sample they start at.
func wallFaces(_ track: Track) -> [[Wall]] {
    var faces: [[Wall]] = Array(repeating: [], count: track.n)
    for w in track.walls {
        let s = track.samples[w.idx], r = right(s.dx, s.dz), ux = sin(w.yaw), uz = cos(w.yaw), u = right(ux, uz)
        // facing away from the side of the road it stands on
        let side = (w.x - s.x) * r.x + (w.z - s.z) * r.z > 0 ? -1.0 : 1, nx = side * u.x, nz = side * u.z
        faces[w.idx].append(Wall(x: w.x + nx * WALL_HALF, y: w.y, z: w.z + nz * WALL_HALF, ux: ux, uz: uz, nx: nx, nz: nz,
                                 half: cos(w.pitch) * w.length / 2 + 0.05, slope: -tan(w.pitch)))
    }
    return faces
}

/// How far a body's corners are in front of a wall (negative: into it); nil when none is level with the wall.
func wallMeet(_ w: Wall, _ b: Box) -> Meeting? {
    let near = corners(b).filter { c in
        let along = (c.x - w.x) * w.ux + (c.z - w.z) * w.uz, road = w.y + w.slope * along
        // a corner a metre behind the face is beyond the wall, not in it
        return abs(along) <= w.half && b.y - b.half.y < road + WALL_HEIGHT && b.y + b.half.y > road && (c.x - w.x) * w.nx + (c.z - w.z) * w.nz > -1
    }
    if near.isEmpty { return nil }
    let p = deepest(near) { ($0.x - w.x) * w.nx + ($0.z - w.z) * w.nz }
    return Meeting(sep: p.least, nx: w.nx, ny: 0, nz: w.nz, px: p.x, pz: p.z)
}
