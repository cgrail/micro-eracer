import Foundation

// shared/src/car.ts: the Bodies, and how an E-Car drives.

enum BodyKind: String, CaseIterable { case roadster, suv, microbus, pickup, semi }
let BODY_KINDS = BodyKind.allCases

struct BodySpec { let maxSpeed, accel, steer, mass, grip, tank, length: Double }

/// How each Body drives, from the quick Roadster to the slow Semi (see `BODIES` in car.ts).
let BODIES: [BodyKind: BodySpec] = [
    .roadster: BodySpec(maxSpeed: 22, accel: 26, steer: 2.7, mass: 1, grip: 8, tank: 1, length: 1.8),
    .suv: BodySpec(maxSpeed: 20.7, accel: 21, steer: 2.5, mass: 1.5, grip: 10, tank: 1.1, length: 1.9),
    .microbus: BodySpec(maxSpeed: 19.3, accel: 16, steer: 2.1, mass: 2.2, grip: 12, tank: 1.3, length: 1.8),
    .pickup: BodySpec(maxSpeed: 19.2, accel: 20, steer: 2.1, mass: 2.4, grip: 10, tank: 1.35, length: 2.1),
    .semi: BodySpec(maxSpeed: 19, accel: 14, steer: 1.9, mass: 3.4, grip: 13, tank: 1.7, length: 2.4),
]
extension BodyKind { var spec: BodySpec { BODIES[self]! } }

/// Half width and height of every body; the length is per Body.
let HALF = (x: 0.9, y: 0.45)
private let BRAKE = 30.0, REVERSE_MAX = 6.0, DRIFT_IN = 4.0, DRIFT_OUT = 2.5

/// `hold`: brake to a halt and then stay put, even on a ramp (Stranded or being Recharged).
struct Input { var throttle: Double; var steer: Double; var hold = false }
let NO_INPUT = Input(throttle: 0, steer: 0)
/// How an E-Car out of Energy stops where it ran dry: hard braking, then held still.
let HALT = Input(throttle: 0, steer: 0, hold: true)

/// `spin`: yaw rate of a spin-out after a Hit or Ram, fading away. `slide`: seconds left of a skid after being Rammed.
final class Car {
    let rb: RigidBody
    let kind: BodyKind
    var drifting = false, spin = 0.0, slide = 0.0
    init(rb: RigidBody, kind: BodyKind) { self.rb = rb; self.kind = kind }
}

func createTrackWorld(_ track: Track) -> World { World(track) }

/// Dynamic for the E-Car this side simulates, kinematic for E-Cars driven elsewhere.
func createCar(_ world: World, _ kind: BodyKind, _ pose: Pose, _ dynamic: Bool) -> Car {
    Car(rb: world.add(RigidBody(half: Vec3(x: HALF.x, y: HALF.y, z: kind.spec.length), mass: kind.spec.mass, dynamic: dynamic, pose: pose)), kind: kind)
}

func teleport(_ car: Car, _ pose: Pose, _ vx: Double = 0, _ vz: Double = 0) {
    car.rb.setPose(pose)
    car.rb.linvel = Vec3(x: vx, y: 0, z: vz)
    car.rb.yawRate = 0
}

/// Moves a kinematic E-Car; big jumps (Fall-off reset, new Race) teleport so they don't smash anything in between.
func setKinematicPose(_ car: Car, _ pose: Pose) {
    let rb = car.rb
    if (sq(rb.x - pose.x) + sq(rb.y - pose.y) + sq(rb.z - pose.z)).squareRoot() > 5 { rb.setPose(pose) } else { rb.moveTo(pose) }
}

let MAX_ENERGY = 100.0
private let LIMP_BELOW = 25.0
/// Limp Mode: below a quarter of the Energy, top speed falls gradually to half at empty.
func limpScale(_ energy: Double) -> Double { energy >= LIMP_BELOW ? 1 : 0.5 + 0.5 * max(0, energy) / LIMP_BELOW }

private func sign(_ v: Double) -> Double { v > 0 ? 1 : v < 0 ? -1 : 0 }

/// Arcade driving: we own the velocity in the car's plane; the physics does gravity and collisions. `wet` = in a Puddle.
func driveCar(_ world: World, _ car: Car, _ input: Input, _ speedScale: Double = 1, _ wet: Bool = false) {
    // only the road counts as ground: on another E-Car's roof it can't drive, and gets put down beside it (`unstack`)
    if !world.onRoad(car.rb, HALF.y + 0.9) { return }
    handleCar(car, input, speedScale, wet)
}

/// How the E-Car handles on the ground: speed, grip, Drifts and spins. The Practice Ground, flat everywhere, needs only this.
func handleCar(_ car: Car, _ input: Input, _ speedScale: Double = 1, _ wet: Bool = false) {
    let rb = car.rb
    let p = car.kind.spec, maxSpeed = p.maxSpeed * speedScale
    let fx = sin(rb.yaw), fz = cos(rb.yaw), r = right(fx, fz)
    let v = rb.linvel
    var fs = v.x * fx + v.z * fz, ls = v.x * r.x + v.z * r.z

    // held: brake either way until nearly stopped, then stand still (gravity would roll it off a slope)
    if input.hold { fs = abs(fs) < 1 ? 0 : fs - sign(fs) * BRAKE * DT; ls = abs(ls) < 1 ? 0 : ls } else if input.throttle > 0 { if fs < maxSpeed { fs += p.accel * input.throttle * DT } } else if input.throttle < 0 { fs += (fs > 0.5 ? BRAKE : p.accel * 0.5) * input.throttle * DT } else { fs *= 1 - 0.8 * DT }
    if wet { fs *= 1 - 1.2 * DT }
    fs = clamp(fs, -REVERSE_MAX, max(maxSpeed, fs - 10 * DT))

    car.drifting = abs(ls) > (car.drifting ? DRIFT_OUT : DRIFT_IN)
    let spinning = abs(car.spin) > 0.3
    car.slide = max(0, car.slide - DT)
    ls *= max(0, 1 - p.grip * (car.slide > 0 ? 0.25 : car.drifting || spinning ? 0.5 : 1) * (wet ? 0.5 : 1) * DT)
    // a Drift rotates the car faster; pushing on the throttle it turns a little even standing still, to get off a wall
    let turning = input.throttle > 0 ? max(0.3, clamp(fs / 8, -1, 1)) : clamp(fs / 8, -1, 1)
    var yawRate = -input.steer * p.steer * (car.drifting ? 1.3 : 1) * turning
    if spinning { yawRate = car.spin; car.spin *= 1 - 1.8 * DT; fs *= 1 - 1.5 * DT } else { car.spin = 0 }

    rb.linvel = Vec3(x: fx * fs + r.x * ls, y: v.y, z: fz * fs + r.z * ls)
    rb.yawRate = yawRate
}
