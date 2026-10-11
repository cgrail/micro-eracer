import Foundation

// shared/src/track.ts and shared/src/tracks/*.ts. Names match the TypeScript, so a grep finds both sides.

enum Theme: String { case kitchen, garden, desk, bathtub }

/// A Track as authored: pieces laid like a turtle walk on a grid of TILE-sized tiles (see `TrackDef` in track.ts).
struct TrackDef {
    let id: String
    let name: String
    let theme: Theme
    let pieces: String
    let puddles: [Int]
    let items: [Int]
}

/// The same Tracks as shared/src/tracks/*.ts, in the same order (`TrackDataTests` compares them).
let TRACKS: [TrackDef] = [
    TrackDef(id: "kitchen", name: "Kitchen Table", theme: .kitchen,
             pieces: "S S S R* U* S* R* D* S R* L* R L S R* R* S S", puddles: [8], items: [5, 13]),
    TrackDef(id: "garden", name: "Garden", theme: .garden,
             pieces: "S S S S R S R U* R* S* S* S* L* D* S S S L S L S S", puddles: [1, 5, 15, 18], items: [3, 16]),
    TrackDef(id: "desk", name: "Office Desk", theme: .desk,
             pieces: "S S S R* S S R* S J* S* S L R R* L R S S R* S S S", puddles: [10, 17], items: [4, 9, 19]),
    TrackDef(id: "bathtub", name: "Bathtub", theme: .bathtub,
             pieces: "S L* R R* U* R* D* L R* S R L R* R* S S", puddles: [9, 11], items: [0, 7]),
]

/// `y` is the road surface; `kick` marks the ramp of a jump; `bay` is how far the Charging Station widens the road on the right.
struct Sample { var x, y, z, dx, dz: Double; var walls, turn, kick: Bool; var bay: Double }
struct Circle { let x, y, z, r: Double }
struct Pose { var x, y, z, yaw: Double }
/// `idx`: the sample the wall starts at.
struct WallSegment { let x, y, z, yaw, pitch, length: Double; let idx: Int }
/// An Item Box's spot; `idx`: the sample it stands at.
struct BoxSpot { let x, y, z, yaw: Double; let idx: Int }

final class Track {
    let def: TrackDef
    /// Centreline points ~1 m apart; index 0 is the finish line.
    let samples: [Sample]
    let n: Int
    /// Sample index where each piece starts: the Checkpoints, in order.
    let checkpoints: [Int]
    let walls: [WallSegment]
    /// Centre of every tile the road (or the Charging Station beside it) uses, so scenery can avoid them.
    let tiles: [(x: Double, z: Double)]
    let puddles: [Circle]
    var itemBoxes: [BoxSpot] = []

    init(def: TrackDef, samples: [Sample], checkpoints: [Int], walls: [WallSegment], tiles: [(x: Double, z: Double)], puddles: [Circle]) {
        self.def = def; self.samples = samples; n = samples.count; self.checkpoints = checkpoints
        self.walls = walls; self.tiles = tiles; self.puddles = puddles
    }
}

let TILE = 16.0
let HALF_WIDTH = 4.5
/// Below the road under it by this much, an E-Car has fallen off (also off a bridge onto the road below).
let FALL_Y = -2.5
/// Height of a ramp, so a bridge clears the road it crosses.
let RISE = 3.5
private let KICK = 1.2, KICK_LEN = 10, WINDOW = 25
/// How far apart two E-Cars' middles must be for a reset not to land one on the other.
private let CLEAR = 5.0
let BAY_WIDTH = 5.0
/// Speed limit in the Charging Station, times the top speed.
let PIT_SPEED = 0.45
private let BAY_FROM = 30, BAY_TO = 5, BAY_TAPER = 4.0

func sameLevel(_ a: Double, _ b: Double) -> Bool { abs(a - b) < RISE * 0.7 }
func right(_ dx: Double, _ dz: Double) -> (x: Double, z: Double) { (-dz, dx) }
func yawOf(_ dx: Double, _ dz: Double) -> Double { atan2(dx, dz) }
func sq(_ v: Double) -> Double { v * v }
func clamp(_ v: Double, _ lo: Double, _ hi: Double) -> Double { min(hi, max(lo, v)) }

