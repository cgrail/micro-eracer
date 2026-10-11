import AVFoundation
import os

// The few WebAudio pieces client/src/audio.ts uses, as one AVAudioSourceNode: oscillators and noise through a biquad filter
// with exponential envelopes and sweeps, recordings played at any rate, and three endless loops (wind, skid, drone).

enum Wave { case sine, square, sawtooth, triangle, noise }
enum FilterKind { case lowpass, highpass, bandpass }

/// An exponential ramp through points (seconds after the start, value), like `exponentialRampToValueAtTime`.
struct Ramp {
    private var points: [(t: Double, v: Double)], seg = 0, value: Double, factor = 1.0, left = 0
    init(_ points: [(Double, Double)]) { self.points = points.map { (t: $0.0, v: $0.1) }; value = points[0].1 }
    /// The value now, then one sample on.
    mutating func next(_ rate: Double, _ sample: Int) -> Double {
        let out = value
        if left > 0 { value *= factor; left -= 1 } else if seg < points.count - 1 {
            // the next segment starts at this sample
            if Double(sample) >= points[seg].t * rate {
                let a = points[seg], b = points[seg + 1], n = max(1, Int((b.t - a.t) * rate))
                value = a.v
                factor = pow(max(b.v, 1e-6) / max(a.v, 1e-6), 1 / Double(n))
                left = n
                seg += 1
            }
        }
        return out
    }
}

/// RBJ biquad, coefficients worked out again every 32 samples as the cutoff moves.
struct Biquad {
    let kind: FilterKind, q: Double
    private var b0 = 1.0, b1 = 0.0, b2 = 0.0, a1 = 0.0, a2 = 0.0, x1 = 0.0, x2 = 0.0, y1 = 0.0, y2 = 0.0
    init(_ kind: FilterKind, q: Double) { self.kind = kind; self.q = q }
    mutating func tune(_ freq: Double, _ rate: Double) {
        let w = 2 * Double.pi * min(freq, rate * 0.45) / rate, alpha = sin(w) / (2 * q), c = cos(w), a0 = 1 + alpha
        switch kind {
        case .lowpass: b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2
        case .highpass: b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2
        case .bandpass: b0 = alpha; b1 = 0; b2 = -alpha
        }
        b0 /= a0; b1 /= a0; b2 /= a0; a1 = -2 * c / a0; a2 = (1 - alpha) / a0
    }
    mutating func run(_ x: Double) -> Double {
        let y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2 = x1; x1 = x; y2 = y1; y1 = y
        return y
    }
}

/// One sound: a wave or noise (or a recording) through an optional filter, shaped by its gain ramp.
struct Voice {
    var wave = Wave.sine, freq = Ramp([(0, 440)]), gain: Ramp, filter: Biquad? = nil, cutoff = Ramp([(0, 1000)])
    var vibrato: (from: Double, rate: Double, depth: Double)? = nil
    /// Samples after the voice's start when it stops.
    var length: Int
    var clip: [Float] = [], speed = 1.0
    /// When it starts, in samples of the synth's clock; until then it waits.
    var start = 0
    var bus = 0
    var phase = 0.0, at = 0, read = 0.0, noise: UInt32 = 0x9E3779B9
}

/// An endless sound whose gain (and filter) follow a target smoothly, like `setTargetAtTime`.
final class Loop {
    var wave: Wave, freq: Double, filters: [(Biquad, Double)], lfo: (rate: Double, depth: Double)?
    var gain = 0.0, target = 0.0, cutoffTargets: [Double]
    fileprivate var phase = 0.0, lfoPhase = 0.0, noise: UInt32 = 0x1234567, count = 0
    init(_ wave: Wave, freq: Double = 0, filters: [(Biquad, Double)] = [], lfo: (Double, Double)? = nil) {
        self.wave = wave; self.freq = freq; self.filters = filters; cutoffTargets = filters.map(\.1); self.lfo = lfo.map { (rate: $0.0, depth: $0.1) }
    }
}

final class Synth {
    let rate: Double
    private let engine = AVAudioEngine()
    private var lock = os_unfair_lock()
    private var pending: [Voice] = [], voices: [Voice] = []
    private(set) var loops: [Loop] = []
    private var clock = 0
    /// Master gain (0 when muted) and the music's, both eased.
    private var master = 0.6, masterTarget = 0.6
    let musicGain = 0.7

