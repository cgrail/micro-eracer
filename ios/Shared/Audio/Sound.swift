import AVFoundation

// client/src/audio.ts: effects and music synthesised (Synth.swift), the Racers' voices from the CC0 recordings in
// client/public/voices (bundled as `voices/`, see its CREDITS.md).

/// What a Racer cries out: a laugh or a cheer after a Ram, "ow!" when hit, a scream when thrown about, "nooo!" when running dry.
enum Mood: String, CaseIterable { case gloat, hurt, thrown, despair }
private let CLIPS: [Mood: [String]] = [
    .gloat: ["laugh-cute", "laugh-cartoon", "laugh-taunt", "woohoo", "wouhouh", "yahoo"],
    .hurt: ["ouch", "oww", "oww-2", "oof"],
    .thrown: ["scream-wow", "waaah", "scream-short"],
    .despair: ["nooo", "nooo-2"],
]
// every Seat sounds like someone else: the same recordings played a little faster (higher) or slower (deeper)
private let VOICE_RATES = [1, 0.88, 1.16, 0.95, 1.08, 0.84, 1.24, 0.92]

final class Sound {
    private let synth = Synth()
    private(set) var muted = false
    private var voices: [Mood: [(clip: [Float], rate: Double)]] = [:]
    private var lastCry: [Int: Double] = [:], lastOtherCry = -9.0
    private let wind = Loop(.noise, filters: [(Biquad(.lowpass, q: 0.707), 180), (Biquad(.bandpass, q: 0.8), 500)])
    private let skid = Loop(.noise, filters: [(Biquad(.bandpass, q: 2), 1400)])
    private let drone = Loop(.sawtooth, freq: 190, lfo: (28, 30))
    private var song: CompiledSong?, songStep = 0, songAt = 0.0

    init() {
        [wind, skid, drone].forEach(synth.add)
        // 15 short clips: decoded up front, so the game thread only ever reads them
        loadVoices()
    }

    func setMuted(_ on: Bool) { muted = on; synth.setMuted(on) }
    private var t: Double { synth.now }

    private func env(_ vol: Double, _ attack: Double, _ length: Double) -> Ramp { Ramp([(0, 0.0001), (attack, max(0.0002, vol)), (length, 0.0001)]) }

    private func tone(_ wave: Wave, _ from: Double, _ to: Double, _ length: Double, _ vol: Double, attack: Double = 0.005, delay: Double = 0) {
        if vol < 0.01 { return }
        synth.play(Voice(wave: wave, freq: Ramp([(0, from), (length, to)]), gain: env(vol, attack, length), length: Int((length + 0.05) * synth.rate)), delay: delay)
    }

    private func hiss(_ length: Double, _ kind: FilterKind, _ from: Double, _ to: Double, _ vol: Double, q: Double = 1, delay: Double = 0) {
        if vol < 0.01 { return }
        synth.play(Voice(wave: .noise, gain: env(vol, 0.005, length), filter: Biquad(kind, q: q), cutoff: Ramp([(0, from), (length, to)]), length: Int((length + 0.05) * synth.rate)), delay: delay)
    }

    /// The airflow and tyre skid of our own E-Car, every frame: no motor hum, just wind that rises with speed.
    func drive(_ speed: Double, _ throttle: Double, _ skidding: Double) {
        let k = min(1, abs(speed) / 22)
        synth.set(wind) {
            $0.cutoffTargets = [180 + k * 520, 500 + k * 1700]
            $0.target = 0.003 + k * k * 0.08 + max(0, throttle) * k * 0.01
        }
        synth.set(skid) { $0.target = min(1, max(0, skidding)) * 0.25 }
    }

    /// Buzzing rotors while a drone carries our E-Car.
    func setDrone(_ on: Bool) { synth.set(drone) { $0.target = on ? 0.08 : 0 } }

    func silenceLoops() {
        stopMusic()
        for l in [wind, skid, drone] { synth.set(l) { $0.target = 0 } }
    }