func buildTrack(_ def: TrackDef) -> Track {
    var samples: [Sample] = [], checkpoints: [Int] = [], tiles: [(x: Double, z: Double)] = []
    var px = 0.0, pz = 0.0, dx = 0.0, dz = 1.0, h = 0.0
    let chars = Array(def.pieces)
    var c = 0
    while c < chars.count {
        let kind = chars[c]
        c += 1
        guard "SLRUDJ".contains(kind) else { continue }
        let walls = c < chars.count && chars[c] == "*"
        if walls { c += 1 }
        checkpoints.append(samples.count)
        tiles.append((px + dx * TILE / 2, pz + dz * TILE / 2))
        let turn = kind == "L" || kind == "R"
        if !turn {
            // ramps ease in and out so E-Cars don't scrape; a kicker steepens to its lip, then drops back to the road
            let rise = kind == "U" ? RISE : kind == "D" ? -RISE : 0
            for i in 0..<Int(TILE) {
                let kick = kind == "J" && i < KICK_LEN
                let y = h + rise * (1 - cos(Double.pi * Double(i) / TILE)) / 2 + (kick ? KICK * sq(Double(i) / Double(KICK_LEN - 1)) : 0)
                samples.append(Sample(x: px + dx * Double(i), y: y, z: pz + dz * Double(i), dx: dx, dz: dz, walls: walls, turn: turn, kick: kick, bay: 0))
            }
            px += dx * TILE; pz += dz * TILE; h += rise
        } else {
            let r = TILE / 2
            let side = kind == "R" ? right(dx, dz) : (x: dz, z: -dx)
            let cx = px + side.x * r, cz = pz + side.z * r
            let steps = Int((Double.pi / 2 * r).rounded())
            for i in 0..<steps {
                let a = Double(i) / Double(steps) * (Double.pi / 2), co = cos(a), si = sin(a)
                samples.append(Sample(x: cx - side.x * r * co + dx * r * si, y: h, z: cz - side.z * r * co + dz * r * si,
                                      dx: dx * co + side.x * si, dz: dz * co + side.z * si, walls: walls, turn: turn, kick: false, bay: 0))
            }
            px = cx + dx * r; pz = cz + dz * r; dx = side.x; dz = side.z
        }
    }
    precondition(hypot(px, pz) <= 1e-6 && abs(dz - 1) <= 1e-6 && h == 0, "Track \(def.id) does not close")
    let n = samples.count
    // the bay eases in and out at its ends, so E-Cars can drive in and out anywhere along it
    for i in (n - BAY_FROM)...(n - BAY_TO) {
        samples[i].bay = BAY_WIDTH * min(1, Double(i - (n - BAY_FROM)) / BAY_TAPER, Double(n - BAY_TO - i) / BAY_TAPER)
    }
    for piece in [tiles.count - 2, tiles.count - 1] {
        let s = samples[checkpoints[piece]], r = right(s.dx, s.dz)
        tiles.append((tiles[piece].x + r.x * TILE, tiles[piece].z + r.z * TILE))
    }
    // where the Track meets itself it must pass over, never through: a crossing on one level would be a shortcut
    for i in 0..<n { for j in (i + 1)..<max(i + 1, n) {
        let a = samples[i], b = samples[j]
        precondition(!(min(j - i, n - j + i) > 2 * WINDOW && sq(a.x - b.x) + sq(a.z - b.z) < sq(2 * HALF_WIDTH + 1) && sameLevel(a.y, b.y)),
                     "Track \(def.id) runs into itself at samples \(i) and \(j)")
    } }
    for i in (n - BAY_FROM)...(n - BAY_TO) {
        let s = samples[i], r = right(s.dx, s.dz), bx = s.x + r.x * (HALF_WIDTH + BAY_WIDTH), bz = s.z + r.z * (HALF_WIDTH + BAY_WIDTH)
        precondition(!samples.enumerated().contains { j, o in
            min(abs(i - j), n - abs(i - j)) > 2 * WINDOW && sq(o.x - bx) + sq(o.z - bz) < sq(HALF_WIDTH + 1) && sameLevel(o.y, s.y)
        }, "Track \(def.id) has no room for the Charging Station at sample \(i)")
    }

    var walls: [WallSegment] = []
    for i in 0..<n where samples[i].walls {
        let a = samples[i], b = samples[(i + 1) % n]
        for sign in [-1.0, 1.0] {
            let off = sign * (HALF_WIDTH + 0.2), ra = right(a.dx, a.dz), rb = right(b.dx, b.dz)
            let ax = a.x + ra.x * off, az = a.z + ra.z * off, bx = b.x + rb.x * off, bz = b.z + rb.z * off
            let flat = hypot(bx - ax, bz - az)
            walls.append(WallSegment(x: (ax + bx) / 2, y: (a.y + b.y) / 2, z: (az + bz) / 2, yaw: yawOf(bx - ax, bz - az),
                                     pitch: -atan2(b.y - a.y, flat), length: hypot(flat, b.y - a.y), idx: i))
        }
    }
    let middle = { (piece: Int) in (checkpoints[piece] + (piece + 1 < checkpoints.count ? checkpoints[piece + 1] : n)) / 2 }
    let puddles = def.puddles.map { piece -> Circle in let s = samples[middle(piece)]; return Circle(x: s.x, y: s.y, z: s.z, r: 3.2) }
    let track = Track(def: def, samples: samples, checkpoints: checkpoints, walls: walls, tiles: tiles, puddles: puddles)
    track.itemBoxes = def.items.flatMap { piece in [-2.8, 0, 2.8].map { lateral in
        let p = poseAt(track, middle(piece), lateral)
        return BoxSpot(x: p.x, y: p.y, z: p.z, yaw: p.yaw, idx: middle(piece))
    } }
    return track
}

