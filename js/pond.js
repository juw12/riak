// Koi pond: a top-down relax view. Koi with flowing bodies drift through a stone-edged pond;
// tap the water for ripples, hold to drop food, drag to lead them, tap a koi to meet it.
// Day, dusk and night moods, rain, a bamboo shishi-odoshi, a sleep timer and a calm mode that
// hides every control. Sound comes from pondaudio.js and is generated live.
import * as core from "./core.js";
import { t } from "./i18n.js";
import { el } from "./util.js";
import { icon, button, segmented, openSheet, toast } from "./ui.js";
import { PondSound } from "./pondaudio.js";

const TAU = Math.PI * 2;
const SPINE = 12;
const WIDTHS = [0.62, 0.86, 0.98, 1, 0.96, 0.88, 0.76, 0.62, 0.48, 0.35, 0.24, 0.15];
const MOODS = ["auto", "day", "dusk", "night"];
const COUNTS = [5, 9, 13];
const TIMERS = [0, 10, 20, 30];
const SOUND_LAYERS = ["stream", "fountain", "chimes", "insects"];

// koi varieties: base colour, pattern colours and how the pattern is laid out
const VARIETIES = {
  kohaku: { base: "#f4efe6", spots: ["#d4432c"], fin: "#f7f1e8" },
  sanke: { base: "#f4efe6", spots: ["#d4432c", "#1f2224"], fin: "#f7f1e8" },
  showa: { base: "#1f2224", spots: ["#d4432c", "#f4efe6"], fin: "#2b2e30" },
  ogon: { base: "#e3ad48", spots: [], fin: "#efc673", metal: true },
  asagi: { base: "#8fa6b2", spots: [], fin: "#c9d4d8", sides: "#d96a3a", net: "#5f7884" },
  tancho: { base: "#f4efe6", spots: [], fin: "#f7f1e8", crown: "#d4432c" },
  chagoi: { base: "#8b6a49", spots: [], fin: "#a88a69", net: "#6e5236" },
  yamabuki: { base: "#efc84e", spots: [], fin: "#f6dc87", metal: true },
  kujaku: { base: "#ece6da", spots: ["#e07a32"], fin: "#f1ebe0", net: "#7d878a", metal: true },
};
const ORDER = ["kohaku", "ogon", "sanke", "showa", "asagi", "tancho", "chagoi", "yamabuki", "kujaku", "kohaku", "sanke", "ogon", "showa"];
const NAMES = ["Hana", "Sora", "Kumo", "Tama", "Yuki", "Kiku", "Ume", "Taro", "Momo", "Nori", "Rin", "Kaze", "Mizu"];
const LEAVES = [
  { kind: "maple", color: "#d9572b" },
  { kind: "maple", color: "#e2892f" },
  { kind: "maple", color: "#c9412d" },
  { kind: "ginkgo", color: "#e7c14a" },
  { kind: "blossom", color: "#f3ead8" },
];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// older Safari has no roundRect; a plain rounded path is enough here
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    this.moveTo(x + rr, y);
    this.arcTo(x + w, y, x + w, y + h, rr);
    this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr);
    this.arcTo(x, y, x + w, y, rr);
    this.closePath();
  };
}
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function pondState() {
  const s = core.S();
  const p = (s.pond = Object.assign({ sound: true, volume: 0.6, mood: "auto", rain: false, count: 9, timer: 0, minutes: 0, fed: 0, met: [], hintSeen: false }, s.pond || {}));
  p.layers = Object.assign({ stream: true, fountain: true, chimes: true, insects: true }, p.layers || {});
  p.levels = Object.assign({ stream: 0.8, fountain: 0.8, chimes: 0.8, insects: 0.8 }, p.levels || {});
  if (!Array.isArray(p.met)) p.met = [];
  return p;
}

export function moodNow(mood, date = new Date()) {
  if (mood !== "auto") return mood;
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 6.5 && h < 17) return "day";
  if ((h >= 17 && h < 19) || (h >= 5.5 && h < 6.5)) return "dusk";
  return "night";
}

