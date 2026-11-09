// Koi pond soundscape, generated live with Web Audio: a running stream, rain, a bamboo
// shishi-odoshi that fills and knocks, wind chimes, night crickets, and small sounds for
// taps (water drops), feeding (pellets) and koi gulping at the surface. No audio files.

const CHIME_SCALE = [1174.7, 1318.5, 1568.0, 1760.0, 1975.5, 2349.3]; // D6 E6 G6 A6 B6 D7

export const POND_LAYERS = ["stream", "rain", "fountain", "chimes", "insects"];

export class PondSound {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.volume = 0.6;
    this.layers = { stream: true, rain: false, fountain: true, chimes: true, insects: true };
    this.levels = { stream: 0.8, fountain: 0.8, chimes: 0.8, insects: 0.8 };
    this.night = false;
    this.timers = [];
    this.fadeGain = 1;
  }

  // ---------- graph ----------
  ensure() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    // pink-ish noise, shared by the stream and the rain
    const len = ctx.sampleRate * 6;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + w * 0.029591;
        b1 = 0.985 * b1 + w * 0.032534;
        b2 = 0.95 * b2 + w * 0.048056;
        d[i] = (b0 + b1 + b2 + w * 0.05) * 1.6;
      }
    }
    this.noiseBuf = buf;

    // stream: band-passed noise that swells slowly, plus a brighter trickle on top
    this.streamGain = ctx.createGain();
    this.streamGain.gain.value = 0;
    const s1 = this.loopNoise();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 650;
    bp.Q.value = 0.6;
    const s2 = this.loopNoise(1.3);
    const hp = ctx.createBiquadFilter();
    hp.type = "bandpass";
    hp.frequency.value = 2600;
    hp.Q.value = 1.4;
    const sparkle = ctx.createGain();
    sparkle.gain.value = 0.18;
    s1.connect(bp).connect(this.streamGain);
    s2.connect(hp).connect(sparkle).connect(this.streamGain);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.12;
    lfo.connect(lfoDepth).connect(sparkle.gain);
    lfo.start();
    this.streamGain.connect(this.master);

    // rain: wide band of brighter noise
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    const r = this.loopNoise(0.7);
    const rh = ctx.createBiquadFilter();
    rh.type = "highpass";
    rh.frequency.value = 900;
    const rl = ctx.createBiquadFilter();
    rl.type = "lowpass";
    rl.frequency.value = 7000;
    r.connect(rh).connect(rl).connect(this.rainGain).connect(this.master);
    return true;
  }

  loopNoise(rate = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = rate;
    src.loopStart = Math.random() * 3;
    src.start(0, Math.random() * 5);
    return src;
  }

  pan(x) {
    if (!this.ctx.createStereoPanner) return null;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, x));
    return p;
  }

  out(node, panX = 0) {
    const p = this.pan(panX);
    if (p) node.connect(p).connect(this.master);
    else node.connect(this.master);
  }

  // ---------- control ----------
  start() {
    if (!this.ensure()) return false;
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.on = true;
    this.fadeGain = 1;
    this.applyLevels();
    this.schedule();
    return true;
  }

  stop() {
    this.on = false;
    this.clear();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0, t, 0.25);
  }

  resumeIfNeeded() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  set({ volume, layers, levels, night }) {
    if (volume !== undefined) this.volume = volume;
    if (layers) this.layers = { ...this.layers, ...layers };
    if (levels) this.levels = { ...this.levels, ...levels };
    if (night !== undefined) this.night = night;
    if (this.on) {
      this.applyLevels();
      this.schedule();
    }
  }

  // per-layer mix: 0.8 is the default level, 1 is a little louder
  mix(id) {
    return Math.max(0.02, (this.levels[id] ?? 0.8) / 0.8);
  }

  applyLevels() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.on ? this.volume * 0.9 * this.fadeGain : 0, t, 0.6);
    this.streamGain.gain.setTargetAtTime(this.layers.stream ? 0.55 * this.mix("stream") : 0, t, 0.8);
    this.rainGain.gain.setTargetAtTime(this.layers.rain ? 0.34 : 0, t, 1.2);
  }

  // slow fade used by the sleep timer
  fadeOut(seconds = 30) {
    if (!this.ctx || !this.on) return;
    this.fadeGain = 0;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + seconds);
    this.timers.push(setTimeout(() => this.stop(), seconds * 1000 + 200));
  }

  clear() {
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
  }

  schedule() {
    this.clear();
    const later = (fn, min, max) => {
      const id = setTimeout(() => {
        if (!this.on) return;
        fn();
        later(fn, min, max);
      }, min + Math.random() * (max - min));
      this.timers.push(id);
    };
    if (this.layers.stream) later(() => this.trickle(), 180, 900);
    if (this.layers.rain) later(() => this.rainDrop(), 60, 260);
    // the bamboo fountain is timed by the pond view so the knock matches the drawn tube
    if (this.layers.chimes) later(() => this.chimes(), 9000, 22000);
    if (this.layers.insects && this.night) later(() => this.cricket(), 700, 1900);
    // a first gentle sound soon after starting, so the pond is audibly alive
    if (this.layers.chimes) this.timers.push(setTimeout(() => this.on && this.chimes(), 2500));
  }

  // ---------- one-shots ----------
  burst(dur, freq, gain, type = "bandpass", q = 1, panX = 0, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.01, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g);
    this.out(g, panX);
    src.start(t, Math.random() * 4, dur + 0.05);
  }

  tone(freq, dur, gain, { type = "sine", to = null, panX = 0, when = 0, attack = 0.005 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    this.out(g, panX);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  trickle() {
    const f = 1800 + Math.random() * 3200;
    this.burst(0.03 + Math.random() * 0.05, f, 0.025 + Math.random() * 0.02, "bandpass", 8, Math.random() * 1.4 - 0.7);
  }

  rainDrop() {
    this.burst(0.02, 3000 + Math.random() * 4000, 0.03, "bandpass", 6, Math.random() * 2 - 1);
  }

  // the bamboo arm fills with a rising trickle, tips, knocks on the stone and pours out
  shishiOdoshi() {
    if (!this.ctx) return;
    const m = this.mix("fountain");
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 9;
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(1500, t + 4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 * m, t + 1);
    g.gain.setValueAtTime(0.05 * m, t + 3.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.1);
    src.connect(f).connect(g);
    this.out(g, 0.55);
    src.start(t, 0, 4.3);
    // the knock: hollow wood body plus a sharp click
    this.tone(210, 0.22, 0.22 * m, { when: 4.1, to: 170, panX: 0.55 });
    this.tone(420, 0.09, 0.08 * m, { when: 4.1, type: "triangle", panX: 0.55 });
    this.burst(0.05, 1300, 0.22 * m, "bandpass", 5, 0.55, 4.1);
    this.tone(205, 0.14, 0.07 * m, { when: 4.33, to: 175, panX: 0.55 });
    // water pouring off into the pond
    this.burst(0.7, 900, 0.07 * m, "lowpass", 0.7, 0.45, 4.15);
  }

  chimes() {
    const n = 2 + Math.floor(Math.random() * 3);
    const panX = Math.random() * 1.6 - 0.8;
    for (let i = 0; i < n; i++) {
      const f = CHIME_SCALE[Math.floor(Math.random() * CHIME_SCALE.length)];
      const when = i * (0.18 + Math.random() * 0.35);
      const dur = 3.5 + Math.random() * 2.5;
      this.tone(f, dur, 0.022 * this.mix("chimes"), { when, panX, attack: 0.004 });
      this.tone(f * 2.76, dur * 0.5, 0.006 * this.mix("chimes"), { when, panX, attack: 0.004 });
    }
  }

  cricket() {
    const panX = Math.random() * 1.8 - 0.9;
    const pulses = 3 + Math.floor(Math.random() * 2);
    const f = 4300 + Math.random() * 500;
    for (let i = 0; i < pulses; i++) this.tone(f, 0.022, 0.012 * this.mix("insects"), { when: i * 0.045, panX, attack: 0.002 });
  }

  // ---------- interaction sounds (x is -1 left to 1 right) ----------
  plop(x = 0, size = 1) {
    if (!this.on || !this.ctx) return;
    const base = 420 + Math.random() * 180;
    this.tone(base / size, 0.16, 0.12, { to: (base * 2.4) / size, panX: x });
    this.burst(0.12, 1200, 0.05, "lowpass", 0.8, x);
  }

  drip(x = 0) {
    if (!this.on || !this.ctx) return;
    this.tone(900 + Math.random() * 400, 0.08, 0.05, { to: 2000, panX: x });
  }

  pellet(x = 0) {
    if (!this.on || !this.ctx) return;
    this.burst(0.025, 4200, 0.04, "bandpass", 4, x);
  }

  gulp(x = 0) {
    if (!this.on || !this.ctx) return;
    this.tone(150, 0.11, 0.1, { to: 260, panX: x });
    this.burst(0.06, 700, 0.04, "lowpass", 1, x, 0.02);
  }

  swish(x = 0) {
    if (!this.on || !this.ctx) return;
    this.burst(0.18, 1100, 0.025, "bandpass", 1.2, x);
  }
}
