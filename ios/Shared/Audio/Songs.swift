import Foundation

// client/src/songs.ts: the chiptune soundtrack of Electro Car Racer (github.com/cgrail/e-racer), one song per Track.
// `SongDataTests` checks these against the TypeScript.

struct Song { let name: String; let bpm: Double; var wave: Wave?; let chords, lead: String; let bass: [Int?]; let kick, snare, hat: String }

let SONGS: [Song] = [
    Song(name: "TURBO DRIVE", bpm: 150, wave: nil, chords: "Am F C G Am F G E",
         lead: "e5:2 a5:2 e5:2 c5:2 a4:4 c5:2 e5:2  f5:4 e5:2 c5:2 a4:4 c5:4  g5:2 e5:2 c5:2 e5:2 g5:4 c6:4  b5:4 a5:2 g5:2 d5:4 r:4 a5:2 c6:2 b5:2 a5:2 e5:4 a5:4  c6:4 a5:2 f5:2 c5:4 f5:4  d6:2 b5:2 g5:2 d5:2 g5:2 a5:2 b5:4  g#5:4 b5:4 e6:6 r:2",
         bass: [0, nil, 12, nil, 0, 0, 12, nil, 0, nil, 12, nil, 0, 7, 12, nil], kick: "x---x---x---x-x-", snare: "----x-------x---", hat: "-x-x-x-x-x-x-x-x"),
    Song(name: "NEON HIGHWAY", bpm: 126, wave: nil, chords: "D Bm G A D Bm G A",
         lead: "f#5:6 e5:2 d5:4 a4:4  b4:4 d5:2 f#5:2 e5:6 d5:2  d5:4 b4:4 g4:2 b4:2 d5:4  c#5:6 e5:2 a5:8 a5:4 f#5:2 a5:2 b5:4 a5:4  f#5:4 d5:2 f#5:2 b5:8  g5:2 f#5:2 e5:2 d5:2 b4:4 d5:4  e5:4 c#5:4 a4:8",
         bass: [0, nil, 0, 12, nil, 0, 12, nil, 0, nil, 0, 12, nil, 0, 12, 7], kick: "x-------x-------", snare: "----x-------x---", hat: "x-x-x-x-x-x-x-x-"),
    Song(name: "FINAL LAP", bpm: 168, wave: nil, chords: "Em C D B Em C D B",
         lead: "e5:2 e5:1 r:1 b4:2 e5:2 g5:2 f#5:2 e5:2 d5:2  e5:2 e5:1 r:1 c5:2 e5:2 g5:4 a5:4  f#5:2 f#5:1 r:1 d5:2 f#5:2 a5:2 g5:2 f#5:2 e5:2  d#5:4 f#5:4 b5:4 a5:2 f#5:2 g5:2 b5:2 e6:4 d6:2 b5:2 g5:4  e6:2 d6:2 c6:2 b5:2 a5:4 g5:4  f#5:2 a5:2 d6:4 c6:2 a5:2 f#5:4  d#5:2 f#5:2 a5:2 b5:2 d#6:8",
         bass: [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 7, 0, 12, 0], kick: "x--x--x-x--x--x-", snare: "----x-------x--x", hat: "xxxxxxxxxxxxxxxx"),
    Song(name: "HIGH VOLTAGE", bpm: 140, wave: .sawtooth, chords: "Am Am F G Am Am F E F G Em Am F G E E",
         lead: "a4:4 c5:2 e5:2 a5:6 g5:2  e5:2 a5:2 c6:4 b5:2 a5:2 g5:4  a5:6 f5:2 c5:4 f5:4  g5:6 d5:2 b4:4 d5:2 g5:2 a5:2 g5:2 e5:2 c5:2 e5:4 a5:4  c6:4 b5:2 a5:2 e6:8  d6:2 c6:2 a5:4 f5:4 a5:4  g#5:6 e5:2 b5:8 c6:6 a5:2 f5:4 c6:4  d6:6 b5:2 g5:4 d6:4  e6:4 d6:2 b5:2 g5:4 b5:4  c6:2 b5:2 a5:4 e5:4 a5:4 a5:2 c6:2 f6:4 e6:2 c6:2 a5:4  b5:2 d6:2 g6:4 f6:2 d6:2 b5:4  g#5:4 b5:4 e6:4 d6:2 b5:2  g#5:8 e5:4 r:4",
         bass: [0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 0, 12, 7, 12], kick: "x-----x-x-x-----", snare: "----x-------x---", hat: "x-x-x-x-x-x-x-xx"),
]

private let NOTE: [String: Int] = ["c": 0, "c#": 1, "d": 2, "d#": 3, "e": 4, "f": 5, "f#": 6, "g": 7, "g#": 8, "a": 9, "a#": 10, "b": 11]
private func midi(_ n: String) -> Int { 12 * (Int(String(n.last!))! + 1) + NOTE[String(n.dropLast())]! }
func hz(_ m: Double) -> Double { 440 * pow(2, (m - 69) / 12) }

/// A song unrolled into 16th-note steps: the chord of each bar and the lead note starting on each step.
struct CompiledSong {
    let song: Song, ch: [(root: Int, minor: Bool)], steps: Int, lead: [(m: Int, d: Int)?]
    init(_ s: Song) {
        song = s
        ch = s.chords.split(separator: " ").map { c in
            let minor = c.hasSuffix("m"), name = minor ? c.dropLast() : c[...]
            return (NOTE[name.lowercased()]!, minor)
        }
        steps = ch.count * 16
        var lead = [(m: Int, d: Int)?](repeating: nil, count: steps), pos = 0
        for tok in s.lead.split(separator: " ") {
            let parts = tok.split(separator: ":"), d = Int(parts[1])!
            if parts[0] != "r" && pos < steps { lead[pos] = (midi(String(parts[0])), d) }
            pos += d
        }
        self.lead = lead
    }
}

let SONGS_COMPILED = SONGS.map(CompiledSong.init)