export class PondPanel {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.visible = false;
    this.koi = [];
    this.ripples = [];
    this.pellets = [];
    this.leaves = [];
    this.pads = [];
    this.flies = [];
    this.press = null;
    this.follow = null;
    this.sound = new PondSound();
    this.mutedAmbience = false;
    this.raf = 0;
    this.time = 0;
    this.interactions = 0;
    this.eaten = 0;
    this.fountain = null;
    this.fountainTimer = 0;
    this.sleepAt = 0;
  }

  // ---------- DOM ----------
  init() {
    pondState();
    const root = this.root;
    root.innerHTML = "";
    this.canvas = el("canvas", { class: "pond-canvas", role: "img", "aria-label": t("pond.canvas"), tabindex: "0" });
    this.ctx = this.canvas.getContext("2d");
    this.hint = el("p", { class: "pond-hint", text: t("pond.hint") });
    this.eyeBtn = button("", { icon: "eye", kind: "icon pond-eye", title: t("pond.hide"), onclick: () => this.toggleCalm() });
    this.eyeBtn.setAttribute("aria-label", t("pond.hide"));
    this.dock = el("div", { class: "pond-dock", role: "toolbar", "aria-label": t("pond.controls") });
    this.stage = el("div", { class: "pond-stage" }, [this.canvas, this.hint, this.eyeBtn, this.dock]);
    this.statEl = el("p", { class: "muted pond-stat" });
    const head = el("div", { class: "pond-head" }, [
      el("div", {}, [el("h2", { text: t("pond.title") }), el("p", { class: "muted", text: t("pond.lead") })]),
      this.statEl,
    ]);
    root.append(el("div", { class: "pond-layout" }, [head, this.stage]));
    this.bindPointer();
    // controls fade away when nobody is touching the pond and come back on any movement
    this.wake = () => {
      this.stage.classList.remove("idle");
      clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => this.visible && this.stage.classList.add("idle"), 10000);
    };
    for (const type of ["pointermove", "pointerdown", "focusin"]) this.stage.addEventListener(type, this.wake);
    this.onKey = (e) => this.key(e);
    this.onResize = () => this.visible && this.resize();
    this.onVisibility = () => {
      if (!this.visible) return;
      if (document.hidden) this.sound.stop();
      else if (pondState().sound) this.startSound();
    };
    this.renderDock();
    this.renderStat();
  }

  renderDock() {
    const p = pondState();
    const d = this.dock;
    d.innerHTML = "";
    const tool = (label, ic, onclick, pressed) => {
      const b = button(label, { icon: ic, kind: "quiet", onclick, pressed });
      b.setAttribute("aria-label", label);
      return b;
    };
    d.append(
      tool(p.sound ? t("pond.soundOn") : t("pond.soundOff"), "sound", () => this.toggleSound(), p.sound),
      tool(t("pond.feed"), "feed", () => this.scatterFood()),
      tool(t("pond.moodBtn", { mood: t("pond.mood." + p.mood) }), p.mood === "night" || (p.mood === "auto" && moodNow("auto") === "night") ? "moon" : "sun", () => this.cycleMood()),
      tool(t("pond.rain"), "drop", () => this.toggleRain(), p.rain),
      tool(t("pond.mixer"), "wave", () => this.openMixer()),
    );
  }

  renderStat() {
    const p = pondState();
    const vars = { min: p.minutes, fed: p.fed, met: p.met.length, total: Math.min(NAMES.length, p.count) };
    let text = t(p.minutes < 1 ? "pond.statsFresh" : "pond.stats", vars);
    if (this.sleepAt) text += " · " + t("pond.sleepLeft", { n: Math.max(1, Math.ceil((this.sleepAt - Date.now()) / 60000)) });
    this.statEl.textContent = text;
  }

  // ---------- lifecycle ----------
  show() {
    this.visible = true;
    this.resize();
    this.buildKoi();
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVisibility);
    if (pondState().sound) this.startSound();
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame((ts) => this.frame(ts));
    clearInterval(this.secTimer);
    this.secs = 0;
    this.secTimer = setInterval(() => this.everySecond(), 1000);
    this.scheduleFountain();
    this.hint.hidden = false;
    this.hint.classList.toggle("gone", pondState().hintSeen);
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.hint.classList.add("gone"), 6000);
    this.wake();
    this.renderDock();
    this.renderStat();
  }

  hide() {
    this.visible = false;
    cancelAnimationFrame(this.raf);
    clearInterval(this.secTimer);
    clearTimeout(this.fountainTimer);
    clearTimeout(this.hintTimer);
    clearTimeout(this.idleTimer);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.sound.stop();
    this.restoreAmbience();
    this.setCalm(false);
    this.press = null;
  }

  refresh() {
    if (this.visible) {
      this.renderDock();
      this.renderStat();
    }
  }

  everySecond() {
    if (!this.visible || document.hidden) return;
    this.secs++;
    const p = pondState();
    if (this.secs % 60 === 0) {
      p.minutes++;
      core.changed();
      this.renderStat();
    }
    if (this.sleepAt && Date.now() >= this.sleepAt) {
      this.sleepAt = 0;
      p.timer = 0;
      this.sound.fadeOut(30);
      this.dim = 0.001;
      toast(t("pond.sleepDone"));
      this.renderStat();
    } else if (this.sleepAt && this.secs % 15 === 0) this.renderStat();
    // the auto mood follows the clock, so recheck it now and then
    if (this.secs % 30 === 0 && p.mood === "auto") this.applyNight();
  }

  // ---------- sound ----------
  startSound() {
    const p = pondState();
    this.sound.set({ volume: p.volume, layers: { ...p.layers, rain: p.rain }, levels: p.levels, night: this.mood() === "night" });
    if (this.sound.start()) this.muteAmbience();
  }
  muteAmbience() {
    const snd = core.S().sound;
    if (snd && snd.on && !this.mutedAmbience) {
      this.app.audio.set({ on: false });
      this.mutedAmbience = true;
    }
  }
  restoreAmbience() {
    if (!this.mutedAmbience) return;
    const snd = core.S().sound;
    this.app.audio.set({ on: snd.on, music: snd.music, volume: snd.vol });
    this.mutedAmbience = false;
  }
  toggleSound() {
    const p = pondState();
    p.sound = !p.sound;
    core.changed();
    if (p.sound) this.startSound();
    else {
      this.sound.stop();
      this.restoreAmbience();
    }
    this.renderDock();
  }
  applyNight() {
    const p = pondState();
    this.sound.set({ night: this.mood() === "night", layers: { ...p.layers, rain: p.rain } });
    this.renderDock();
  }
  mood() {
    return moodNow(pondState().mood);
  }
  cycleMood() {
    const p = pondState();
    p.mood = MOODS[(MOODS.indexOf(p.mood) + 1) % MOODS.length];
    core.changed();
    this.applyNight();
    toast(t("pond.moodNow", { mood: t("pond.mood." + this.mood()) }));
  }
  toggleRain() {
    const p = pondState();
    p.rain = !p.rain;
    core.changed();
    this.applyNight();
  }
  setTimer(min) {
    const p = pondState();
    p.timer = min;
    this.sleepAt = min ? Date.now() + min * 60000 : 0;
    this.dim = 0;
    if (min && p.sound && !this.sound.on) this.startSound();
    core.changed();
    this.renderStat();
  }

  openMixer() {
    const p = pondState();
    openSheet({
      title: t("pond.mixer"),
      body: (body) => {
        const vol = el("input", { type: "range", min: "0", max: "1", step: "0.05", value: String(p.volume), "aria-label": t("pond.volume") });
        vol.addEventListener("input", () => {
          p.volume = Number(vol.value);
          this.sound.set({ volume: p.volume });
          core.changed();
        });
        const layers = el("div", { class: "pond-layers" });
        for (const id of SOUND_LAYERS) {
          const level = p.layers[id] ? p.levels[id] : 0;
          const slider = el("input", { type: "range", min: "0", max: "1", step: "0.05", value: String(level), "aria-label": t("pond.layer." + id) });
          const readout = el("span", { class: "pond-layer-val", text: Math.round(level * 100) + "%" });
          slider.addEventListener("input", () => {
            const v = Number(slider.value);
            p.layers[id] = v > 0;
            if (v > 0) p.levels[id] = v;
            readout.textContent = Math.round(v * 100) + "%";
            this.sound.set({ layers: { ...p.layers, rain: p.rain }, levels: p.levels });
            core.changed();
          });
          layers.append(el("label", { class: "pond-layer-row" }, [el("span", { text: t("pond.layer." + id) }), slider, readout]));
        }
        body.append(
          el("p", { class: "explain", text: t("pond.mixerLead") }),
          el("h3", { text: t("pond.volume") }),
          vol,
          el("h3", { text: t("pond.layers") }),
          layers,
          el("p", { class: "muted", text: t("pond.insectsNote") }),
          el("h3", { text: t("pond.moodTitle") }),
          segmented(MOODS.map((m) => ({ id: m, label: t("pond.mood." + m) })), p.mood, (m) => {
            p.mood = m;
            core.changed();
            this.applyNight();
          }, t("pond.moodTitle")),
          el("h3", { text: t("pond.count") }),
          segmented(COUNTS.map((n) => ({ id: n, label: String(n) })), p.count, (n) => {
            p.count = n;
            core.changed();
            this.buildKoi();
            this.renderStat();
          }, t("pond.count")),
          el("h3", { text: t("pond.sleep") }),
          segmented(TIMERS.map((n) => ({ id: n, label: n ? t("unit.min", { n }) : t("pond.sleepOff") })), p.timer || 0, (n) => this.setTimer(n), t("pond.sleep")),
          el("p", { class: "muted", text: t("pond.keys") }),
        );
      },
    });
  }

  // ---------- calm mode ----------
  toggleCalm() {
    this.setCalm(!document.body.classList.contains("pond-calm"));
  }
  setCalm(on) {
    document.body.classList.toggle("pond-calm", on);
    if (this.eyeBtn) {
      const label = on ? t("pond.show") : t("pond.hide");
      this.eyeBtn.title = label;
      this.eyeBtn.setAttribute("aria-label", label);
    }
    if (this.visible) requestAnimationFrame(() => this.resize());
  }

  key(e) {
    if (!this.visible || e.target.closest?.("input, textarea, select, button, .sheet")) return;
    const k = e.key.toLowerCase();
    this.wake();
    if (k === " ") {
      e.preventDefault();
      const a = Math.random() * TAU;
      this.tap(this.cx + Math.cos(a) * this.rx * 0.4 * Math.random(), this.cy + Math.sin(a) * this.ry * 0.4 * Math.random());
    } else if (k === "f") this.scatterFood();
    else if (k === "r") this.toggleRain();
    else if (k === "m") this.cycleMood();
    else if (k === "h") this.toggleCalm();
    else if (k === "escape" && document.body.classList.contains("pond-calm")) this.setCalm(false);
  }

  // ---------- geometry and static layers ----------
  resize() {
    const r = this.stage.getBoundingClientRect();
    const W = Math.max(280, Math.round(r.width));
    const H = Math.max(300, Math.round(r.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = W + "px";
    this.canvas.style.height = H + "px";
    const m = clamp(Math.min(W, H) * 0.075, 22, 64);
    this.cx = W / 2;
    this.cy = H / 2;
    this.rx = W / 2 - m;
    this.ry = H / 2 - m;
    // koi scale with the pond area so a wide desktop pond does not leave them tiny
    this.L = clamp(Math.max(Math.min(W, H) * 0.17, Math.sqrt(W * H) * 0.13), 58, 160);
    const seed = rng(7);
    this.outline = [];
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * TAU;
      const k = 1 + 0.035 * Math.sin(3 * a + 1.3) + 0.022 * Math.sin(7 * a + 0.4) + 0.012 * Math.sin(13 * a);
      this.outline.push({ a, x: this.cx + Math.cos(a) * this.rx * k, y: this.cy + Math.sin(a) * this.ry * k, k });
    }
    this.spout = this.edgePoint(-0.42, -6);
    this.shishi = this.edgePoint(0.22, -4);
    this.lanterns = [this.edgePoint(-2.45, 34), this.edgePoint(0.85, 34)];
    this.buildFloor();
    this.buildRim();
    this.buildCaustics();
    this.buildPads();
    this.buildCanopy();
    for (const k of this.koi) this.keepInside(k, true);
  }

  edgePoint(a, out) {
    const k = 1 + 0.035 * Math.sin(3 * a + 1.3) + 0.022 * Math.sin(7 * a + 0.4) + 0.012 * Math.sin(13 * a);
    const ex = Math.cos(a) * this.rx * k;
    const ey = Math.sin(a) * this.ry * k;
    const n = Math.hypot(ex / (this.rx * this.rx), ey / (this.ry * this.ry)) || 1;
    const nx = ex / (this.rx * this.rx) / n;
    const ny = ey / (this.ry * this.ry) / n;
    return { x: this.cx + ex + nx * out, y: this.cy + ey + ny * out, nx, ny, a };
  }

  pondPath(ctx, grow = 0) {
    ctx.beginPath();
    const pts = this.outline;
    for (let i = 0; i <= pts.length; i++) {
      const p = pts[i % pts.length];
      const x = this.cx + (p.x - this.cx) * (1 + grow / this.rx);
      const y = this.cy + (p.y - this.cy) * (1 + grow / this.ry);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  offscreen() {
    const c = document.createElement("canvas");
    c.width = Math.round(this.W * this.dpr);
    c.height = Math.round(this.H * this.dpr);
    const g = c.getContext("2d");
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    return [c, g];
  }

  buildFloor() {
    const [c, g] = this.offscreen();
    const R = rng(11);
    const { W, H } = this;
    // ground around the pond: moss and gravel
    const ground = g.createLinearGradient(0, 0, W, H);
    ground.addColorStop(0, "#5d6a45");
    ground.addColorStop(1, "#4b5838");
    g.fillStyle = ground;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 28; i++) {
      const x = R() * W;
      const y = R() * H;
      const r = 50 + R() * 140;
      const patch = g.createRadialGradient(x, y, 0, x, y, r);
      patch.addColorStop(0, R() < 0.6 ? "rgba(36,54,28,0.32)" : "rgba(160,156,112,0.16)");
      patch.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = patch;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < (W * H) / 260; i++) {
      g.fillStyle = R() < 0.5 ? "rgba(214,204,176,0.16)" : "rgba(40,52,30,0.22)";
      g.beginPath();
      g.arc(R() * W, R() * H, 0.6 + R() * 1.8, 0, TAU);
      g.fill();
    }
    // pond floor
    g.save();
    this.pondPath(g);
    g.clip();
    // elliptical gradient that follows the pond shape
    const ellipse = (stops, ox = 0, oy = 0) => {
      g.save();
      g.translate(this.cx + ox, this.cy + oy);
      g.scale(this.rx, this.ry);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const [at, color] of stops) grad.addColorStop(at, color);
      g.fillStyle = grad;
      g.fillRect(-1.3, -1.3, 2.6, 2.6);
      g.restore();
    };
    // a sandy shallow shelf at the rim falling away to a deep green-blue middle
    ellipse([[0, "#143f43"], [0.45, "#1d5753"], [0.76, "#2d6c61"], [0.92, "#5a876b"], [1, "#7d9874"]], this.rx * 0.05, this.ry * 0.04);
    // pebbles, more of them and lighter toward the shallow edge
    const n = Math.round((this.rx * this.ry) / 90);
    for (let i = 0; i < n; i++) {
      const a = R() * TAU;
      const rr = Math.sqrt(R());
      const x = this.cx + Math.cos(a) * this.rx * rr;
      const y = this.cy + Math.sin(a) * this.ry * rr;
      const s = 1.5 + R() * 4.5 * (0.5 + rr);
      const tone = Math.round(70 + R() * 60 + rr * 40);
      g.fillStyle = `rgba(${tone},${tone + 8},${tone - 4},${0.12 + rr * 0.22})`;
      g.beginPath();
      g.ellipse(x, y, s, s * (0.6 + R() * 0.4), R() * TAU, 0, TAU);
      g.fill();
    }
    // submerged grass along the margin
    g.strokeStyle = "rgba(70,120,70,0.35)";
    g.lineWidth = 1.6;
    g.lineCap = "round";
    for (let i = 0; i < 160; i++) {
      const p = this.outline[Math.floor(R() * this.outline.length)];
      const ix = this.cx + (p.x - this.cx) * (0.9 + R() * 0.08);
      const iy = this.cy + (p.y - this.cy) * (0.9 + R() * 0.08);
      const ang = Math.atan2(this.cy - iy, this.cx - ix) + (R() - 0.5) * 1.2;
      const len = 8 + R() * 18;
      g.beginPath();
      g.moveTo(ix, iy);
      g.quadraticCurveTo(ix + Math.cos(ang + 0.5) * len * 0.5, iy + Math.sin(ang + 0.5) * len * 0.5, ix + Math.cos(ang) * len, iy + Math.sin(ang) * len);
      g.stroke();
    }
    // depth: the middle reads deeper and cooler
    ellipse([[0, "rgba(6,22,30,0.5)"], [0.5, "rgba(6,22,30,0.22)"], [1, "rgba(6,22,30,0)"]], this.rx * 0.05, this.ry * 0.04);
    // the bank throws a soft shade onto the water along the upper left
    g.save();
    g.translate(9, 12);
    for (const [width, alpha] of [[54, 0.06], [36, 0.07], [20, 0.08], [8, 0.1]]) {
      this.pondPath(g);
      g.lineWidth = width;
      g.strokeStyle = `rgba(4,20,20,${alpha})`;
      g.stroke();
    }
    g.restore();
    g.restore();
    this.floor = c;
  }

  buildRim() {
    const [c, g] = this.offscreen();
    const R = rng(23);
    // a soft dark band where the water meets the stones
    g.save();
    this.pondPath(g, 2);
    g.lineWidth = 10;
    g.strokeStyle = "rgba(12,32,30,0.35)";
    g.stroke();
    g.restore();
    const total = this.outline.length;
    let i = 0;
    while (i < total) {
      const p = this.outline[i];
      const q = this.outline[(i + 1) % total];
      const tang = Math.atan2(q.y - p.y, q.x - p.x);
      const out = 6 + R() * 10;
      const nx = (p.x - this.cx) / this.rx;
      const ny = (p.y - this.cy) / this.ry;
      const nl = Math.hypot(nx, ny) || 1;
      const x = p.x + (nx / nl) * out;
      const y = p.y + (ny / nl) * out;
      const big = R() < 0.12;
      const rw = (12 + R() * 18) * (big ? 1.55 : 1);
      const rh = rw * (0.55 + R() * 0.3);
      // granite greys, a cooler blue-grey and a warm tan, each a little different
      const base = [[150, 146, 136], [128, 136, 140], [158, 146, 122], [138, 134, 126]][Math.floor(R() * 4)];
      const lift = (R() - 0.5) * 30;
      const [cr, cg, cb] = base.map((v) => Math.round(v + lift));
      g.fillStyle = "rgba(18,22,16,0.38)";
      g.beginPath();
      g.ellipse(x + 3, y + 5, rw * 1.02, rh, tang, 0, TAU);
      g.fill();
      const sg = g.createRadialGradient(x - rw * 0.35, y - rh * 0.45, 1, x, y, rw * 1.15);
      sg.addColorStop(0, `rgb(${cr + 46},${cg + 44},${cb + 38})`);
      sg.addColorStop(0.55, `rgb(${cr},${cg},${cb})`);
      sg.addColorStop(1, `rgb(${cr - 46},${cg - 46},${cb - 44})`);
      g.fillStyle = sg;
      g.beginPath();
      g.ellipse(x, y, rw, rh, tang, 0, TAU);
      g.fill();
      if (R() < 0.4) {
        g.fillStyle = R() < 0.5 ? "rgba(98,128,64,0.6)" : "rgba(122,140,70,0.5)";
        g.beginPath();
        g.ellipse(x - rw * 0.25, y - rh * 0.3, rw * 0.45, rh * 0.3, tang + 0.3, 0, TAU);
        g.fill();
      }
      i += 1 + Math.floor(R() * 2);
    }
    // grass tufts on the bank
    g.lineWidth = 1.4;
    const greens = ["rgba(120,150,80,0.55)", "rgba(96,132,66,0.6)", "rgba(146,164,92,0.5)", "rgba(80,112,58,0.6)"];
    for (let k = 0; k < 170; k++) {
      g.strokeStyle = greens[k % greens.length];
      const p = this.outline[Math.floor(R() * total)];
      const nx = p.x - this.cx;
      const ny = p.y - this.cy;
      const nl = Math.hypot(nx, ny) || 1;
      const off = 26 + R() * 30;
      const x = p.x + (nx / nl) * off;
      const y = p.y + (ny / nl) * off;
      for (let b = 0; b < 4; b++) {
        const a = -Math.PI / 2 + (R() - 0.5) * 1.6;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * (5 + R() * 7), y + Math.sin(a) * (5 + R() * 7));
        g.stroke();
      }
    }
    // stone lanterns, seen from above
    for (const l of this.lanterns) {
      if (l.x < 18 || l.y < 18 || l.x > this.W - 18 || l.y > this.H - 18) continue;
      g.fillStyle = "rgba(20,24,18,0.35)";
      g.fillRect(l.x - 13, l.y - 9, 30, 30);
      g.fillStyle = "#8f8b82";
      g.beginPath();
      g.roundRect(l.x - 16, l.y - 16, 32, 32, 6);
      g.fill();
      g.fillStyle = "#a7a297";
      g.beginPath();
      g.roundRect(l.x - 10, l.y - 10, 20, 20, 4);
      g.fill();
      g.fillStyle = "#5e5a52";
      g.beginPath();
      g.arc(l.x, l.y, 3, 0, TAU);
      g.fill();
    }
    // bamboo pipe feeding the pond (kakei)
    const s = this.spout;
    g.save();
    g.translate(s.x, s.y);
    g.rotate(Math.atan2(-s.ny, -s.nx));
    g.fillStyle = "rgba(20,24,18,0.3)";
    g.fillRect(-64, -3, 66, 12);
    const bam = g.createLinearGradient(0, -6, 0, 6);
    bam.addColorStop(0, "#9cae5c");
    bam.addColorStop(1, "#6f8540");
    g.fillStyle = bam;
    g.beginPath();
    g.roundRect(-70, -6, 72, 12, 5);
    g.fill();
    g.fillStyle = "rgba(60,80,30,0.6)";
    g.fillRect(-46, -6, 2.5, 12);
    g.fillRect(-20, -6, 2.5, 12);
    g.restore();
    // basin stone under the shishi-odoshi
    const b = this.edgePoint(0.22, 22);
    g.fillStyle = "#8a867c";
    g.beginPath();
    g.ellipse(b.x, b.y, 20, 16, 0.3, 0, TAU);
    g.fill();
    g.fillStyle = "#4c5a4c";
    g.beginPath();
    g.ellipse(b.x, b.y, 11, 8, 0.3, 0, TAU);
    g.fill();
    this.rim = c;
  }

  buildCaustics() {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const g = c.getContext("2d");
    const R = rng(5);
    g.strokeStyle = "rgba(255,255,240,0.55)";
    g.lineWidth = 1.3;
    // wobbly cells, wrapped so the tile repeats seamlessly
    for (let i = 0; i < 46; i++) {
      const x = R() * size;
      const y = R() * size;
      const r = 10 + R() * 22;
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          g.beginPath();
          for (let k = 0; k <= 10; k++) {
            const a = (k / 10) * TAU;
            const rr = r * (0.8 + 0.3 * Math.sin(a * 3 + i));
            const px = x + ox + Math.cos(a) * rr;
            const py = y + oy + Math.sin(a) * rr;
            if (k === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.stroke();
        }
      }
    }
    this.causticTile = c;
    this.causticPattern = this.ctx.createPattern(c, "repeat");
  }

  buildPads() {
    const R = rng(31);
    this.pads = [];
    const n = clamp(Math.round((this.rx * this.ry) / 26000), 4, 9);
    for (let i = 0; i < n; i++) {
      // pads gather toward the margin, leaving the middle open for the koi
      const a = R() * TAU;
      const rr = 0.62 + R() * 0.26;
      this.pads.push({
        x: this.cx + Math.cos(a) * this.rx * rr,
        y: this.cy + Math.sin(a) * this.ry * rr,
        r: clamp(this.L * (0.22 + R() * 0.16), 14, 40),
        rot: R() * TAU,
        notch: 0.5 + R() * 0.25,
        bob: 0,
        phase: R() * TAU,
        flower: i % 3 === 0,
        drift: (R() - 0.5) * 0.02,
      });
    }
  }

  // dappled shade from trees just outside the frame, drawn over water and bank
  buildCanopy() {
    const [c, g] = this.offscreen();
    const R = rng(41);
    const { W, H } = this;
    const reach = Math.min(W, H) * 0.5;
    const corners = [[0, 0], [W, H]];
    for (const [ax, ay] of corners) {
      for (let i = 0; i < 10; i++) {
        const x = ax + (R() - 0.5) * reach * 1.2;
        const y = ay + (R() - 0.5) * reach;
        const r = reach * (0.3 + R() * 0.35);
        const grad = g.createRadialGradient(x, y, r * 0.15, x, y, r);
        grad.addColorStop(0, "rgba(8,26,20,0.17)");
        grad.addColorStop(1, "rgba(8,26,20,0)");
        g.fillStyle = grad;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    // sun coming through gaps in the leaves
    g.globalCompositeOperation = "destination-out";
    for (const [ax, ay] of corners) {
      for (let i = 0; i < 26; i++) {
        const x = ax + (R() - 0.5) * reach * 1.1;
        const y = ay + (R() - 0.5) * reach * 0.9;
        const r = 4 + R() * 12;
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, "rgba(0,0,0,0.7)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    g.globalCompositeOperation = "source-over";
    this.canopy = c;
  }

  // ---------- koi ----------
  buildKoi() {
    const p = pondState();
    const want = p.count;
    const R = rng(97);
    while (this.koi.length > want) this.koi.pop();
    for (let i = this.koi.length; i < want; i++) {
      const variety = ORDER[i % ORDER.length];
      const a = R() * TAU;
      const rr = Math.sqrt(R()) * 0.6;
      const x = (this.cx || 200) + Math.cos(a) * (this.rx || 150) * rr;
      const y = (this.cy || 200) + Math.sin(a) * (this.ry || 150) * rr;
      const heading = R() * TAU;
      const k = {
        id: i,
        name: NAMES[i % NAMES.length],
        variety,
        size: 0.78 + R() * 0.4,
        x,
        y,
        heading,
        speed: 0,
        phase: R() * TAU,
        depth: R() * 0.8,
        depthGoal: R(),
        seed: Math.floor(R() * 1e9),
        wander: (R() - 0.5) * 0.6,
        curious: null,
        flee: null,
        label: 0,
        spine: [],
      };
      k.patches = this.makePatches(k);
      const len = this.L * k.size;
      for (let s = 0; s < SPINE; s++) k.spine.push({ x: x - Math.cos(heading) * (len / (SPINE - 1)) * s, y: y - Math.sin(heading) * (len / (SPINE - 1)) * s });
      this.koi.push(k);
    }
  }

  makePatches(k) {
    const v = VARIETIES[k.variety];
    const R = rng(k.seed);
    const out = [];
    if (v.spots.length) {
      const n = 3 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) {
        const color = i < 2 || v.spots.length === 1 ? v.spots[0] : v.spots[1 + Math.floor(R() * (v.spots.length - 1))];
        out.push({ at: 0.3 + R() * 8.2, side: (R() - 0.5) * 1.1, r: 0.6 + R() * 0.8, color });
      }
      if (k.variety === "sanke" || k.variety === "showa") {
        for (let i = 0; i < 4; i++) out.push({ at: 2 + R() * 7, side: (R() - 0.5) * 1.4, r: 0.25 + R() * 0.3, color: v.spots[1] });
      }
    }
    return out;
  }

  keepInside(k, hard) {
    const dx = (k.x - this.cx) / (this.rx * 0.9);
    const dy = (k.y - this.cy) / (this.ry * 0.9);
    const e = Math.hypot(dx, dy);
    if (hard && e > 0.95) {
      k.x = this.cx + (dx / e) * 0.9 * this.rx * 0.9;
      k.y = this.cy + (dy / e) * 0.9 * this.ry * 0.9;
    }
    return e;
  }

  updateKoi(k, dt, now) {
    const L = this.L * k.size;
    const calmFactor = this.app.reduceMotion() ? 0.6 : 1;
    let desired = k.heading + k.wander * dt;
    let speed = L * (0.32 + 0.12 * Math.sin(now * 0.00021 + k.seed)) * calmFactor;
    k.wander += (Math.random() - 0.5) * dt * 1.4;
    k.wander = clamp(k.wander, -0.9, 0.9);

    // food beats everything except a fright
    let pellet = null;
    let best = Infinity;
    for (const f of this.pellets) {
      if (f.sinking) continue;
      const d = dist(k.x, k.y, f.x, f.y);
      if (d < best && d < Math.max(this.rx, this.ry) * 1.1) {
        best = d;
        pellet = f;
      }
    }
    if (k.flee && now < k.flee.until) {
      desired = Math.atan2(k.y - k.flee.y, k.x - k.flee.x);
      speed = L * 2.1;
    } else if (pellet) {
      desired = Math.atan2(pellet.y - k.y, pellet.x - k.x);
      speed = L * (best < L ? 0.7 : 1.15);
      if (best < L * 0.16) this.eat(k, pellet);
    } else if (this.follow && now < this.follow.until && dist(k.x, k.y, this.follow.x, this.follow.y) < Math.max(this.rx, this.ry) * 0.9) {
      desired = Math.atan2(this.follow.y - k.y, this.follow.x - k.x);
      const d = dist(k.x, k.y, this.follow.x, this.follow.y);
      speed = L * clamp(d / L, 0.25, 1.1);
    } else if (k.curious && now < k.curious.until) {
      const d = dist(k.x, k.y, k.curious.x, k.curious.y);
      desired = Math.atan2(k.curious.y - k.y, k.curious.x - k.x);
      speed = L * clamp(d / (L * 2), 0.2, 0.8);
      if (d < L * 0.3) k.curious = null;
    }

    // stay in the pond: lean toward the middle near the edge
    const e = this.keepInside(k, false);
    if (e > 0.62) {
      const home = Math.atan2(this.cy - k.y, this.cx - k.x);
      const w = clamp((e - 0.62) * 3.2, 0, 1);
      desired = k.heading + wrapAngle(desired - k.heading) * (1 - w) + wrapAngle(home - k.heading) * w;
    }
    // give each other room: steer away from close neighbours, and never sit on top of one
    for (const o of this.koi) {
      if (o === k) continue;
      const d = dist(k.x, k.y, o.x, o.y);
      const room = L * (pellet ? 0.75 : 0.9);
      if (d < room && d > 0.01) {
        const away = Math.atan2(k.y - o.y, k.x - o.x);
        const push = 1 - d / room;
        desired += wrapAngle(away - desired) * (0.1 + push * 0.35);
        if (d < L * 0.42) {
          const shove = (L * 0.42 - d) * Math.min(1, dt * 3);
          k.x += Math.cos(away) * shove * 0.5;
          k.y += Math.sin(away) * shove * 0.5;
        }
      }
    }

    const maxTurn = (1.3 + (k.speed / L) * 0.9) * dt;
    k.heading += clamp(wrapAngle(desired - k.heading), -maxTurn, maxTurn);
    k.speed += (speed - k.speed) * Math.min(1, dt * 1.6);
    k.x += Math.cos(k.heading) * k.speed * dt;
    k.y += Math.sin(k.heading) * k.speed * dt;
    this.keepInside(k, true);
    k.phase += dt * (2 + (k.speed / L) * 5);
    // drift up and down through the water
    if (Math.abs(k.depth - k.depthGoal) < 0.02) k.depthGoal = pellet ? 0 : Math.random();
    k.depth += clamp(k.depthGoal - k.depth, -dt * 0.08, dt * 0.08);
    if (pellet && best < L * 2) k.depth = Math.max(0, k.depth - dt * 0.5);

    // spine follows the head
    const seg = L / (SPINE - 1);
    k.spine[0].x = k.x;
    k.spine[0].y = k.y;
    for (let i = 1; i < SPINE; i++) {
      const a = k.spine[i - 1];
      const b = k.spine[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      b.x = a.x + (dx / d) * seg;
      b.y = a.y + (dy / d) * seg;
    }
  }

  eat(k, pellet) {
    this.pellets.splice(this.pellets.indexOf(pellet), 1);
    this.addRipple(pellet.x, pellet.y, 0.5);
    this.sound.gulp(this.panOf(pellet.x));
    const p = pondState();
    p.fed++;
    this.eaten++;
    k.happy = 1;
    core.changed();
    if (this.eaten % 5 === 0) this.renderStat();
  }

  // the drawn spine with a swimming wave added toward the tail
  bodyPoints(k) {
    const L = this.L * k.size * (0.93 + 0.07 * (1 - k.depth));
    const pts = [];
    for (let i = 0; i < SPINE; i++) {
      const p = k.spine[i];
      const q = k.spine[Math.max(0, i - 1)];
      const r = k.spine[Math.min(SPINE - 1, i + 1)];
      const a = Math.atan2(q.y - r.y, q.x - r.x);
      const nx = -Math.sin(a);
      const ny = Math.cos(a);
      const wave = Math.sin(k.phase - i * 0.55) * L * 0.022 * (i / SPINE);
      const w = L * 0.128 * WIDTHS[i];
      pts.push({ x: p.x + nx * wave, y: p.y + ny * wave, a, nx, ny, w });
    }
    return { pts, L };
  }

  bodyPath(ctx, pts, ox = 0, oy = 0) {
    const n = pts.length;
    const head = pts[0];
    const fx = Math.cos(head.a);
    const fy = Math.sin(head.a);
    const left = pts.map((p) => ({ x: p.x + p.nx * p.w + ox, y: p.y + p.ny * p.w + oy }));
    const right = pts.map((p) => ({ x: p.x - p.nx * p.w + ox, y: p.y - p.ny * p.w + oy }));
    const tail = pts[n - 1];
    ctx.beginPath();
    ctx.moveTo(right[0].x, right[0].y);
    ctx.bezierCurveTo(right[0].x + fx * head.w * 1.3, right[0].y + fy * head.w * 1.3, left[0].x + fx * head.w * 1.3, left[0].y + fy * head.w * 1.3, left[0].x, left[0].y);
    for (let i = 1; i < n; i++) {
      const m = { x: (left[i - 1].x + left[i].x) / 2, y: (left[i - 1].y + left[i].y) / 2 };
      ctx.quadraticCurveTo(left[i - 1].x, left[i - 1].y, m.x, m.y);
    }
    ctx.lineTo(tail.x + ox, tail.y + oy);
    for (let i = n - 1; i > 0; i--) {
      const m = { x: (right[i].x + right[i - 1].x) / 2, y: (right[i].y + right[i - 1].y) / 2 };
      ctx.quadraticCurveTo(right[i].x, right[i].y, m.x, m.y);
    }
    ctx.closePath();
  }

  drawShadow(ctx, k) {
    const { pts, L } = this.bodyPoints(k);
    const off = L * (0.05 + k.depth * 0.1);
    ctx.fillStyle = `rgba(4,22,24,${0.22 - k.depth * 0.08})`;
    this.bodyPath(ctx, pts, off, off * 1.2);
    ctx.fill();
  }

  drawKoi(ctx, k, now) {
    const v = VARIETIES[k.variety];
    const { pts, L } = this.bodyPoints(k);
    const n = pts.length;
    ctx.save();
    ctx.globalAlpha = 1 - k.depth * 0.32;
    const flap = Math.sin(k.phase * 1.25);

    // tail fin: two long translucent lobes with fine rays
    const tail = pts[n - 1];
    const ta = tail.a + Math.PI + Math.sin(k.phase - 1.8) * 0.35;
    const along = (ang, r) => ({ x: tail.x + Math.cos(ang) * L * r, y: tail.y + Math.sin(ang) * L * r });
    ctx.fillStyle = v.fin;
    ctx.globalAlpha *= 0.62;
    ctx.lineWidth = Math.max(0.5, L * 0.004);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    for (const side of [-1, 1]) {
      const tip = along(ta + side * 0.52, 0.37);
      const c1 = along(ta + side * 0.2, 0.25);
      const c2 = along(ta + side * 0.16, 0.22);
      const inner = along(ta, 0.16);
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.quadraticCurveTo(c1.x, c1.y, tip.x, tip.y);
      ctx.quadraticCurveTo(c2.x, c2.y, inner.x, inner.y);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      for (let r = 0.25; r < 1; r += 0.25) {
        const end = along(ta + side * 0.5 * r, 0.17 + 0.17 * r);
        ctx.moveTo(tail.x, tail.y);
        ctx.lineTo(end.x, end.y);
      }
      ctx.stroke();
    }
    // pectoral and pelvic fins: rounded paddles that row as the koi swims
    for (const [idx, size] of [[2, 0.21], [6, 0.11]]) {
      const p = pts[idx];
      for (const side of [-1, 1]) {
        // fins sweep out and back from the flank (they used to fold under the body),
        // rowing forward and back as the koi swims
        const ang = p.a + Math.PI - side * (1.0 + flap * 0.3 * (idx === 2 ? 1 : 0.5));
        ctx.save();
        ctx.translate(p.x + p.nx * side * p.w * 0.7, p.y + p.ny * side * p.w * 0.7);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(0, -L * size * 0.1 * side);
        ctx.quadraticCurveTo(L * size * 0.55, -L * size * 0.4 * side, L * size, -L * size * 0.1 * side);
        ctx.quadraticCurveTo(L * size * 0.85, L * size * 0.22 * side, 0, L * size * 0.12 * side);
        ctx.closePath();
        ctx.fill();
        const rayStroke = ctx.strokeStyle;
        ctx.strokeStyle = "rgba(15,30,30,0.22)";
        ctx.stroke();
        ctx.beginPath();
        for (let r = 0.2; r < 1; r += 0.2) {
          ctx.moveTo(0, 0);
          ctx.lineTo(L * size * (0.75 + 0.2 * r), -L * size * (0.3 - 0.42 * r) * side);
        }
        ctx.strokeStyle = rayStroke;
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1 - k.depth * 0.32;

    // body with pattern
    this.bodyPath(ctx, pts);
    ctx.fillStyle = v.base;
    ctx.fill();
    ctx.save();
    this.bodyPath(ctx, pts);
    ctx.clip();
    const at = (f) => {
      const i = clamp(Math.floor(f), 0, n - 2);
      const tt = f - i;
      const a = pts[i];
      const b = pts[i + 1];
      return { x: a.x + (b.x - a.x) * tt, y: a.y + (b.y - a.y) * tt, nx: a.nx, ny: a.ny, w: a.w + (b.w - a.w) * tt };
    };
    for (const s of k.patches) {
      const p = at(s.at);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(p.x + p.nx * s.side * p.w, p.y + p.ny * s.side * p.w, p.w * s.r * 1.1, 0, TAU);
      ctx.fill();
    }
    if (v.crown) {
      const p = pts[1];
      ctx.fillStyle = v.crown;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.w * 0.62, 0, TAU);
      ctx.fill();
    }
    if (v.sides) {
      ctx.fillStyle = v.sides;
      for (let f = 2; f < n - 2; f += 0.7) {
        const p = at(f);
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(p.x + p.nx * side * p.w * 0.95, p.y + p.ny * side * p.w * 0.95, p.w * 0.32, 0, TAU);
          ctx.fill();
        }
      }
    }
    if (v.net) {
      // scale net: a lattice of small arcs along the back
      ctx.strokeStyle = v.net;
      ctx.globalAlpha *= 0.45;
      ctx.lineWidth = Math.max(0.6, L * 0.006);
      ctx.beginPath();
      for (let f = 0.8; f < n - 2; f += 0.55) {
        const p = at(f);
        for (let s = -0.6; s <= 0.61; s += 0.4) {
          const x = p.x + p.nx * s * p.w;
          const y = p.y + p.ny * s * p.w;
          ctx.moveTo(x + p.w * 0.22, y);
          ctx.arc(x, y, p.w * 0.22, 0, Math.PI);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1 - k.depth * 0.32;
    }
    // roundness: flanks fall into shade, the spine catches the light
    for (const [width, alpha] of [[1.25, 0.14], [0.65, 0.17], [0.26, 0.2]]) {
      this.bodyPath(ctx, pts);
      ctx.strokeStyle = `rgba(14,24,26,${alpha})`;
      ctx.lineWidth = pts[3].w * width;
      ctx.stroke();
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const spine = (from, to) => {
      ctx.beginPath();
      ctx.moveTo(pts[from].x, pts[from].y);
      for (let i = from + 1; i <= to; i++) ctx.lineTo(pts[i].x, pts[i].y);
    };
    spine(0, n - 4);
    ctx.strokeStyle = v.metal ? "rgba(255,246,214,0.26)" : "rgba(255,255,255,0.11)";
    ctx.lineWidth = pts[3].w * 0.95;
    ctx.stroke();
    spine(1, n - 5);
    ctx.strokeStyle = v.metal ? "rgba(255,252,236,0.6)" : "rgba(255,255,255,0.26)";
    ctx.lineWidth = pts[3].w * 0.32;
    ctx.stroke();
    // metallic koi get a bright shoulder where the light hits hardest
    if (v.metal) {
      const sh = pts[2];
      const glow = ctx.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, sh.w * 1.6);
      glow.addColorStop(0, "rgba(255,250,228,0.45)");
      glow.addColorStop(1, "rgba(255,250,228,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(sh.x - sh.w * 2, sh.y - sh.w * 2, sh.w * 4, sh.w * 4);
    }
    // the head: a darker snout and a soft skull highlight
    const hd = pts[0];
    const hx = Math.cos(hd.a);
    const hy = Math.sin(hd.a);
    ctx.fillStyle = "rgba(14,24,26,0.14)";
    ctx.beginPath();
    ctx.ellipse(hd.x + hx * hd.w * 0.75, hd.y + hy * hd.w * 0.75, hd.w * 0.75, hd.w * 0.9, hd.a, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.ellipse(hd.x - hx * hd.w * 0.1, hd.y - hy * hd.w * 0.1, hd.w * 0.45, hd.w * 0.3, hd.a, 0, TAU);
    ctx.fill();
    // deeper koi take on the water colour
    if (k.depth > 0.05) {
      ctx.fillStyle = `rgba(24,74,72,${k.depth * 0.32})`;
      ctx.fillRect(k.x - L * 1.5, k.y - L * 1.5, L * 3, L * 3);
    }
    ctx.restore();
    this.bodyPath(ctx, pts);
    ctx.strokeStyle = "rgba(8,20,22,0.28)";
    ctx.lineWidth = 0.9;
    ctx.stroke();
    // dorsal fin: a soft translucent ridge that sways with the body
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 3; i <= 7; i++) {
      const sway = Math.sin(k.phase - i * 0.5) * pts[i].w * 0.15;
      const x = pts[i].x + pts[i].nx * sway;
      const y = pts[i].y + pts[i].ny * sway;
      if (i === 3) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(20,26,26,0.16)";
    ctx.lineWidth = Math.max(1.5, pts[4].w * 0.42);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = Math.max(0.6, pts[4].w * 0.12);
    ctx.stroke();
    // eyes with a tiny catch-light
    const h = pts[0];
    const fx = Math.cos(h.a);
    const fy = Math.sin(h.a);
    const er = Math.max(1.4, L * 0.016);
    for (const side of [-1, 1]) {
      const ex = h.x + fx * h.w * 0.62 + h.nx * side * h.w * 0.6;
      const ey = h.y + fy * h.w * 0.62 + h.ny * side * h.w * 0.6;
      ctx.fillStyle = "#121718";
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath();
      ctx.arc(ex - er * 0.3, ey - er * 0.3, er * 0.35, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawLabel(ctx, k, now) {
    const life = (k.label - now) / 2600;
    if (life <= 0) return;
    const text = k.name + " · " + t("pond.v." + k.variety);
    ctx.save();
    ctx.globalAlpha = clamp(life * 3, 0, 1);
    ctx.font = "600 13px 'Source Sans 3', system-ui, sans-serif";
    const w = ctx.measureText(text).width + 22;
    const x = clamp(k.x - w / 2, 8, this.W - w - 8);
    const y = clamp(k.y - this.L * 0.75 - 30, 8, this.H - 40);
    ctx.fillStyle = "rgba(251,248,241,0.94)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, 28, 14);
    ctx.fill();
    ctx.fillStyle = "#1d2a27";
    ctx.fillText(text, x + 11, y + 18.5);
    ctx.restore();
  }

  // ---------- effects ----------
  addRipple(x, y, strength = 1) {
    if (this.ripples.length > 90) this.ripples.shift();
    this.ripples.push({ x, y, r: 2, max: (40 + strength * 70) * (this.L / 100), speed: 34 + strength * 26, strength });
  }

  panOf(x) {
    return clamp((x - this.cx) / (this.rx || 1), -1, 1) * 0.8;
  }

  dropPellet(x, y) {
    if (this.pellets.length > 70) this.pellets.shift();
    this.pellets.push({ x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 14, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, born: performance.now(), sinking: false, r: 2.4 + Math.random() * 1.2 });
    this.addRipple(x, y, 0.18);
    this.sound.pellet(this.panOf(x));
  }

  scatterFood(x, y) {
    if (x === undefined) {
      const a = Math.random() * TAU;
      x = this.cx + Math.cos(a) * this.rx * 0.3;
      y = this.cy + Math.sin(a) * this.ry * 0.3;
    }
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const a = Math.random() * TAU;
        const r = Math.random() * this.L * 0.5;
        this.dropPellet(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }, i * 70);
    }
    this.noteInteraction();
  }

  tap(x, y) {
    const now = performance.now();
    this.sound.resumeIfNeeded();
    // a koi?
    for (const k of this.koi) {
      for (let i = 0; i < 7; i++) {
        const p = k.spine[i];
        if (dist(x, y, p.x, p.y) < this.L * k.size * 0.12 + 12) {
          k.label = now + 2600;
          k.flee = { x, y, until: now + 500 };
          this.addRipple(x, y, 0.45);
          this.sound.drip(this.panOf(x));
          const met = pondState().met;
          if (!met.includes(k.name)) {
            met.push(k.name);
            core.changed();
            this.renderStat();
          }
          this.noteInteraction();
          return;
        }
      }
    }
    // a leaf?
    for (const l of this.leaves) {
      if (dist(x, y, l.x, l.y) < l.size + 10) {
        l.vr += (Math.random() < 0.5 ? -1 : 1) * 5;
        l.vx += (l.x - x) * 0.6;
        l.vy += (l.y - y) * 0.6;
        this.addRipple(l.x, l.y, 0.3);
        this.sound.drip(this.panOf(x));
        this.noteInteraction();
        return;
      }
    }
    // the water
    this.addRipple(x, y, 1);
    setTimeout(() => this.visible && this.addRipple(x, y, 0.6), 180);
    this.sound.plop(this.panOf(x));
    for (const k of this.koi) {
      const d = dist(k.x, k.y, x, y);
      if (d < this.L * 0.6) k.flee = { x, y, until: now + 700 };
      else if (d < Math.max(this.rx, this.ry) * 0.8 && Math.random() < 0.7) k.curious = { x, y, until: now + 3000 + Math.random() * 2500 };
    }
    this.noteInteraction();
  }

  noteInteraction() {
    this.interactions++;
    const p = pondState();
    if (this.interactions >= 3 && !p.hintSeen) {
      p.hintSeen = true;
      core.changed();
    }
    this.hint.classList.add("gone");
  }

  bindPointer() {
    const c = this.canvas;
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    c.addEventListener("pointerdown", (e) => {
      const p = pos(e);
      c.setPointerCapture?.(e.pointerId);
      this.sound.resumeIfNeeded();
      this.press = { x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false, feeding: false, lastWake: p, lastPellet: 0, lastSwish: 0 };
      clearTimeout(this.holdTimer);
      this.holdTimer = setTimeout(() => {
        if (this.press && !this.press.moved) {
          this.press.feeding = true;
          this.dropPellet(this.press.x, this.press.y);
          this.noteInteraction();
        }
      }, 420);
    });
    c.addEventListener("pointermove", (e) => {
      if (!this.press) return;
      const p = pos(e);
      const pr = this.press;
      pr.x = p.x;
      pr.y = p.y;
      if (!pr.moved && dist(p.x, p.y, pr.sx, pr.sy) > 14 && !pr.feeding) pr.moved = true;
      if (pr.moved) {
        this.follow = { x: p.x, y: p.y, until: performance.now() + 1600 };
        if (dist(p.x, p.y, pr.lastWake.x, pr.lastWake.y) > this.L * 0.35) {
          this.addRipple(p.x, p.y, 0.28);
          pr.lastWake = p;
          const now = performance.now();
          if (now - pr.lastSwish > 380) {
            this.sound.swish(this.panOf(p.x));
            pr.lastSwish = now;
          }
        }
      }
    });
    const up = () => {
      clearTimeout(this.holdTimer);
      const pr = this.press;
      this.press = null;
      if (!pr) return;
      if (pr.moved) this.noteInteraction();
      else if (!pr.feeding) this.tap(pr.x, pr.y);
    };
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", () => {
      clearTimeout(this.holdTimer);
      this.press = null;
    });
    c.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  scheduleFountain() {
    clearTimeout(this.fountainTimer);
    const wait = this.fountain === null && !this.fountainStarted ? 6000 : 24000 + Math.random() * 18000;
    this.fountainStarted = true;
    this.fountainTimer = setTimeout(() => {
      if (!this.visible) return;
      const p = pondState();
      if (p.layers.fountain) {
        this.fountain = { start: performance.now(), knocked: false };
        if (this.sound.on) this.sound.shishiOdoshi();
      }
      this.scheduleFountain();
    }, wait);
  }

  spawnLeaf() {
    if (this.leaves.length >= 7) return;
    const L = LEAVES[Math.floor(Math.random() * LEAVES.length)];
    const a = Math.random() * TAU;
    const e = this.edgePoint(a, -10);
    this.leaves.push({
      ...L,
      x: e.x,
      y: e.y,
      vx: -e.nx * (4 + Math.random() * 6),
      vy: -e.ny * (4 + Math.random() * 6),
      rot: Math.random() * TAU,
      vr: (Math.random() - 0.5) * 0.4,
      size: clamp(this.L * (0.09 + Math.random() * 0.05), 7, 16),
      born: performance.now(),
      life: 70000 + Math.random() * 40000,
    });
  }

  // ---------- frame ----------
  frame(ts) {
    if (!this.visible) return;
    const dt = clamp((ts - this.last) / 1000, 0, 0.05);
    this.last = ts;
    this.time += dt;
    this.update(dt, ts);
    this.draw(ts);
    this.raf = requestAnimationFrame((n) => this.frame(n));
  }

  update(dt, now) {
    const p = pondState();
    for (const k of this.koi) this.updateKoi(k, dt, now);
    // holding down keeps the food coming
    if (this.press && this.press.feeding && now - this.press.lastPellet > 160) {
      this.press.lastPellet = now;
      this.dropPellet(this.press.x, this.press.y);
    }
    // ripples spread and nudge the lily pads
    for (const r of this.ripples) {
      r.r += r.speed * dt;
      for (const pad of this.pads) {
        const d = dist(r.x, r.y, pad.x, pad.y);
        if (Math.abs(d - r.r) < pad.r * 0.6) pad.bob = Math.min(1.2, pad.bob + dt * 2.2 * r.strength);
      }
    }
    this.ripples = this.ripples.filter((r) => r.r < r.max);
    for (const pad of this.pads) {
      pad.bob *= Math.max(0, 1 - dt * 0.9);
      pad.phase += dt * 3;
      pad.rot += pad.drift * dt;
    }
    // food drifts, then sinks
    for (const f of this.pellets) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vx *= 1 - dt * 0.6;
      f.vy *= 1 - dt * 0.6;
      if (now - f.born > 28000) f.sinking = true;
    }
    this.pellets = this.pellets.filter((f) => now - f.born < 32000);
    // leaves
    if (Math.random() < dt / 9) this.spawnLeaf();
    for (const l of this.leaves) {
      l.x += l.vx * dt;
      l.y += l.vy * dt;
      l.vx *= 1 - dt * 0.25;
      l.vy *= 1 - dt * 0.25;
      l.vx += Math.sin(now * 0.0003 + l.born) * dt * 1.5;
      l.rot += l.vr * dt;
      l.vr *= 1 - dt * 0.8;
    }
    this.leaves = this.leaves.filter((l) => now - l.born < l.life);
    // rain and the spout make small rings of their own
    if (p.rain) {
      const rate = (this.rx * this.ry) / 7000;
      let n = rate * dt;
      while (n > 0) {
        if (Math.random() < n) {
          const a = Math.random() * TAU;
          const rr = Math.sqrt(Math.random());
          this.addRipple(this.cx + Math.cos(a) * this.rx * rr, this.cy + Math.sin(a) * this.ry * rr, 0.12 + Math.random() * 0.12);
        }
        n -= 1;
      }
    }
    if (p.layers.stream && Math.random() < dt * 3.5) {
      const s = this.spout;
      this.addRipple(s.x - s.nx * 14, s.y - s.ny * 14, 0.22);
    }
    // shishi-odoshi knock
    if (this.fountain && !this.fountain.knocked && now - this.fountain.start > 4100) {
      this.fountain.knocked = true;
      const s = this.shishi;
      this.addRipple(s.x - s.nx * 26, s.y - s.ny * 26, 0.9);
      for (const k of this.koi) if (dist(k.x, k.y, s.x, s.y) < this.L * 1.4) k.flee = { x: s.x, y: s.y, until: now + 600 };
    }
    // fireflies at night
    const night = this.mood() === "night";
    if (night && this.flies.length < 16) {
      const e = this.edgePoint(Math.random() * TAU, 10 + Math.random() * 30);
      this.flies.push({ x: e.x, y: e.y, vx: 0, vy: 0, seed: Math.random() * 100 });
    } else if (!night && this.flies.length) this.flies.length = 0;
    for (const f of this.flies) {
      f.vx += (Math.random() - 0.5) * dt * 30;
      f.vy += (Math.random() - 0.5) * dt * 30;
      f.vx *= 0.96;
      f.vy *= 0.96;
      f.x = clamp(f.x + f.vx * dt, 4, this.W - 4);
      f.y = clamp(f.y + f.vy * dt, 4, this.H - 4);
    }
    if (this.dim > 0 && this.dim < 0.55) this.dim += dt * 0.012;
  }

  draw(now) {
    const ctx = this.ctx;
    const { W, H } = this;
    const p = pondState();
    const mood = this.mood();
    const reduce = this.app.reduceMotion();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.floor, 0, 0, W, H);

    ctx.save();
    this.pondPath(ctx);
    ctx.clip();
    // koi shadows on the floor, deep koi first
    const order = [...this.koi].sort((a, b) => b.depth - a.depth);
    for (const k of order) this.drawShadow(ctx, k);
    for (const k of order) this.drawKoi(ctx, k, now);
    // light through the surface
    if (this.causticPattern) {
      const tt = reduce ? 0 : now * 0.001;
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = mood === "night" ? 0.03 : mood === "dusk" ? 0.06 : 0.075;
      for (const [sc, vx, vy] of [[1.6, 9, 5], [2.3, -6, 8]]) {
        const m = new DOMMatrix().translateSelf((tt * vx) % (256 * sc), (tt * vy) % (256 * sc)).scaleSelf(sc, sc);
        this.causticPattern.setTransform(m);
        ctx.fillStyle = this.causticPattern;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
    // food on the surface
    for (const f of this.pellets) {
      const age = (now - f.born) / 1000;
      ctx.globalAlpha = f.sinking ? clamp(1 - (age - 28) / 4, 0, 1) * 0.6 : 1;
      ctx.fillStyle = "#9b6a3c";
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(255,230,190,0.6)";
      ctx.beginPath();
      ctx.arc(f.x - f.r * 0.3, f.y - f.r * 0.3, f.r * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // lily pads float above the koi
    for (const pad of this.pads) this.drawPad(ctx, pad);
    // ripples
    ctx.lineCap = "round";
    for (const r of this.ripples) {
      const life = 1 - r.r / r.max;
      ctx.strokeStyle = `rgba(235,248,245,${0.45 * life * Math.min(1, r.strength + 0.3)})`;
      ctx.lineWidth = 1.2 + r.strength;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.92, 0, 0, TAU);
      ctx.stroke();
      if (r.r > 8) {
        ctx.strokeStyle = `rgba(10,40,40,${0.16 * life})`;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r - 3, (r.r - 3) * 0.92, 0, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = `rgba(235,248,245,${0.22 * life})`;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r * 0.62, r.r * 0.57, 0, 0, TAU);
        ctx.stroke();
      }
    }
    // leaves
    for (const l of this.leaves) {
      const fade = clamp(Math.min((now - l.born) / 1500, (l.life - (now - l.born)) / 3000), 0, 1);
      ctx.globalAlpha = fade;
      this.drawLeaf(ctx, l);
    }
    ctx.globalAlpha = 1;
    // sky reflection
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    if (mood === "day") {
      sky.addColorStop(0, "rgba(255,255,255,0.10)");
      sky.addColorStop(0.5, "rgba(255,255,255,0)");
    } else if (mood === "dusk") {
      sky.addColorStop(0, "rgba(255,176,96,0.20)");
      sky.addColorStop(1, "rgba(255,176,96,0.02)");
    } else {
      sky.addColorStop(0, "rgba(120,150,190,0.08)");
      sky.addColorStop(1, "rgba(120,150,190,0)");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // a broad soft sheen where the sky catches the surface
    if (mood !== "night") {
      const drift = reduce ? 0 : Math.sin(now * 0.00012) * this.rx * 0.05;
      ctx.save();
      ctx.translate(this.cx - this.rx * 0.32 + drift, this.cy - this.ry * 0.42);
      ctx.rotate(-0.32);
      ctx.scale(this.rx * 0.52, this.ry * 0.17);
      const sheen = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      sheen.addColorStop(0, mood === "dusk" ? "rgba(255,206,150,0.13)" : "rgba(255,255,255,0.1)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
    ctx.restore();

    ctx.drawImage(this.rim, 0, 0, W, H);
    this.drawShishi(ctx, now);
    // tree shade sways a little in the wind
    if (this.canopy) {
      const sway = reduce ? 0 : Math.sin(now * 0.0004) * 3;
      ctx.globalAlpha = mood === "night" ? 0.3 : mood === "dusk" ? 0.75 : 1;
      ctx.drawImage(this.canopy, sway, sway * 0.6, W, H);
      ctx.globalAlpha = 1;
    }

    // mood overlays
    if (mood === "dusk") {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "rgba(255,150,70,0.16)");
      g.addColorStop(1, "rgba(50,30,20,0.22)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    } else if (mood === "night") {
      const nightWash = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, Math.hypot(W, H) * 0.6);
      nightWash.addColorStop(0, "rgba(10,24,40,0.46)");
      nightWash.addColorStop(1, "rgba(4,10,20,0.7)");
      ctx.fillStyle = nightWash;
      ctx.fillRect(0, 0, W, H);
      this.drawNightLights(ctx, now);
    }
    if (p.rain) {
      ctx.fillStyle = "rgba(40,50,55,0.12)";
      ctx.fillRect(0, 0, W, H);
    }
    if (this.dim > 0) {
      ctx.fillStyle = `rgba(4,8,12,${this.dim})`;
      ctx.fillRect(0, 0, W, H);
    }
    // name cards sit above every overlay so they stay readable at night
    for (const k of this.koi) this.drawLabel(ctx, k, now);
  }

  drawPad(ctx, pad) {
    const s = 1 + Math.sin(pad.phase) * 0.035 * pad.bob;
    const r = pad.r * s;
    ctx.save();
    ctx.translate(pad.x, pad.y);
    ctx.fillStyle = "rgba(4,22,20,0.25)";
    ctx.beginPath();
    ctx.arc(4, 5, r, 0, TAU);
    ctx.fill();
    ctx.rotate(pad.rot);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    g.addColorStop(0, "#7fa452");
    g.addColorStop(1, "#4f7a38");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, pad.notch * 0.5, TAU - pad.notch * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(220,240,190,0.25)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 7; i++) {
      const a = pad.notch * 0.5 + ((TAU - pad.notch) * i) / 7;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      ctx.stroke();
    }
    if (pad.flower) {
      ctx.rotate(-pad.rot * 1.3);
      const fr = r * 0.55;
      for (const [layer, color] of [[0, "#f1ece2"], [0.4, "#fbf8f1"]]) {
        ctx.fillStyle = color;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + layer;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * fr * 0.45 * (1 - layer * 0.5), Math.sin(a) * fr * 0.45 * (1 - layer * 0.5), fr * 0.42 * (1 - layer * 0.3), fr * 0.18, a, 0, TAU);
          ctx.fill();
        }
      }
      ctx.fillStyle = "#e8c453";
      ctx.beginPath();
      ctx.arc(0, 0, fr * 0.18, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawLeaf(ctx, l) {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.rot);
    ctx.fillStyle = "rgba(4,22,20,0.18)";
    ctx.beginPath();
    ctx.arc(2, 3, l.size * 0.7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = l.color;
    const s = l.size;
    ctx.beginPath();
    if (l.kind === "maple") {
      // five pointed lobes, the middle one longest, the stem pointing back
      const lobes = [[-190, 0.58], [-140, 0.9], [-90, 1.05], [-40, 0.9], [10, 0.58]];
      const pt = (deg, r) => [Math.cos((deg * Math.PI) / 180) * s * r, Math.sin((deg * Math.PI) / 180) * s * r];
      ctx.moveTo(...pt(118, 0.26));
      let prev = 118 - 360;
      for (const [deg, len] of lobes) {
        const notch = pt((prev + deg) / 2, 0.34);
        ctx.lineTo(...notch);
        ctx.quadraticCurveTo(...pt(deg - 16, len * 0.62), ...pt(deg, len));
        ctx.quadraticCurveTo(...pt(deg + 16, len * 0.62), ...pt(deg + 22, len * 0.42));
        prev = deg;
      }
      ctx.lineTo(...pt(62, 0.26));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(80,24,8,0.38)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (const [deg, len] of lobes) {
        ctx.moveTo(0, 0);
        ctx.lineTo(...pt(deg, len * 0.82));
      }
      ctx.moveTo(0, 0);
      ctx.lineTo(...pt(90, 0.95));
      ctx.stroke();
    } else if (l.kind === "ginkgo") {
      // a fan with a small notch in the middle of its outer edge
      const r = s * 1.15;
      ctx.moveTo(0, s * 0.55);
      ctx.lineTo(Math.cos(-Math.PI * 0.86) * r, s * 0.55 + Math.sin(-Math.PI * 0.86) * r);
      ctx.arc(0, s * 0.55, r, -Math.PI * 0.86, -Math.PI * 0.53);
      ctx.lineTo(0, s * 0.55 - r * 0.72);
      ctx.arc(0, s * 0.55, r, -Math.PI * 0.47, -Math.PI * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(120,90,20,0.35)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let i = 1; i < 6; i++) {
        const a = -Math.PI * (0.86 - (0.72 * i) / 6);
        ctx.moveTo(0, s * 0.55);
        ctx.lineTo(Math.cos(a) * r * 0.92, s * 0.55 + Math.sin(a) * r * 0.92);
      }
      ctx.moveTo(0, s * 0.55);
      ctx.lineTo(0, s * 1.25);
      ctx.stroke();
    } else {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        ctx.moveTo(0, 0);
        ctx.ellipse(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45, s * 0.42, s * 0.3, a, 0, TAU);
      }
      ctx.fill();
      ctx.fillStyle = "#e9c46a";
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawShishi(ctx, now) {
    const s = this.shishi;
    if (!pondState().layers.fountain) return;
    // tilt: the tube fills (rises slowly), tips to knock, then swings back
    let tilt = -0.32;
    if (this.fountain) {
      const e = (now - this.fountain.start) / 1000;
      if (e < 4.1) tilt = -0.32 + (e / 4.1) * 0.22;
      else if (e < 4.5) tilt = -0.1 + ((e - 4.1) / 0.4) * 0.62;
      else if (e < 6) tilt = 0.52 - ((e - 4.5) / 1.5) * 0.84;
      else this.fountain = null;
    }
    ctx.save();
    ctx.translate(s.x + s.nx * 22, s.y + s.ny * 22);
    const base = Math.atan2(-s.ny, -s.nx);
    ctx.rotate(base);
    // posts
    ctx.fillStyle = "#6a5a43";
    ctx.fillRect(-4, -14, 8, 6);
    ctx.fillRect(-4, 8, 8, 6);
    // a top-down tube reads its tilt as length: tipped toward the water it looks longer
    const len = 46 + tilt * 22;
    ctx.fillStyle = "rgba(20,24,18,0.3)";
    ctx.fillRect(-len * 0.35 + 3, -4, len, 11);
    const bam = ctx.createLinearGradient(0, -6, 0, 6);
    bam.addColorStop(0, "#a5b763");
    bam.addColorStop(1, "#71873f");
    ctx.fillStyle = bam;
    ctx.beginPath();
    ctx.roundRect(-len * 0.35, -6, len, 12, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(60,80,30,0.6)";
    ctx.fillRect(len * 0.15, -6, 2.5, 12);
    ctx.fillStyle = "#3e5a52";
    ctx.beginPath();
    ctx.ellipse(len * 0.65 - 2, 0, 3, 5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawNightLights(ctx, now) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const l of this.lanterns) {
      const flick = 0.85 + Math.sin(now * 0.004 + l.x) * 0.06 + Math.sin(now * 0.011) * 0.04;
      const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, this.L * 1.8);
      g.addColorStop(0, `rgba(255,196,120,${0.55 * flick})`);
      g.addColorStop(0.25, `rgba(255,170,90,${0.18 * flick})`);
      g.addColorStop(1, "rgba(255,170,90,0)");
      ctx.fillStyle = g;
      ctx.fillRect(l.x - this.L * 2, l.y - this.L * 2, this.L * 4, this.L * 4);
    }
    // lantern light pools on the water toward the middle of the pond
    for (const l of this.lanterns) {
      const px = l.x + (this.cx - l.x) * 0.18;
      const py = l.y + (this.cy - l.y) * 0.18;
      const pool = ctx.createRadialGradient(px, py, 2, px, py, this.L * 1.1);
      pool.addColorStop(0, "rgba(255,180,100,0.16)");
      pool.addColorStop(1, "rgba(255,180,100,0)");
      ctx.fillStyle = pool;
      ctx.fillRect(px - this.L * 1.2, py - this.L * 1.2, this.L * 2.4, this.L * 2.4);
    }
    // moon on the water: a soft glow broken up by the surface
    const mx = this.cx + this.rx * 0.32;
    const my = this.cy - this.ry * 0.34;
    const mr = this.L * 0.32;
    ctx.save();
    ctx.translate(mx, my);
    ctx.scale(1, 1.25);
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, mr * 2.6);
    halo.addColorStop(0, "rgba(220,230,236,0.2)");
    halo.addColorStop(1, "rgba(220,230,236,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(-mr * 2.6, -mr * 2.6, mr * 5.2, mr * 5.2);
    const disc = ctx.createRadialGradient(0, 0, 0, 0, 0, mr);
    disc.addColorStop(0, "rgba(246,244,232,0.5)");
    disc.addColorStop(0.7, "rgba(246,244,232,0.3)");
    disc.addColorStop(1, "rgba(246,244,232,0)");
    ctx.fillStyle = disc;
    ctx.fillRect(-mr, -mr, mr * 2, mr * 2);
    ctx.restore();
    ctx.lineCap = "round";
    for (let i = 0; i < 9; i++) {
      const row = i - 4;
      const w = mr * (1.15 - Math.abs(row) * 0.18) * (0.75 + Math.sin(now * 0.0017 + i * 2.1) * 0.25);
      if (w <= 2) continue;
      const shift = Math.sin(now * 0.0011 + i * 1.3) * mr * 0.35;
      ctx.strokeStyle = `rgba(240,240,226,${0.1 + 0.08 * Math.sin(now * 0.002 + i)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(mx - w + shift, my + row * mr * 0.32);
      ctx.lineTo(mx - w * 0.15 + shift, my + row * mr * 0.32);
      ctx.moveTo(mx + w * 0.1 + shift, my + row * mr * 0.32);
      ctx.lineTo(mx + w + shift, my + row * mr * 0.32);
      ctx.stroke();
    }
    for (const f of this.flies) {
      const b = Math.max(0, Math.sin(now * 0.0021 + f.seed * 7));
      if (b < 0.05) continue;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 9);
      g.addColorStop(0, `rgba(222,240,130,${0.9 * b})`);
      g.addColorStop(1, "rgba(222,240,130,0)");
      ctx.fillStyle = g;
      ctx.fillRect(f.x - 9, f.y - 9, 18, 18);
    }
    ctx.restore();
  }
}
