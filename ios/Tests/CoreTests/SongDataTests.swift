import Foundation
import XCTest

/// The soundtrack is copied into MicroERacer/Audio/Songs.swift, which the Core package doesn't build (it is audio, not
/// rules); this compares that file's songs with client/src/songs.ts as text, so a song changed on one side fails here.
final class SongDataTests: XCTestCase {
    static let root = URL(fileURLWithPath: #filePath).appendingPathComponent("../../../..").standardized

    func testSongsMatchTheTypeScript() throws {
        let ts = try String(contentsOf: Self.root.appendingPathComponent("client/src/songs.ts"), encoding: .utf8)
        let swift = try String(contentsOf: Self.root.appendingPathComponent("ios/MicroERacer/Audio/Songs.swift"), encoding: .utf8)
        // the lead lines of a TypeScript song are split over several strings joined with +
        let joined = ts.replacingOccurrences(of: "' \\+\\s*'", with: "", options: .regularExpression)
        func all(_ pattern: String, _ text: String) -> [String] {
            let re = try! NSRegularExpression(pattern: pattern)
            return re.matches(in: text, range: NSRange(text.startIndex..., in: text)).map { String(text[Range($0.range(at: 1), in: text)!]) }
        }
        for key in ["name", "chords", "lead", "kick", "snare", "hat"] {
            XCTAssertEqual(all("\(key): '([^']*)'", joined), all("\(key): \"([^\"]*)\"", swift), "\(key) differs: copy client/src/songs.ts into Songs.swift")
        }
        XCTAssertEqual(all("bpm: (\\d+)", ts), all("bpm: (\\d+)", swift))
        XCTAssertEqual(all("bass: \\[(\\d[^\\]]*)\\]", ts), all("bass: \\[(\\d[^\\]]*)\\]", swift).map { $0.replacingOccurrences(of: "nil", with: "null") })
    }
}