    func shot(_ vol: Double = 1) { tone(.square, 1400, 220, 0.14, 0.18 * vol) }
    func missile(_ vol: Double = 1) { hiss(0.7, .bandpass, 300, 2500, 0.5 * vol, q: 3); tone(.sawtooth, 200, 900, 0.6, 0.08 * vol) }
    func mineDrop(_ vol: Double = 1) { tone(.triangle, 500, 300, 0.12, 0.25 * vol); tone(.triangle, 900, 600, 0.08, 0.15 * vol) }
    func boom(_ vol: Double = 1) { hiss(0.8, .lowpass, 1600, 80, 0.9 * vol); tone(.sine, 120, 35, 0.6, 0.6 * vol) }
    func crash(_ vol: Double = 1) { hiss(0.25, .lowpass, 2500, 300, 0.6 * vol); tone(.sine, 90, 40, 0.2, 0.5 * vol) }
    func splash(_ vol: Double = 1) { hiss(0.35, .bandpass, 2200, 600, 0.35 * vol, q: 1.5) }
    func battery(_ vol: Double = 1) { for (i, f) in [660.0, 880, 1320].enumerated() { tone(.sine, f, f * 1.02, 0.12, 0.25 * vol, delay: Double(i) * 0.06) } }
    func box() { for (i, f) in [500.0, 700, 600, 900, 1200].enumerated() { tone(.square, f, f, 0.05, 0.08, delay: Double(i) * 0.07) } }
    func shield() { tone(.triangle, 900, 1800, 0.4, 0.2); tone(.sine, 1350, 2700, 0.4, 0.12) }
    func block(_ vol: Double = 1) { tone(.triangle, 2000, 1900, 0.35, 0.3 * vol); tone(.triangle, 3000, 2950, 0.25, 0.15 * vol) }
    func lowBattery(_ urgent: Bool) { tone(.square, urgent ? 1100 : 880, urgent ? 1100 : 880, 0.08, 0.12) }
    func powerDown() {
        tone(.sawtooth, 420, 40, 1.3, 0.2)
        for i in 0..<5 { hiss(0.08, .lowpass, 900, 200, 0.3, delay: 0.15 + Double(i) * 0.22 + .random(in: 0..<0.08)) }
    }
    func countdown(_ go: Bool) { tone(.square, go ? 1320 : 660, go ? 1320 : 660, go ? 0.5 : 0.15, 0.15) }
    func fanfare() { for (i, f) in [523.0, 659, 784, 1047].enumerated() { tone(.square, f, f, i == 3 ? 0.5 : 0.14, 0.12, delay: Double(i) * 0.13) } }

