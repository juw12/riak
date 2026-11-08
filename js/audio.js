// Generated ambience: filtered water hum, bubble pops and a slow pentatonic music box. No audio files.
export class Ambience {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.music = true;
    this.volume = 0.5;
    this.timers = [];
  }

  ensure() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    // brown noise through a low-pass filter = water hum
    const len = this.ctx.sampleRate * 4;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    this.humGain = this.ctx.createGain();
    this.humGain.gain.value = 0.35;
    src.connect(lp).connect(this.humGain).connect(this.master);
    src.start();
    return true;
  }

  set({ on, music, volume }) {
    if (on !== undefined) this.on = on;
    if (music !== undefined) this.music = music;
    if (volume !== undefined) this.volume = volume;
    if (!this.on) {
      if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
      this.clear();
      return;
    }
    if (!this.ensure()) return;
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.master.gain.setTargetAtTime(this.volume * 0.6, this.ctx.currentTime, 0.4);
    this.clear();
    this.loopBubbles();
    if (this.music) this.loopMusic();
  }

  clear() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  bubble(pitch = 1) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    const f = (500 + Math.random() * 700) * pitch;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.15);
  }

  loopBubbles() {
    const next = () => {
      this.bubble();
      this.timers.push(setTimeout(next, 600 + Math.random() * 2600));
    };
    this.timers.push(setTimeout(next, 500));
  }

  note(freq, when, dur = 2.4, gain = 0.035) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(this.master);
    o.start(when);
    o.stop(when + dur + 0.1);
  }

  loopMusic() {
    // slendro-like pentatonic, slow and sparse
    const scale = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3];
    const phrase = () => {
      if (!this.on || !this.music) return;
      const t = this.ctx.currentTime + 0.05;
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.2 ? 0.5 : 1);
        this.note(f, t + i * (0.7 + Math.random() * 0.5));
      }
      this.timers.push(setTimeout(phrase, 7000 + Math.random() * 7000));
    };
    this.timers.push(setTimeout(phrase, 1500));
  }

  chime() {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    this.note(523.3, t, 1.6, 0.05);
    this.note(784, t + 0.15, 1.8, 0.04);
  }

  // a short noise burst through a filter: reel clicks, line zipping out, the splash of a cast
  noise(dur, freq, gain, type = "bandpass") {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }
  click() {
    this.noise(0.012, 3200, 0.12);
  }
  zip() {
    this.noise(0.09, 5200, 0.06, "highpass");
  }
  splash() {
    this.noise(0.35, 900, 0.18, "lowpass");
  }
}
