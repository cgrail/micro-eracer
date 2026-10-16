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

    func testBotsFinishARaceOnEveryTrack() {
        for def in TRACKS {
            let sim = RaceSim(trackId: def.id)
            var t = 0.0
            while t < 240 && sim.results.isEmpty { sim.step(DT); t += DT }
            XCTAssertEqual(sim.results.count, SEATS, "\(def.id): the Race should end within 4 minutes")
            XCTAssertGreaterThan(sim.stats.pickups, 0, "\(def.id): Bots should pick up Batteries")
            let st = sim.stats
            print("\(def.id): \(String(format: "%.1f", sim.time))s, \(st.pickups) Batteries, \(st.recharges) Recharges (\(st.leaderRecharges) of the Leader), \(st.rams) Rams, \(st.hits) Hits")
        }
    }

    func testAPickedTrackGoesOnToTheNextInTheList() {
        let ids = TRACKS.map(\.id), sim = RaceSim(trackId: ids[ids.count - 2], ordered: true)
        for want in [ids[ids.count - 1], ids[0], ids[1]] { sim.newRace(FIRST_GRID_TIME); XCTAssertEqual(sim.track.def.id, want) }
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
