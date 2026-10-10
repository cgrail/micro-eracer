import { type CompiledSong, hz, SONGS_COMPILED } from './songs.ts';

/** Effects and music are synthesised with WebAudio; only the Racers' voices are recordings (`public/voices`, CC0, see its CREDITS.md). */

/** What a Racer cries out: a laugh or a cheer after a Ram, "ow!" when hit, a scream when thrown about, "nooo!" when running dry. */
const CLIPS = {
  gloat: ['laugh-cute', 'laugh-cartoon', 'laugh-taunt', 'woohoo', 'wouhouh', 'yahoo'],
  hurt: ['ouch', 'oww', 'oww-2', 'oof'],
  thrown: ['scream-wow', 'waaah', 'scream-short'],
  despair: ['nooo', 'nooo-2'],
};
export type Mood = keyof typeof CLIPS;
// every Seat sounds like someone else: the same recordings played a little faster (higher) or slower (deeper)
const VOICE_RATES = [1, 0.88, 1.16, 0.95, 1.08, 0.84, 1.24, 0.92];

export class Sound {
  muted = false;
  private ctx?: AudioContext;
  private master!: GainNode;
  private mus!: GainNode;
  private noise!: AudioBuffer;
  private voices: Partial<Record<Mood, AudioBuffer[]>> = {};
  private engine?: { rumble: BiquadFilterNode; rush: BiquadFilterNode; gain: GainNode };
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
      // about as loud as the voices and above the effects (measured offline)
      this.mus.gain.value = 0.7;
      this.mus.connect(this.master);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.loadVoices();
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

  /** The airflow and tyre skid of our own E-Car, updated every frame: no motor hum, just wind that rises with speed. */
  drive(speed: number, throttle: number, skid: number) {
    if (!this.ctx) return;
    if (!this.engine) {
      const ctx = this.ctx, gain = ctx.createGain(), rumble = ctx.createBiquadFilter(), rush = ctx.createBiquadFilter();
      const noise = (rate: number) => { const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true; src.playbackRate.value = rate; src.start(); return src; };
      // two loops of the noise at different rates, so its repeat is never heard
      rumble.type = 'lowpass';
      rush.type = 'bandpass';
      rush.Q.value = 0.8;
      noise(1).connect(rumble).connect(gain);
      noise(0.83).connect(rush).connect(gain);
      gain.gain.value = 0;
      gain.connect(this.master);
      this.engine = { rumble, rush, gain };
      const src = noise(1), band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1400;
      band.Q.value = 2;
      this.skid = ctx.createGain();
      this.skid.gain.value = 0;
      src.connect(band).connect(this.skid).connect(this.master);
    }
    // the wind opens up and gets louder with speed (roughly with its square, like real drag), a little more under power;
    // kept quiet, just there to be heard in the background
    const k = Math.min(1, Math.abs(speed) / 22);
    this.engine.rumble.frequency.setTargetAtTime(180 + k * 520, this.t, 0.12);
    this.engine.rush.frequency.setTargetAtTime(500 + k * 1700, this.t, 0.12);
    this.engine.gain.gain.setTargetAtTime(0.003 + k * k * 0.08 + Math.max(0, throttle) * k * 0.01, this.t, 0.15);
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

  private loadVoices() {
    for (const [mood, names] of Object.entries(CLIPS) as [Mood, string[]][]) {
      const load = (name: string) => fetch(`${import.meta.env.BASE_URL}voices/${mood}-${name}.mp3`)
        .then((r) => r.arrayBuffer()).then((data) => this.ctx!.decodeAudioData(data))
        // shortcut: a clip that fails to load is never heard; the others still are
        .catch(() => undefined);
      void Promise.all(names.map(load)).then((list) => (this.voices[mood] = list.filter((b) => b !== undefined)));
    }
  }

  /** A Racer cries out in their own voice, at most once a second each. Full volume means it's about our own E-Car. */
  cry(mood: Mood, seat: number, vol = 1, delay = 0) {
    const clips = this.voices[mood];
    if (!this.ctx || !clips?.length || seat < 0 || this.t < (this.lastCry[seat] ?? -9) + 1) return;
    // the others' cries are rationed, so the ones about us always stand out
    if (vol < 1 && (vol < 0.4 || this.t < this.lastOtherCry + 0.8)) return;
    if (vol < 1) this.lastOtherCry = this.t;
    this.lastCry[seat] = this.t;
    const src = this.ctx.createBufferSource(), gain = this.ctx.createGain();
    src.buffer = clips[Math.floor(Math.random() * clips.length)];
    // a little wobble too, so the same clip never sounds quite the same twice
    src.playbackRate.value = VOICE_RATES[seat % VOICE_RATES.length] * (0.96 + Math.random() * 0.08);
    gain.gain.value = vol;
    src.connect(gain).connect(this.master);
    src.start(this.t + delay);
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
