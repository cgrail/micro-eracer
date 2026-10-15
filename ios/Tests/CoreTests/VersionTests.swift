import Foundation
import XCTest
@testable import Core

/// What the app tells the server it speaks, against shared/src/version.ts: the two are bumped together, or the server
/// lets an app race that drives differently from its Bots (or turns one away that would race fine).
final class VersionTests: XCTestCase {
    func testProtocolMatchesTheTypeScript() throws {
        let file = URL(fileURLWithPath: #filePath).appendingPathComponent("../../../../shared/src/version.ts").standardized
        let text = try String(contentsOf: file, encoding: .utf8)
        func constant(_ name: String) -> Int? {
            guard let r = text.range(of: "export const \(name) = \\d+", options: .regularExpression) else { return nil }
            return Int(text[r].split(separator: " ").last ?? "")
        }
        XCTAssertEqual(constant("PROTOCOL"), PROTOCOL, "PROTOCOL changed in shared/src/version.ts: change it in ios/Core/Version.swift too")
        XCTAssertEqual(constant("OUTDATED"), OUTDATED)
        XCTAssertTrue(text.contains("export const APP_STORE = '\(APP_STORE.absoluteString)';"), "APP_STORE changed in shared/src/version.ts: change it in ios/Core/Version.swift too")
        XCTAssertTrue(text.contains("export const REPO = '\(REPO.absoluteString)';"), "REPO changed in shared/src/version.ts: change it in ios/Core/Version.swift too")
    }

    /// An Offline Race reports its Track as the room does, so the game builds the one being raced.
    func testTheRaceStateCarriesItsTrack() {
        let sim = RaceSim(trackId: "garden")
        XCTAssertEqual(raceState(sim).track, TRACKS.first { $0.id == "garden" })
    }
}