    private func loadVoices() {
        for (mood, names) in CLIPS {
            // shortcut: a clip that fails to load is never heard; the others still are
            voices[mood] = names.compactMap { name in
                guard let url = Bundle.main.url(forResource: "\(mood.rawValue)-\(name)", withExtension: "mp3", subdirectory: "voices"),
                      let file = try? AVAudioFile(forReading: url),
                      let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)),
                      (try? file.read(into: buffer)) != nil, let data = buffer.floatChannelData?[0] else { return nil }
                return (Array(UnsafeBufferPointer(start: data, count: Int(buffer.frameLength))), file.processingFormat.sampleRate)
            }
        }
    }

    /// A Racer cries out in their own voice, at most once a second each. Full volume means it's about our own E-Car.
    func cry(_ mood: Mood, _ seat: Int, _ vol: Double = 1, delay: Double = 0) {
        guard let clips = voices[mood], !clips.isEmpty, seat >= 0, t >= lastCry[seat, default: -9] + 1 else { return }
        // the others' cries are rationed, so the ones about us always stand out
        if vol < 1 && (vol < 0.4 || t < lastOtherCry + 0.8) { return }
        if vol < 1 { lastOtherCry = t }
        lastCry[seat] = t
        let pick = clips.randomElement()!
        // a little wobble too, so the same clip never sounds quite the same twice
        let speed = VOICE_RATES[seat % VOICE_RATES.count] * Double.random(in: 0.96..<1.04) * pick.rate / synth.rate
        synth.play(Voice(gain: Ramp([(0, vol)]), length: Int(Double(pick.clip.count) / speed) + 1, clip: pick.clip, speed: speed), delay: delay)
    }

    /// Loops a song of the soundtrack; asking for the one already playing changes nothing.
    func music(_ i: Int) {
        let next = SONGS_COMPILED[i % SONGS_COMPILED.count]
        if song?.song.name == next.song.name { return }
        song = next
        songStep = 0
        songAt = t + 0.1
    }

    func stopMusic() { song = nil }

    /// Called every frame: schedules the notes of the next 0.15 s.
    func schedule() {
        guard let s = song else { return }
        let step = 60 / s.song.bpm / 4
        // the game stalled (in the background): skip the missed notes instead of playing them all at once
        if songAt < t { songAt = t + 0.05 }
        while songAt < t + 0.15 {
            if !muted { playStep(s, songStep, songAt) }
            songAt += step
            songStep = (songStep + 1) % s.steps
        }
    }

    private func playStep(_ s: CompiledSong, _ i: Int, _ at: Double) {
        let sp = 60 / s.song.bpm / 4, n = i % 16, c = s.ch[(i / 16) % s.ch.count]
        if let b = s.song.bass[n] { note(.square, hz(Double(36 + c.root - (c.root >= 7 ? 12 : 0) + b)), at, sp * 1.5, 0.16, 700) }
        let tones = [0, c.minor ? 3 : 4, 7, 12, 7, c.minor ? 3 : 4]
        note(.square, hz(Double(60 + c.root + tones[n % tones.count])), at, sp * 0.7, 0.035, 2400)
        if let l = s.lead[i % s.steps] {
            let wave = s.song.wave
            note(wave ?? .square, hz(Double(l.m)), at, sp * Double(l.d) * 0.92, wave == nil ? 0.075 : 0.06, wave == nil ? 3200 : 2600, vibrato: l.d >= 4)
        }
        let hit = { (pattern: String) in Array(pattern)[n] == "x" }
        if hit(s.song.kick) { drum("k", at) }
        if hit(s.song.snare) { drum("s", at) }
        if hit(s.song.hat) { drum("h", at) }
    }

    private func note(_ wave: Wave, _ freq: Double, _ at: Double, _ dur: Double, _ vol: Double, _ cutoff: Double, vibrato: Bool = false) {
        var v = Voice(wave: wave, freq: Ramp([(0, freq)]), gain: Ramp([(0, 0.0001), (0.008, vol), (min(dur, 0.15), vol * 0.6), (dur * 0.9, vol * 0.6), (dur + 0.04, 0.0001)]),
                      filter: Biquad(.lowpass, q: 0.707), cutoff: Ramp([(0, cutoff)]), length: Int((dur + 0.1) * synth.rate))
        if vibrato { v.vibrato = (0.12, 5.5, freq * 0.012) }
        v.bus = 1
        synth.play(v, at: at)
    }

    private func drum(_ kind: Character, _ at: Double) {
        if kind == "k" {
            var v = Voice(wave: .sine, freq: Ramp([(0, 150), (0.12, 40)]), gain: Ramp([(0, 0.9), (0.18, 0.0001)]), length: Int(0.2 * synth.rate))
            v.bus = 1
            synth.play(v, at: at)
            return
        }
        let dur = kind == "s" ? 0.14 : 0.035
        var v = Voice(wave: .noise, gain: Ramp([(0, kind == "s" ? 0.5 : 0.18), (dur, 0.0001)]), filter: Biquad(.highpass, q: 0.707),
                      cutoff: Ramp([(0, kind == "s" ? 1200 : 7000)]), length: Int((dur + 0.02) * synth.rate))
        v.bus = 1
        synth.play(v, at: at)
        if kind == "s" { note(.triangle, 190, at, 0.06, 0.25, 2000) }
    }
}
