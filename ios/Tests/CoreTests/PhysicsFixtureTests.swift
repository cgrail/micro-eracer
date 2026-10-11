import Foundation
import XCTest
@testable import Core

/// Replays shared/src/physics.fixture.json straight from the TypeScript side (see shared/src/physics.test.ts): the same
/// set-ups have to end up in the same places, or the iPhone drives differently from the browsers and the server.
final class PhysicsFixtureTests: XCTestCase {
    struct CarSetup: Decodable { let body: String; let dynamic: Bool; let pose: P; let vx, vz: Double; let input: I }
    struct P: Decodable { let x, y, z, yaw: Double }
    struct I: Decodable { let throttle, steer: Double; let hold: Bool? }
    struct Scenario: Decodable { let name, track: String; let steps: Int; let cars: [CarSetup]; let trace: [[[Double]]] }
    struct Fixture: Decodable { let every: Int; let fields: [String]; let scenarios: [Scenario] }

    static let fixture = URL(fileURLWithPath: #filePath).appendingPathComponent("../../../../shared/src/physics.fixture.json").standardized

    func testDrivesItsFixtureLikeTheTypeScript() throws {
        let f = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: Self.fixture))
        XCTAssertFalse(f.scenarios.isEmpty)
        for s in f.scenarios {
            let track = buildTrack(TRACKS.first { $0.id == s.track }!), world = createTrackWorld(track)
            let cars = s.cars.map { c -> Car in
                let pose = Pose(x: c.pose.x, y: c.pose.y, z: c.pose.z, yaw: c.pose.yaw)
                let car = createCar(world, BodyKind(rawValue: c.body)!, pose, c.dynamic)
                if c.dynamic { teleport(car, pose, c.vx, c.vz) }
                return car
            }
            for step in 1...s.steps {
                for (k, car) in cars.enumerated() {
                    let c = s.cars[k]
                    if c.dynamic { driveCar(world, car, Input(throttle: c.input.throttle, steer: c.input.steer, hold: c.input.hold ?? false)) } else {
                        setKinematicPose(car, Pose(x: c.pose.x + c.vx * Double(step) * DT, y: c.pose.y, z: c.pose.z + c.vz * Double(step) * DT, yaw: c.pose.yaw))
                    }
                }
                world.step()
                guard step % f.every == 0 else { continue }
                for (k, car) in cars.enumerated() {
                    let rb = car.rb, got = [rb.x, rb.y, rb.z, rb.yaw, rb.vx, rb.vy, rb.vz], want = s.trace[step / f.every - 1][k]
                    for j in got.indices {
                        let off = j == 3 ? abs(angleDiff(want[j], got[j])) : abs(got[j] - want[j])
                        XCTAssertLessThanOrEqual(off, 1e-3, "\(s.name): car \(k) after \(step) steps has \(f.fields[j]) \(got[j]), the fixture \(want[j])")
                    }
                }
            }
        }
    }
}