func inPuddle(_ track: Track, _ x: Double, _ y: Double, _ z: Double) -> Bool {
    track.puddles.contains { sq($0.x - x) + sq($0.z - z) < sq($0.r) && sameLevel($0.y, y) }
}

/// Whether an E-Car at sample `idx` (its progress) is in the Charging Station's bay.
func inStation(_ track: Track, _ idx: Int, _ x: Double, _ z: Double) -> Bool {
    track.samples[idx].bay > 1 && lateralOf(track, idx, x, z) > HALF_WIDTH - 0.5
}

/// Sideways distance of a point from the centreline at sample `idx` (positive = right).
func lateralOf(_ track: Track, _ idx: Int, _ x: Double, _ z: Double) -> Double {
    let s = track.samples[((idx % track.n) + track.n) % track.n], r = right(s.dx, s.dz)
    return (x - s.x) * r.x + (z - s.z) * r.z
}

/// Pose on the centreline at sample `i`, shifted sideways by `lateral` metres (positive = right).
func poseAt(_ track: Track, _ i: Int, _ lateral: Double = 0) -> Pose {
    let s = track.samples[((i % track.n) + track.n) % track.n], r = right(s.dx, s.dz)
    return Pose(x: s.x + r.x * lateral, y: s.y + 0.6, z: s.z + r.z * lateral, yaw: yawOf(s.dx, s.dz))
}

/// Start grid: two columns, rows 5 m apart, all behind the finish line.
func gridPose(_ track: Track, _ slot: Int) -> Pose {
    let row = slot / 2, col = slot % 2
    return poseAt(track, track.n - (3 + row * 5 + col * 2), col == 1 ? 2.2 : -2.2)
}

/// How far an E-Car has come along the Track: `u` counts samples since the finish line and only moves by local steps.
struct Progress { var idx: Int; var u: Int }

func startProgress(_ track: Track, _ idx: Int) -> Progress { Progress(idx: idx, u: idx - track.n) }
func lapOf(_ track: Track, _ p: Progress) -> Int { Int(floor(Double(p.u) / Double(track.n))) + 1 }

/// Returns false (and keeps progress) when the E-Car is off the road, e.g. falling or cutting across.
@discardableResult
func updateProgress(_ track: Track, _ p: inout Progress, _ x: Double, _ z: Double) -> Bool {
    var best = p.idx, bestD = Double.infinity
    for k in -WINDOW...WINDOW {
        let i = (p.idx + k + track.n) % track.n
        let d = sq(track.samples[i].x - x) + sq(track.samples[i].z - z)
        if d < bestD { bestD = d; best = i }
    }
    if bestD > sq(HALF_WIDTH + 1.5 + track.samples[best].bay) { return false }
    var delta = best - p.idx
    if Double(delta) > Double(track.n) / 2 { delta -= track.n }
    if Double(delta) < -Double(track.n) / 2 { delta += track.n }
    p.u += delta
    p.idx = best
    return true
}

/// Moves progress back to the last Checkpoint passed and returns the pose to put the E-Car at.
func resetToCheckpoint(_ track: Track, _ p: inout Progress, _ others: [Vec3] = []) -> Pose {
    var cp = track.checkpoints[0]
    for c in track.checkpoints where c <= p.idx { cp = c }
    p.u -= p.idx - cp
    p.idx = cp
    // never onto another E-Car: across the road, or a little further back (it has to drive past the Checkpoint again)
    guard let spot = freeSpot(track, [cp, cp - 6, cp - 12], others) else { return poseAt(track, cp) }
    p.u -= cp - spot.idx
    p.idx = (spot.idx + track.n) % track.n
    return spot.pose
}

/// The first spot clear of `others` at the given samples, trying the middle of the road and then either side.
func freeSpot(_ track: Track, _ idxs: [Int], _ others: [Vec3]) -> (pose: Pose, idx: Int)? {
    for idx in idxs { for lateral in [0, -2.6, 2.6] {
        let pose = poseAt(track, idx, lateral)
        if others.allSatisfy({ sq($0.x - pose.x) + sq($0.z - pose.z) > sq(CLEAR) || !sameLevel($0.y, pose.y) }) { return (pose, idx) }
    } }
    return nil
}

/// Nearest sample in 3D, so on a bridge it is the bridge and under it the road below.
func nearestSample(_ track: Track, _ x: Double, _ y: Double, _ z: Double) -> Int {
    var best = 0, bestD = Double.infinity
    for (i, s) in track.samples.enumerated() {
        let d = sq(s.x - x) + sq(s.y - y) + sq(s.z - z)
        if d < bestD { bestD = d; best = i }
    }
    return best
}
