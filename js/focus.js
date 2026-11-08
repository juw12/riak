// Focus: a work timer beside a calm copy of your tank, weekly totals, and box breathing.
import * as core from "./core.js";
import { t } from "./i18n.js";
import { el } from "./util.js";
import { icon, button, meter, segmented, toast } from "./ui.js";
import { TankView } from "./tank.js";

const PRESETS = [15, 25, 45, 60];
const BREATH = ["in", "hold", "out", "hold"];

export class FocusPanel {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.breathing = false;
    this.breathTimer = null;
  }

  init() {
    const root = this.root;
    root.innerHTML = "";
    const canvas = el("canvas", { role: "img", "aria-label": t("focus.tankLabel") });
    this.timerEl = el("div", { class: "timer", role: "timer", "aria-live": "off" });
    this.stateEl = el("p", { class: "muted" });
    this.controls = el("div", { class: "row" });
    this.presetBox = el("div");
    const tankWrap = el("div", { class: "tank-wrap focus-tank" }, [canvas]);
    const left = el("div", {}, [
      el("figure", { class: "plate" }, [tankWrap]),
    ]);
    this.weekEl = el("div", { class: "week", "aria-label": t("focus.week") });
    this.totalEl = el("p", { class: "muted" });
    this.breathRing = el("div", { class: "breath-ring" }, [el("i"), el("span", { text: t("focus.in") })]);
    this.breathBtn = button(t("focus.startBreath"), { icon: "breath", kind: "quiet", onclick: () => this.toggleBreath() });
    const notes = el("aside", { class: "notes" }, [
      el("section", {}, [el("h2", { text: t("focus.title") }), el("p", { class: "muted", text: t("focus.lead") }), this.presetBox, this.timerEl, this.stateEl, this.controls]),
      el("section", {}, [el("h3", { text: t("focus.week") }), this.weekEl, this.totalEl]),
      el("section", {}, [el("h3", { text: t("focus.breathe") }), el("p", { class: "explain", text: t("focus.breatheLead") }), el("div", { class: "breath" }, [this.breathRing, this.breathBtn])]),
    ]);
    root.append(el("div", { class: "focus-layout" }, [left, notes]));
    this.view = new TankView(canvas, {
      source: () => {
        const tank = core.activeTank();
        return { tank, fish: core.fishIn(tank.id), readOnly: true };
      },
      onFishTap: () => {},
      onEvent: () => {},
      reduceMotion: () => this.app.reduceMotion(),
      now: () => Date.now(),
    });
    this.view.calm = 0.6;
    this.render();
  }

  show() {
    this.visible = true;
    this.view.start();
    this.view.resize();
    this.render();
  }
  hide() {
    this.visible = false;
    this.view.stop();
    this.stopBreath();
  }
  refresh() {
    if (this.visible) this.render();
  }
  tick() {
    if (this.visible) this.renderTimer();
  }

  render() {
    const f = core.S().focus;
    const running = !!f.running;
    this.presetBox.innerHTML = "";
    if (!running) {
      this.presetBox.append(segmented(PRESETS.map((n) => ({ id: n, label: t("unit.min", { n }) })), f.preset || 25, (id) => {
        f.preset = id;
        core.changed();
        this.renderTimer();
        this.renderControls();
      }, t("focus.title")));
    }
    this.renderTimer();
    this.renderControls();
    this.renderWeek();
  }

  renderTimer() {
    const f = core.S().focus;
    const ms = f.running ? core.focusRemaining() : (f.preset || 25) * 60000;
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    this.timerEl.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    this.stateEl.textContent = f.running ? t("focus.running") + ". " + t("focus.calm") : t("focus.ready");
    this.view.calm = f.running ? 1 : 0.4;
    document.title = f.running ? this.timerEl.textContent + " · Riak" : "Riak: Cozy Aquarium";
  }

  renderControls() {
    const f = core.S().focus;
    this.controls.innerHTML = "";
    if (f.running) {
      this.controls.append(button(t("focus.stop"), { kind: "quiet", onclick: () => {
        core.focusStop();
        this.render();
      } }));
    } else {
      this.controls.append(button(t("focus.start", { n: f.preset || 25 }), { icon: "timer", kind: "primary", onclick: () => {
        core.focusStart(f.preset || 25);
        this.app.audio.chime();
        this.render();
      } }));
    }
  }

  renderWeek() {
    const days = core.focusWeek();
    const max = Math.max(30, ...days.map((d) => d.min));
    this.weekEl.innerHTML = "";
    for (const d of days) {
      const label = d.date.toLocaleDateString([], { weekday: "short" });
      this.weekEl.append(el("div", { class: "bar", title: label + ": " + t("unit.min", { n: d.min }) }, [
        el("i", { style: { height: (d.min / max) * 100 + "%" } }),
        el("span", { text: label.slice(0, 3) }),
      ]));
    }
    const week = days.reduce((a, d) => a + d.min, 0);
    this.totalEl.textContent = t("focus.weekTotal", { n: week }) + " · " + t("focus.total", { n: core.S().focus.total });
  }

  // ---------- box breathing ----------
  toggleBreath() {
    if (this.breathing) this.stopBreath();
    else this.startBreath();
  }
  startBreath() {
    this.breathing = true;
    this.breathBtn.querySelector("span").textContent = t("focus.stopBreath");
    let i = 0;
    const ring = this.breathRing.querySelector("i");
    const label = this.breathRing.querySelector("span");
    const step = () => {
      const phase = BREATH[i % 4];
      label.textContent = t("focus." + phase);
      if (phase === "in") ring.style.transform = "scale(1)";
      if (phase === "out") ring.style.transform = "scale(0.55)";
      if (phase === "in" || phase === "out") this.app.audio.bubble(phase === "in" ? 0.8 : 1.2);
      i++;
    };
    step();
    this.breathTimer = setInterval(step, 4000);
  }
  stopBreath() {
    this.breathing = false;
    clearInterval(this.breathTimer);
    if (this.breathBtn) this.breathBtn.querySelector("span").textContent = t("focus.startBreath");
    if (this.breathRing) {
      this.breathRing.querySelector("i").style.transform = "scale(0.55)";
      this.breathRing.querySelector("span").textContent = t("focus.in");
    }
  }
}
