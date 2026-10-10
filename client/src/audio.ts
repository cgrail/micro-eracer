import { type CompiledSong, hz, SONGS_COMPILED } from './songs.ts';

/** All sounds, voices and music are synthesised with WebAudio, so nothing is downloaded. */

// formants of the cartoon mouth: the three resonances that make a buzz sound like "a", "e", "i", "o" or "u"
const FORMANTS = { a: [850, 1250, 2800], e: [550, 1950, 2700], i: [330, 2500, 3200], o: [520, 880, 2600], u: [360, 760, 2500] };
const FORMANT_GAINS = [1.6, 1.1, 0.5];
type Vowel = keyof typeof FORMANTS;
/** One breath of a cry: pitch (times the Racer's own) and vowel glide evenly over it; `h` is a breathy onset, `rough` a scream's rasp. */
interface Part { at: number; len: number; f0: number[]; v: Vowel[]; h?: number; rough?: number }

const laugh = [0, 1, 2, 3].map((k): Part => ({ at: k * 0.13, len: k === 3 ? 0.22 : 0.1, f0: [1.45 * 0.92 ** k, 1.3 * 0.92 ** k], v: ['a', 'a'], h: 0.035 }));
const yahoo: Part[] = [{ at: 0, len: 0.15, f0: [1, 1.2], v: ['i', 'a'] }, { at: 0.17, len: 0.45, f0: [1.5, 1.9, 1.75, 1.3], v: ['o', 'u'], h: 0.04 }];
const ouch: Part[] = [{ at: 0, len: 0.34, f0: [2, 1.8, 1.1], v: ['a', 'a', 'u'], rough: 0.25 }];
const hey: Part[] = [{ at: 0, len: 0.28, f0: [1.25, 1.5, 1], v: ['e', 'e', 'i'], h: 0.05 }];
const scream: Part[] = [{ at: 0, len: 0.95, f0: [1.3, 2.3, 2.2, 2.25, 2, 1.4], v: ['u', 'a', 'a', 'a', 'a', 'o'], rough: 0.35 }];
const nooo: Part[] = [{ at: 0, len: 0.9, f0: [1.6, 1.5, 1.3, 1, 0.75], v: ['u', 'o', 'o', 'o', 'u'] }];
/** What a Racer cries out: "ha-ha-ha!" or "ya-hoo!" after a Ram, "ow!", "hey!" or "waaah!" when hit, "nooo!" when running dry. */
const CRIES = { gloat: [laugh, yahoo], hurt: [ouch, hey, scream], thrown: [scream], despair: [nooo] };
export type Mood = keyof typeof CRIES;
// every Seat has its own voice: pitch (Hz) and head size (formant scale)
const VOICES = [[330, 1.1], [250, 0.95], [420, 1.22], [290, 1], [370, 1.15], [230, 0.92], [460, 1.25], [310, 1.05]];

export class Sound {
  muted = false;
  private ctx?: AudioContext;
  private master!: GainNode;
  private mus!: GainNode;
  private noise!: AudioBuffer;
  private glottal!: PeriodicWave;
  private engine?: { osc: OscillatorNode; osc2: OscillatorNode; filter: BiquadFilterNode; gain: GainNode };
  private skid?: GainNode;
  private drone?: { osc: OscillatorNode; gain: GainNode };
  private lastCry: number[] = [];
  private lastOtherCry = -9;
  private song?: CompiledSong;
  private songStep = 0;
  private songAt = 0;
  private songTimer?: ReturnType<typeof setInterval>;