    init() {
        try? AVAudioSession.sharedInstance().setCategory(.ambient)
        try? AVAudioSession.sharedInstance().setActive(true)
        rate = engine.outputNode.outputFormat(forBus: 0).sampleRate > 0 ? engine.outputNode.outputFormat(forBus: 0).sampleRate : 48000
        let format = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 1)!
        let node = AVAudioSourceNode(format: format) { [unowned self] _, _, frames, buffers in
            let out = UnsafeMutableAudioBufferListPointer(buffers)[0].mData!.assumingMemoryBound(to: Float.self)
            self.render(out, Int(frames))
            return noErr
        }
        engine.attach(node)
        engine.connect(node, to: engine.mainMixerNode, format: format)
        try? engine.start()
    }

    /// Seconds since the synth started, as far as it has played.
    var now: Double { os_unfair_lock_lock(&lock); defer { os_unfair_lock_unlock(&lock) }; return Double(clock) / rate }

    func setMuted(_ muted: Bool) { os_unfair_lock_lock(&lock); masterTarget = muted ? 0 : 0.6; os_unfair_lock_unlock(&lock) }

    /// Plays `v` `delay` seconds from now, or at `at` seconds on the synth's clock.
    func play(_ v: Voice, delay: Double = 0, at: Double? = nil) {
        var v = v
        os_unfair_lock_lock(&lock)
        v.start = Int(((at ?? Double(clock) / rate) + delay) * rate)
        v.noise = UInt32.random(in: 1...UInt32.max)
        pending.append(v)
        os_unfair_lock_unlock(&lock)
    }

    func add(_ loop: Loop) { os_unfair_lock_lock(&lock); loops.append(loop); os_unfair_lock_unlock(&lock) }
    /// Changes a loop's targets under the lock, so the audio thread never sees them half set.
    func set(_ loop: Loop, _ change: (Loop) -> Void) { os_unfair_lock_lock(&lock); change(loop); os_unfair_lock_unlock(&lock) }

    private func render(_ out: UnsafeMutablePointer<Float>, _ frames: Int) {
        os_unfair_lock_lock(&lock)
        defer { os_unfair_lock_unlock(&lock) }
        voices += pending
        pending.removeAll(keepingCapacity: true)
        let ease = 1 - exp(-1 / (0.05 * rate)), loopEase = 1 - exp(-1 / (0.12 * rate))
        for i in 0..<frames {
            let sample = clock + i
            var mix = 0.0, music = 0.0
            for k in voices.indices where voices[k].start <= sample {
                let s = voice(&voices[k])
                if voices[k].bus == 1 { music += s } else { mix += s }
            }
            for l in loops { mix += loop(l, loopEase) }
            master += (masterTarget - master) * ease
            // a soft limit instead of a compressor: loud moments squash rather than clip
            out[i] = Float(tanh((mix + music * musicGain) * master))
        }
        clock += frames
        voices.removeAll { $0.at >= $0.length }
    }

    private func osc(_ wave: Wave, _ phase: Double, _ noise: inout UInt32) -> Double {
        switch wave {
        case .sine: return sin(2 * .pi * phase)
        case .square: return phase < 0.5 ? 1 : -1
        case .sawtooth: return 2 * phase - 1
        case .triangle: return 1 - 4 * abs(phase - 0.5)
        case .noise: noise ^= noise << 13; noise ^= noise >> 17; noise ^= noise << 5; return Double(noise) / Double(UInt32.max) * 2 - 1
        }
    }

    private func voice(_ v: inout Voice) -> Double {
        let at = v.at
        v.at += 1
        var x: Double
        if !v.clip.isEmpty {
            let i = Int(v.read)
            guard i + 1 < v.clip.count else { v.at = v.length; return 0 }
            let f = v.read - Double(i)
            x = Double(v.clip[i]) * (1 - f) + Double(v.clip[i + 1]) * f
            v.read += v.speed
        } else {
            var f = v.freq.next(rate, at)
            if let vib = v.vibrato, Double(at) / rate > vib.from { f += sin(2 * .pi * vib.rate * Double(at) / rate) * vib.depth }
            x = osc(v.wave, v.phase, &v.noise)
            v.phase = (v.phase + f / rate).truncatingRemainder(dividingBy: 1)
        }
        if v.filter != nil {
            let c = v.cutoff.next(rate, at)
            if at % 32 == 0 { v.filter!.tune(c, rate) }
            x = v.filter!.run(x)
        }
        return x * v.gain.next(rate, at)
    }

    private func loop(_ l: Loop, _ ease: Double) -> Double {
        l.gain += (l.target - l.gain) * ease
        if l.gain < 1e-4 && l.target == 0 { return 0 }
        var f = l.freq
        if let lfo = l.lfo { l.lfoPhase = (l.lfoPhase + lfo.rate / rate).truncatingRemainder(dividingBy: 1); f += sin(2 * .pi * l.lfoPhase) * lfo.depth }
        let x = osc(l.wave, l.phase, &l.noise)
        l.phase = (l.phase + f / rate).truncatingRemainder(dividingBy: 1)
        if l.filters.isEmpty { return x * l.gain }
        l.count += 1
        var sum = 0.0
        for k in l.filters.indices {
            if l.count % 32 == 1 { l.filters[k].1 += (l.cutoffTargets[k] - l.filters[k].1) * min(1, 32 / (0.12 * rate)); l.filters[k].0.tune(l.filters[k].1, rate) }
            sum += l.filters[k].0.run(x)
        }
        return sum * l.gain
    }
}
