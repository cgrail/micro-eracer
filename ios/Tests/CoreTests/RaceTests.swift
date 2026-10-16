import Foundation
import XCTest
@testable import Core

/// The Swift port of the Race against shared/src: the same Track data, and Bots that finish a headless Race on every Track
/// (as `race.test.ts` checks for the TypeScript).
final class RaceTests: XCTestCase {
    static let tracks = URL(fileURLWithPath: #filePath).appendingPathComponent("../../../../shared/src/tracks").standardized

    /// Track data is copied by hand into Track.swift; this reads shared/src/tracks/*.ts and fails when the copies drift apart.
    func testTracksMatchTheTypeScript() throws {
        let files = try FileManager.default.contentsOfDirectory(at: Self.tracks, includingPropertiesForKeys: nil).filter { $0.pathExtension == "ts" }
        XCTAssertEqual(files.count, TRACKS.count, "a Track was added or removed in shared/src/tracks: mirror it in Track.swift")
        for file in files {
            let text = try String(contentsOf: file, encoding: .utf8)
            func field(_ key: String) -> String? {
                guard let r = text.range(of: "\(key): ['\\[]([^'\\]]*)", options: .regularExpression) else { return nil }
                return String(text[r]).replacingOccurrences(of: "^\(key): ['\\[]", with: "", options: .regularExpression)
            }
            guard let id = field("id"), let def = TRACKS.first(where: { $0.id == id }) else { return XCTFail("\(file.lastPathComponent) has no Swift copy") }
            XCTAssertEqual(field("name"), def.name, id)
            XCTAssertEqual(field("theme"), def.theme.rawValue, id)
            XCTAssertEqual(field("pieces"), def.pieces, id)
            XCTAssertEqual(field("puddles"), def.puddles.map(String.init).joined(separator: ", "), id)
            XCTAssertEqual(field("items"), def.items.map(String.init).joined(separator: ", "), id)
        }
    }

    func testTheTallyCountsTheWinsOfTheLast20Minutes() {
        let sim = RaceSim(trackId: TRACKS[0].id)
        var t = 0.0
        while t < 240 && sim.results.isEmpty { sim.step(DT); t += DT }
        XCTAssertEqual(sim.wins.map(\.name), [sim.results[0]])
        XCTAssertEqual(winTally(["Chris", "🤖 Sparky", "Ada", "🤖 Sparky", "Chris", "Chris", "Zoe", "Max", "Rex"]), ["Chris 3", "🤖 Sparky 2", "Ada 1", "Zoe 1", "Max 1"])
    }

    func testBotsFinishARaceOnEveryTrack() {
        for def in TRACKS {
            let sim = RaceSim(trackId: def.id)
            var t = 0.0
            while t < 240 && sim.results.isEmpty { sim.step(DT); t += DT }
            XCTAssertEqual(sim.results.count, SEATS, "\(def.id): the Race should end within 4 minutes")
            XCTAssert((1...SEATS).contains(sim.finishers), "\(def.id): the results should count who finished")
            XCTAssertGreaterThan(sim.stats.pickups, 0, "\(def.id): Bots should pick up Batteries")
            let st = sim.stats
            print("\(def.id): \(String(format: "%.1f", sim.time))s, \(st.pickups) Batteries, \(st.recharges) Recharges (\(st.leaderRecharges) of the Leader), \(st.rams) Rams, \(st.hits) Hits")
        }
    }

    func testTheNextTrackIsNoneOfTheLastTenRaced() {
        let sim = RaceSim(trackId: TRACKS[0].id)
        var raced = [sim.track.def.id]
        for _ in 0..<200 {
            sim.newRace(FIRST_GRID_TIME)
            XCTAssertFalse(raced.suffix(10).contains(sim.track.def.id), "\(sim.track.def.id) again after \(raced.suffix(10))")
            raced.append(sim.track.def.id)
        }
        let pair = RaceSim(pool: ["kitchen", "garden"])
        for _ in 0..<4 { let was = pair.track.def.id; pair.newRace(FIRST_GRID_TIME); XCTAssertNotEqual(pair.track.def.id, was) }
    }

    func testPlayersPastTheFieldBringSeatsOfTheirOwnUpToMaxSeats() {
        let sim = RaceSim(trackId: "kitchen")
        for i in 0..<MAX_SEATS { XCTAssertNotNil(sim.join("p\(i)", "P\(i)", .roadster), "Player \(i + 1) gets a Seat") }
        XCTAssertEqual(sim.seats.count, MAX_SEATS)
        XCTAssertNil(sim.join("one-more", "Late", .roadster))
        sim.newRace(FIRST_GRID_TIME)
        XCTAssertEqual(sim.seats.count, MAX_SEATS)
        for i in 0..<15 { sim.leave("p\(i)") }
        sim.newRace(FIRST_GRID_TIME)
        XCTAssertEqual(sim.seats.count, SEATS)
        XCTAssertEqual(sim.seats.filter { !$0.owner.isEmpty }.count, 5)
        XCTAssertEqual(sim.seats.map(\.index), Array(0..<SEATS))
    }

    func testAPlayerWhoJoinsWithNoBotLeftStartsBehindTheLastRacer() {
        let sim = RaceSim(trackId: "garden")
        for i in 0..<SEATS { sim.join("p\(i)", "P\(i)", .roadster) }
        while sim.phase == .grid { sim.step(DT) }
        let late = sim.join("late", "Late", .semi)!
        sim.step(DT)
        XCTAssertEqual(late.position, SEATS + 1)
        let t = late.car.rb.translation
        for s in sim.seats where s !== late { let o = s.car.rb.translation; XCTAssertGreaterThan(hypot(o.x - t.x, o.z - t.z), 3, "clear of \(s.name)") }
    }

    func testEveryGridSlotOfAFullFieldIsLevelRoad() {
        for def in TRACKS {
            let track = buildTrack(def), world = createTrackWorld(track)
            let cars = (0..<MAX_SEATS).map { (slot: $0, at: gridPose(track, $0), car: createCar(world, .semi, gridPose(track, $0), true)) }
            for _ in 0..<180 { for c in cars { driveCar(world, c.car, NO_INPUT) }; world.step() }
            for c in cars {
                let t = c.car.rb.translation
                XCTAssertTrue(hypot(t.x - c.at.x, t.z - c.at.z) < 1 && t.y > c.at.y - 1.5, "\(def.id): slot \(c.slot) rolled away")
            }
        }
    }

    func testBatteriesReachTheBackOfAFullField() {
        var big = [Int](repeating: 0, count: MAX_SEATS)
        for _ in 0..<20000 { big[batteryRank(MAX_SEATS)] += 1 }
        XCTAssertEqual(big[0], 0, "none for the Leader")
        XCTAssertTrue(big.dropFirst().allSatisfy { $0 > 0 }, "by Position: \(big)")
        // about twice as many, the Leader's share having gone to those behind them
        XCTAssertGreaterThan(Double(big[(MAX_SEATS / 2)...].reduce(0, +)), 1.8 * Double(big[..<(MAX_SEATS / 2)].reduce(0, +)))
        for _ in 0..<1000 { let k = batteryRank(SEATS); XCTAssertTrue(k > 0 && k < SEATS) }
    }

    func testAnEmptyECarIsStrandedThenRecharged() {
        let sim = RaceSim(trackId: "kitchen")
        while sim.phase == .grid { sim.step(DT) }
        let leader = sim.seats.first { $0.position == 1 }!
        for (i, s) in sim.seats.enumerated() where s !== leader { teleport(s.car, poseAt(sim.track, 120 + i * 15)); s.lockedUntil = .infinity }
        // and no Battery: the others' progress stays on the grid, so one could turn up right in front of it
        sim.nextBatteryAt = .infinity
        leader.energy = 0
        sim.step(DT)
        XCTAssertTrue(sim.isStranded(leader))
        let at = leader.progress.u
        for _ in 0...Int(STRANDED_TIME / DT) { sim.step(DT) }
        XCTAssertTrue(sim.isRecharging(leader))
        XCTAssertLessThan(leader.energy, MAX_ENERGY / 2, "the battery fills up during the Recharge")
        // at least RECHARGE_TIME; a Leader waits on the drone until the Racers behind could get past
        while sim.isRecharging(leader) && sim.time < 30 { sim.step(DT) }
        XCTAssertFalse(sim.isRecharging(leader))
        XCTAssertGreaterThan(leader.energy, MAX_ENERGY - 1)
        // no trip to the back and no reversing: it brakes to a halt just past where it ran dry
        XCTAssertTrue((0..<12).contains(leader.progress.u - at), "moved \(leader.progress.u - at) samples")
    }
}