  /** Must run inside a user gesture (the Play button), or mobile browsers stay silent. */
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(comp);
      this.mus = this.ctx.createGain();
      this.mus.gain.value = 0.35;
      this.mus.connect(this.master);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      // vocal cords: a buzz whose harmonics fall off faster than a sawtooth's, which sounds softer and more like a voice
      const real = new Float32Array(40), imag = new Float32Array(40);
      for (let k = 1; k < 40; k++) imag[k] = 1 / k ** 1.3;
      this.glottal = this.ctx.createPeriodicWave(real, imag);
    }
    void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.6, this.ctx.currentTime, 0.05);
  }

  private get t() { return this.ctx!.currentTime; }

  private env(vol: number, attack: number, length: number) {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, this.t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), this.t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + length);
    g.connect(this.master);
    return g;
  }

  private tone(type: OscillatorType, from: number, to: number, length: number, vol: number, attack = 0.005) {
    if (!this.ctx || vol < 0.01) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, this.t);
    osc.frequency.exponentialRampToValueAtTime(to, this.t + length);
    osc.connect(this.env(vol, attack, length));
    osc.start();
    osc.stop(this.t + length + 0.05);
  }

  private hiss(length: number, filterType: BiquadFilterType, from: number, to: number, vol: number, q = 1) {
    if (!this.ctx || vol < 0.01) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, this.t);
    f.frequency.exponentialRampToValueAtTime(to, this.t + length);
    src.connect(f).connect(this.env(vol, 0.005, length));
    src.start();
    src.stop(this.t + length + 0.05);
  }

  /** Our own E-Car's motor hum and tyre skid, updated every frame. */
  drive(speed: number, throttle: number, skid: number) {
    if (!this.ctx) return;
    if (!this.engine) {
      const osc = this.ctx.createOscillator(), osc2 = this.ctx.createOscillator(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc2.type = 'square';
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      gain.gain.value = 0;
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain).connect(this.master);
      osc.start();
      osc2.start();
      this.engine = { osc, osc2, filter, gain };
      const src = this.ctx.createBufferSource(), band = this.ctx.createBiquadFilter();
      src.buffer = this.noise;
      src.loop = true;
      band.type = 'bandpass';
      band.frequency.value = 1400;
      band.Q.value = 2;
      this.skid = this.ctx.createGain();
      this.skid.gain.value = 0;
      src.connect(band).connect(this.skid).connect(this.master);
      src.start();
    }
    // an electric motor: a rising whine rather than a combustion rumble
    const pitch = 70 + Math.abs(speed) * 14;
    this.engine.osc.frequency.setTargetAtTime(pitch, this.t, 0.05);
    this.engine.osc2.frequency.setTargetAtTime(pitch * 1.505, this.t, 0.05);
    this.engine.filter.frequency.setTargetAtTime(400 + Math.abs(speed) * 60, this.t, 0.05);
    this.engine.gain.gain.setTargetAtTime(0.05 + Math.min(1, Math.abs(throttle)) * 0.07, this.t, 0.08);
    this.skid!.gain.setTargetAtTime(Math.min(1, skid) * 0.25, this.t, 0.05);
  }

  /** Buzzing rotors while a drone carries our E-Car. */
  setDrone(on: boolean) {
    if (!this.ctx) return;
    if (!this.drone) {
      const osc = this.ctx.createOscillator(), gain = this.ctx.createGain(), lfo = this.ctx.createOscillator(), depth = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 190;
      lfo.frequency.value = 28;
      depth.gain.value = 30;
      lfo.connect(depth).connect(osc.frequency);
      gain.gain.value = 0;
      osc.connect(gain).connect(this.master);
      osc.start();
      lfo.start();
      this.drone = { osc, gain };
    }
    this.drone.gain.gain.setTargetAtTime(on ? 0.08 : 0, this.t, 0.15);
  }

  silenceLoops() {
    this.stopMusic();
    if (!this.ctx) return;
    this.engine?.gain.gain.setTargetAtTime(0, this.t, 0.05);
    this.skid?.gain.setTargetAtTime(0, this.t, 0.05);
    this.drone?.gain.gain.setTargetAtTime(0, this.t, 0.05);
  }

  shot(vol = 1) { this.tone('square', 1400, 220, 0.14, 0.18 * vol); }
  missile(vol = 1) { this.hiss(0.7, 'bandpass', 300, 2500, 0.5 * vol, 3); this.tone('sawtooth', 200, 900, 0.6, 0.08 * vol); }
  mineDrop(vol = 1) { this.tone('triangle', 500, 300, 0.12, 0.25 * vol); this.tone('triangle', 900, 600, 0.08, 0.15 * vol); }
  boom(vol = 1) { this.hiss(0.8, 'lowpass', 1600, 80, 0.9 * vol); this.tone('sine', 120, 35, 0.6, 0.6 * vol); }
  crash(vol = 1) { this.hiss(0.25, 'lowpass', 2500, 300, 0.6 * vol); this.tone('sine', 90, 40, 0.2, 0.5 * vol); }
  splash(vol = 1) { this.hiss(0.35, 'bandpass', 2200, 600, 0.35 * vol, 1.5); }
  battery(vol = 1) { [660, 880, 1320].forEach((f, i) => setTimeout(() => this.tone('sine', f, f * 1.02, 0.12, 0.25 * vol), i * 60)); }
  box() { [500, 700, 600, 900, 1200].forEach((f, i) => setTimeout(() => this.tone('square', f, f, 0.05, 0.08), i * 70)); }
  shield() { this.tone('triangle', 900, 1800, 0.4, 0.2); this.tone('sine', 1350, 2700, 0.4, 0.12); }
  block(vol = 1) { this.tone('triangle', 2000, 1900, 0.35, 0.3 * vol); this.tone('triangle', 3000, 2950, 0.25, 0.15 * vol); }
  lowBattery(urgent: boolean) { this.tone('square', urgent ? 1100 : 880, urgent ? 1100 : 880, 0.08, 0.12); }
  powerDown() {
    this.tone('sawtooth', 420, 40, 1.3, 0.2);
    for (let i = 0; i < 5; i++) setTimeout(() => this.hiss(0.08, 'lowpass', 900, 200, 0.3), 150 + i * 220 + Math.random() * 80);
  }
  countdown(go: boolean) { this.tone('square', go ? 1320 : 660, go ? 1320 : 660, go ? 0.5 : 0.15, 0.15); }
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone('square', f, f, i === 3 ? 0.5 : 0.14, 0.12), i * 130)); }

  /** A Racer cries out in their own cartoon voice, at most once a second each. Full volume means it's about our own E-Car. */
  cry(mood: Mood, seat: number, vol = 1, delay = 0) {
    if (!this.ctx || seat < 0 || this.t < (this.lastCry[seat] ?? -9) + 1) return;
    // the others' cries are rationed, so the ones about us always stand out
    if (vol < 1 && (vol < 0.4 || this.t < this.lastOtherCry + 0.8)) return;
    if (vol < 1) this.lastOtherCry = this.t;
    this.lastCry[seat] = this.t;
    const ctx = this.ctx, variants = CRIES[mood], [pitch, size] = VOICES[seat % VOICES.length];
    const wobble = 0.93 + Math.random() * 0.14;
    for (const p of variants[Math.floor(Math.random() * variants.length)]) {
      const t0 = this.t + delay + p.at, t1 = t0 + p.len, attack = Math.min(0.025, p.len * 0.25), release = Math.min(0.08, p.len * 0.4);
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, t0);
      out.gain.exponentialRampToValueAtTime(0.25 * vol, t0 + attack);
      out.gain.setValueAtTime(0.25 * vol, t1 - release);
      out.gain.exponentialRampToValueAtTime(0.0001, t1);
      out.connect(this.master);
      let into: AudioNode = out;
      if (p.rough) {
        const am = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
        am.gain.value = 1 - p.rough;
        depth.gain.value = p.rough;
        lfo.frequency.value = 38 + Math.random() * 14;
        lfo.connect(depth).connect(am.gain);
        am.connect(out);
        into = am;
        lfo.start(t0);
        lfo.stop(t1 + 0.02);
      }
      const osc = ctx.createOscillator(), vib = ctx.createOscillator(), vibDepth = ctx.createGain(), voiced = ctx.createGain();
      osc.setPeriodicWave(this.glottal);
      osc.frequency.setValueCurveAtTime(p.f0.map((f) => f * pitch * wobble), t0, p.len);
      vib.frequency.value = 5.5 + Math.random() * 1.5;
      vibDepth.gain.value = p.len > 0.3 ? 45 : 15; // cents
      vib.connect(vibDepth).connect(osc.detune);
      osc.connect(voiced);
      // breath: an "h" before the voice comes in, and a little air all the way through
      const air = ctx.createBufferSource(), airGain = ctx.createGain();
      air.buffer = this.noise;
      air.loop = true;
      airGain.gain.setValueAtTime(p.h ? 0.9 : 0.05, t0);
      voiced.gain.setValueAtTime(p.h ? 0 : 1, t0);
      if (p.h) {
        airGain.gain.linearRampToValueAtTime(0.05, t0 + p.h * 1.5);
        voiced.gain.linearRampToValueAtTime(1, t0 + p.h);
      }
      air.connect(airGain);
      FORMANT_GAINS.forEach((g, i) => {
        const band = ctx.createBiquadFilter(), level = ctx.createGain();
        band.type = 'bandpass';
        band.Q.value = 4 + i * 2;
        band.frequency.setValueCurveAtTime(p.v.map((v) => FORMANTS[v][i] * size), t0, p.len);
        level.gain.value = g;
        voiced.connect(band);
        airGain.connect(band);
        band.connect(level).connect(into);
      });
      // a little of the plain voice too, so the pitch never drops out between the formants
      const body = ctx.createBiquadFilter(), bodyLevel = ctx.createGain();
      body.type = 'lowpass';
      body.frequency.value = 1200 * size;
      bodyLevel.gain.value = 0.25;
      voiced.connect(body).connect(bodyLevel).connect(into);
      osc.start(t0);
      vib.start(t0);
      air.start(t0, Math.random());
      for (const n of [osc, vib, air]) n.stop(t1 + 0.02);
    }
  }

  /** Loops a song of the soundtrack; asking for the one already playing changes nothing. */
  music(i: number) {
    const song = SONGS_COMPILED[i % SONGS_COMPILED.length];
    if (!this.ctx || song === this.song) return;
    this.stopMusic();
    this.song = song;
    this.songStep = 0;
    this.songAt = this.t + 0.1;
    this.songTimer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    clearInterval(this.songTimer);
    this.song = undefined;
  }

  private schedule() {
    const s = this.song!, step = 60 / s.bpm / 4;
    // timers stall in a background tab: skip the missed notes instead of playing them all at once
    if (this.songAt < this.t) this.songAt = this.t + 0.05;
    while (this.songAt < this.t + 0.15) {
      if (!this.muted) this.playStep(s, this.songStep, this.songAt);
      this.songAt += step;
      this.songStep = (this.songStep + 1) % s.steps;
    }
  }

  private playStep(s: CompiledSong, i: number, t: number) {
    const sp = 60 / s.bpm / 4, n = i % 16, c = s.ch[Math.floor(i / 16) % s.ch.length], b = s.bass[n];
    if (b !== null) this.note('square', hz(36 + c.root - (c.root >= 7 ? 12 : 0) + b), t, sp * 1.5, 0.16, 700);
    const tones = [0, c.minor ? 3 : 4, 7, 12, 7, c.minor ? 3 : 4];
    this.note('square', hz(60 + c.root + tones[n % tones.length]), t, sp * 0.7, 0.035, 2400);
    const l = s.lead[i % s.steps];
    if (l) this.note(s.wave ?? 'square', hz(l.m), t, sp * l.d * 0.92, s.wave ? 0.06 : 0.075, s.wave ? 2600 : 3200, l.d >= 4);
    if (s.kick[n] === 'x') this.drum('k', t);
    if (s.snare[n] === 'x') this.drum('s', t);
    if (s.hat[n] === 'x') this.drum('h', t);
  }

  private note(type: OscillatorType, freq: number, t: number, dur: number, vol: number, cutoff: number, vibrato = false) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (vibrato) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = 5.5;
      lg.gain.value = freq * 0.012;
      l.connect(lg).connect(o.frequency);
      l.start(t + 0.12);
      l.stop(t + dur + 0.1);
    }
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(vol * 0.6, t + Math.min(dur, 0.15));
    g.gain.setValueAtTime(vol * 0.6, t + dur * 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    o.connect(f).connect(g).connect(this.mus);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  private drum(kind: 'k' | 's' | 'h', t: number) {
    const ctx = this.ctx!, g = ctx.createGain();
    g.connect(this.mus);
    if (kind === 'k') {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.2);
      return;
    }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), dur = kind === 's' ? 0.14 : 0.035;
    s.buffer = this.noise;
    f.type = 'highpass';
    f.frequency.value = kind === 's' ? 1200 : 7000;
    g.gain.setValueAtTime(kind === 's' ? 0.5 : 0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
    if (kind === 's') this.note('triangle', 190, t, 0.06, 0.25, 2000);
  }
}
