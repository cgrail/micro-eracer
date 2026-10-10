/** All sounds are synthesised with WebAudio (plus the browser's speech voice for shouts), so nothing is downloaded. */

const RAMMER_SHOUTS = ['Out of my way!', 'Gotcha!', 'Yee-haw!', 'Beep beep!', 'Coming through!', 'Ha ha!', 'Move it!'];
const VICTIM_SHOUTS = ['Hey!', 'Ouch!', 'Watch it!', 'No way!', 'My battery!', 'Not cool!'];
// formant frequencies of a few vowels, for cartoon screams ("aaah", "eee", "ooh")
const VOWELS = [[800, 1150, 2900], [300, 2300, 3000], [450, 800, 2830]];

export class Sound {
  muted = false;
  private ctx?: AudioContext;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private engine?: { osc: OscillatorNode; osc2: OscillatorNode; filter: BiquadFilterNode; gain: GainNode };
  private skid?: GainNode;
  private drone?: { osc: OscillatorNode; gain: GainNode };
  private lastShout = 0;

  /** Must run inside a user gesture (the Play button), or mobile browsers stay silent. */
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.6, this.ctx.currentTime, 0.05);
    if (muted) speechSynthesis?.cancel();
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

  /** A cartoon "Waaah!" from a formant-filtered sawtooth with a pitch wobble. */
  scream(vol = 1) {
    if (!this.ctx || vol < 0.05) return;
    const t = this.t, base = 300 + Math.random() * 250, length = 0.75 + Math.random() * 0.3;
    const osc = this.ctx.createOscillator(), lfo = this.ctx.createOscillator(), depth = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.linearRampToValueAtTime(base * 1.7, t + 0.09);
    osc.frequency.exponentialRampToValueAtTime(base * 0.75, t + length);
    lfo.frequency.value = 8 + Math.random() * 4;
    depth.gain.value = base * 0.06;
    lfo.connect(depth).connect(osc.frequency);
    const out = this.env(0.5 * vol, 0.03, length);
    VOWELS[Math.floor(Math.random() * VOWELS.length)].forEach((f, i) => {
      const band = this.ctx!.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = f;
      band.Q.value = 6 + i * 3;
      const g = this.ctx!.createGain();
      g.gain.value = [1, 0.5, 0.25][i] * 3;
      osc.connect(band).connect(g).connect(out);
    });
    osc.start();
    lfo.start();
    osc.stop(t + length + 0.05);
    lfo.stop(t + length + 0.05);
  }

  /** A spoken shout in a squeaky comic voice; skipped while another is still fresh. */
  shout(rammer: boolean) {
    if (this.muted || typeof speechSynthesis === 'undefined' || performance.now() - this.lastShout < 2500) return;
    this.lastShout = performance.now();
    const lines = rammer ? RAMMER_SHOUTS : VICTIM_SHOUTS;
    const u = new SpeechSynthesisUtterance(lines[Math.floor(Math.random() * lines.length)]);
    u.lang = 'en-US';
    u.pitch = 1.5 + Math.random() * 0.5;
    u.rate = 1.35;
    u.volume = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
}
