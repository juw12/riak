// Fishing: nine places with real-time weather and time of day, a cast, a bite window and a reel-tension minigame.
import * as core from "./core.js";
import { t } from "./i18n.js";
import { el, clamp, lerp, mix, rgba, rng, hashString, TAU } from "./util.js";
import { icon, button, openSheet, toast, meter } from "./ui.js";
import { SPOTS, FISH } from "./data.js";
import { spotById, fishById, phaseOf, weatherAt, daylight, rollCatch, spotCandidates, fishValue } from "./sim.js";
import { fishThumb } from "./draw.js";
import { speciesName } from "./tankpanel.js";

const NIGHT_SKY = "#1c2a35";

// ---------- scene painter (shared by the cards and the live scene) ----------
export function paintScene(ctx, W, H, spot, ts, time, extra = {}) {
  const day = daylight(ts);
  const weather = extra.weather || weatherAt(spot.id, ts);
  const grey = weather === "rain" || weather === "fog" || weather === "snow" ? 0.35 : weather === "cloud" ? 0.18 : 0;
  const sky = mix(mix(NIGHT_SKY, spot.sky, day), "#b9c2c4", grey * day);
  const horizon = H * 0.46;
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, mix(sky, "#000000", 0.08));
  g.addColorStop(1, mix(sky, "#ffffff", 0.18 * day));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizon + 2);

  // sun or moon
  const h = new Date(ts).getHours() + new Date(ts).getMinutes() / 60;
  const isDay = h >= 6 && h < 18.5;
  const arc = isDay ? (h - 6) / 12.5 : ((h + 24 - 18.5) % 24) / 11.5;
  const bx = W * (0.1 + arc * 0.8);
  const by = horizon - Math.sin(arc * Math.PI) * horizon * 0.75;
  if (weather !== "fog" && weather !== "rain") {
    ctx.fillStyle = isDay ? rgba("#fff3c8", 0.95 - grey) : rgba("#eef2f0", 0.9);
    ctx.beginPath();
    ctx.arc(bx, by, isDay ? Math.max(8, W * 0.025) : Math.max(6, W * 0.018), 0, TAU);
    ctx.fill();
    if (!isDay) {
      ctx.fillStyle = rgba("#ffffff", 0.7);
      const r = rng(hashString(spot.id));
      for (let i = 0; i < 40; i++) {
        ctx.fillRect(r() * W, r() * horizon * 0.8, 1.2, 1.2);
      }
    }
  }

  // far hills
  const far = mix(mix(spot.far, NIGHT_SKY, 1 - day * 0.85), sky, 0.25 + grey);
  ctx.fillStyle = far;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  const r = rng(hashString(spot.id + "h"));
  const peaks = spot.id === "ocean" || spot.id === "lagoon" ? 0 : 5;
  for (let i = 0; i <= 10; i++) {
    const x = (i / 10) * W;
    const y = horizon - (peaks ? (0.05 + r() * 0.14) * H : 0.005 * H);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, horizon);
  ctx.closePath();
  ctx.fill();

  // water
  const w1 = mix(mix(spot.water1, NIGHT_SKY, 1 - day * 0.8), sky, 0.15);
  const w2 = mix(spot.water2, NIGHT_SKY, (1 - day) * 0.7);
  const wg = ctx.createLinearGradient(0, horizon, 0, H);
  wg.addColorStop(0, w1);
  wg.addColorStop(1, w2);
  ctx.fillStyle = wg;
  ctx.fillRect(0, horizon, W, H - horizon);
  // shimmer lines
  ctx.strokeStyle = rgba("#ffffff", 0.12 + 0.1 * day);
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    const y = horizon + 6 + ((i * 37) % 100) / 100 * (H - horizon) * 0.7;
    const x = ((i * 113 + time * 0.012 * (1 + (i % 3))) % (W + 80)) - 40;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 18 + (i % 4) * 8, y);
    ctx.stroke();
  }
  // lamps for the harbour
  if (spot.id === "harbor") {
    for (let i = 0; i < 4; i++) {
      const lx = W * (0.55 + i * 0.12);
      ctx.fillStyle = "#3a3a36";
      ctx.fillRect(lx - 1, horizon - H * 0.12, 2, H * 0.12);
      ctx.fillStyle = rgba("#ffd27a", 0.9 - day * 0.6);
      ctx.beginPath();
      ctx.arc(lx, horizon - H * 0.12, 3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba("#ffd27a", 0.18 * (1 - day));
      ctx.fillRect(lx - 3, horizon, 6, H * 0.3);
    }
  }

  // near bank (bottom-left) with reeds
  const near = mix(spot.near, NIGHT_SKY, (1 - day) * 0.75);
  ctx.fillStyle = near;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H * 0.72);
  ctx.quadraticCurveTo(W * 0.16, H * 0.7, W * 0.3, H * 0.86);
  ctx.quadraticCurveTo(W * 0.36, H * 0.95, W * 0.42, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = mix(near, "#000000", 0.2);
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const x = W * (0.02 + i * 0.022);
    const top = H * (0.58 + ((i * 7) % 10) / 100);
    ctx.beginPath();
    ctx.moveTo(x, H * 0.76);
    ctx.quadraticCurveTo(x + Math.sin(time * 0.001 + i) * 3, (top + H * 0.76) / 2, x + Math.sin(time * 0.0012 + i) * 5, top);
    ctx.stroke();
  }

  // weather
  if (weather === "rain") {
    ctx.strokeStyle = rgba("#dfe8ea", 0.45);
    ctx.lineWidth = 1;
    const rr = rng(7);
    for (let i = 0; i < 90; i++) {
      const x = (rr() * W + time * 0.05) % W;
      const y = (rr() * H + time * 0.6) % H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 10);
      ctx.stroke();
    }
  } else if (weather === "snow") {
    ctx.fillStyle = rgba("#ffffff", 0.85);
    const rr = rng(11);
    for (let i = 0; i < 70; i++) {
      const x = (rr() * W + Math.sin(time * 0.001 + i) * 8) % W;
      const y = (rr() * H + time * 0.04) % H;
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, TAU);
      ctx.fill();
    }
  } else if (weather === "fog") {
    ctx.fillStyle = rgba("#e8ecea", 0.35);
    ctx.fillRect(0, 0, W, H);
  }
}

// "sunny" reads oddly at night, so clear skies after dark are called clear.
export function weatherLabel(spotId, ts) {
  const w = weatherAt(spotId, ts);
  const phase = phaseOf(ts);
  if (w === "sun" && (phase === "night" || phase === "dusk")) return t("weather.clear");
  return t("weather." + w);
}

export class FishingPanel {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.spot = null;
    this.bait = "worm";
    this.stateName = "idle";
    this.raf = 0;
    this.visible = false;
  }

  init() {
    this.renderList();
  }
  show() {
    this.visible = true;
    if (this.spot) this.loop();
    else this.renderList();
  }
  hide() {
    this.visible = false;
    cancelAnimationFrame(this.raf);
    if (this.stateName !== "idle" && this.stateName !== "result") this.resetCast();
  }
  refresh() {
    if (!this.spot) this.renderList();
    else this.renderSide();
  }

  // ---------- spot list ----------
  renderList() {
    cancelAnimationFrame(this.raf);
    this.spot = null;
    const s = core.S();
    const root = this.root;
    root.innerHTML = "";
    const totalFound = Object.values(s.journal.fish).filter((j) => j.count > 0).length;
    root.append(el("div", { class: "panel-head" }, [
      el("div", {}, [el("h2", { text: t("fishing.title") }), el("p", { text: t("fishing.lead") })]),
      el("span", { class: "chip" }, [icon("book", 16), el("span", { text: t("fishing.found", { a: totalFound, b: FISH.length }) })]),
    ]));
    const grid = el("div", { class: "spot-grid" });
    const now = Date.now();
    for (const spot of SPOTS) {
      const unlocked = s.unlockedSpots.includes(spot.id);
      const fishHere = FISH.filter((f) => f.spots.includes(spot.id));
      const found = fishHere.filter((f) => s.journal.fish[f.id]?.count > 0).length;
      const weather = weatherAt(spot.id, now);
      const cv = el("canvas", { "aria-hidden": "true" });
      const card = el("button", { type: "button", class: "spot" + (unlocked ? "" : " locked"), disabled: !unlocked, "aria-label": t("spot." + spot.id) + (unlocked ? "" : ". " + t("common.unlockAt", { n: spot.level })) }, [
        cv,
        el("div", { class: "spot-body" }, [
          el("div", { class: "spot-title" }, [el("span", { text: t("spot." + spot.id) }), unlocked ? el("small", { class: "muted", text: t("journal.progress", { a: found, b: fishHere.length }) }) : el("span", { class: "tag muted" }, [icon("lock", 12), t("common.unlockAt", { n: spot.level })])]),
          el("div", { class: "muted", style: { fontSize: "14px" }, text: t("spot." + spot.id + ".d") }),
          el("div", { class: "spot-meta" }, [el("span", { text: t("phase." + phaseOf(now)) }), el("span", { text: weatherLabel(spot.id, now) }), el("span", { text: t("water." + spot.water) })]),
        ]),
      ]);
      card.addEventListener("click", () => this.enter(spot.id));
      grid.append(card);
      requestAnimationFrame(() => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const W = cv.clientWidth || 260;
        const H = cv.clientHeight || 96;
        cv.width = W * dpr;
        cv.height = H * dpr;
        const ctx = cv.getContext("2d");
        ctx.scale(dpr, dpr);
        paintScene(ctx, W, H, spot, now, 0);
      });
    }
    root.append(grid);
  }

  // ---------- scene ----------
  enter(spotId) {
    this.spot = spotById[spotId];
    const s = core.S();
    if (this.bait !== "worm" && !(s.inv.bait[this.bait] > 0)) this.bait = "worm";
    const root = this.root;
    root.innerHTML = "";
    this.canvas = el("canvas", { role: "img", "aria-label": t("spot." + spotId) });
    this.status = el("div", { class: "scene-status", role: "status", "aria-live": "assertive" });
    const wrap = el("div", { class: "scene-wrap" }, [this.canvas, this.status]);
    this.actionBtn = el("button", { type: "button", class: "btn primary big-btn" });
    this.reelBox = el("div", { class: "reel", hidden: true });
    this.side = el("aside", { class: "notes" });
    root.append(el("div", { class: "panel-head" }, [
      el("div", {}, [el("h2", { text: t("spot." + spotId) }), el("p", { text: t("spot." + spotId + ".d") })]),
      button(t("fishing.leave"), { icon: "back", kind: "quiet", onclick: () => this.renderList() }),
    ]));
    root.append(el("div", { class: "scene" }, [el("div", {}, [wrap, this.reelBox, el("div", { style: { marginTop: "12px" } }, [this.actionBtn])]), this.side]));
    this.bindAction();
    this.resetCast();
    this.renderSide();
    this.loop();
  }

  renderSide() {
    if (!this.side) return;
    const s = core.S();
    const now = Date.now();
    const spot = this.spot;
    const side = this.side;
    side.innerHTML = "";
    side.append(el("section", {}, [
      el("h3", { text: t("fishing.now", { phase: t("phase." + phaseOf(now)), weather: weatherLabel(spot.id, now) }) }),
      el("p", { class: "explain", text: t("fishing.timeHint") }),
    ]));
    const baits = el("div", { class: "bait-list", role: "radiogroup", "aria-label": t("fishing.bait") });
    for (const b of core.BAITS) {
      const count = b.id === "worm" ? t("food.unlimited") : t("food.left", { n: s.inv.bait[b.id] || 0 });
      const locked = b.id === "glowlure" && core.level() < core.LEVEL_GATES.glowlure;
      const disabled = locked || (b.id !== "worm" && !(s.inv.bait[b.id] > 0));
      const btn = el("button", { type: "button", class: "bait", role: "radio", "aria-checked": String(this.bait === b.id), "aria-pressed": String(this.bait === b.id), disabled }, [
        el("b", { text: t("bait." + b.id) }),
        el("span", { class: "muted", text: locked ? t("common.unlockAt", { n: core.LEVEL_GATES.glowlure }) : count }),
        el("small", { text: t("bait." + b.id + ".d") }),
      ]);
      btn.addEventListener("click", () => {
        this.bait = b.id;
        this.renderSide();
      });
      baits.append(btn);
    }
    side.append(el("section", {}, [el("h3", { text: t("fishing.bait") }), baits, el("p", { class: "explain", text: t("fishing.buyBait") })]));
    // biting now
    const list = spotCandidates(spot.id, now, this.bait).sort((a, b) => b.w - a.w);
    const total = list.reduce((a, c) => a + c.w, 0);
    const chips = el("div", { class: "bite-list" });
    let unknownCount = 0;
    let unknownShare = 0;
    for (const c of list.filter((x) => x.w / total >= 0.01)) {
      const share = c.w / total;
      if (s.journal.fish[c.sp.id]?.count > 0) {
        if (chips.children.length < 6) chips.append(el("span", { class: "tag", text: speciesName(c.sp.id) + " " + Math.round(share * 100) + "%" }));
      } else {
        unknownCount++;
        unknownShare += share;
      }
    }
    const biteSection = el("section", {}, [el("h3", { text: t("fishing.bites") })]);
    if (chips.children.length) biteSection.append(chips);
    if (unknownCount) biteSection.append(el("p", { class: "explain", text: t("fishing.unknownSum", { n: unknownCount, p: Math.round(unknownShare * 100) }) }));
    side.append(biteSection);
  }

  // ---------- input ----------
  bindAction() {
    const btn = this.actionBtn;
    const down = (e) => {
      e.preventDefault();
      this.press(true);
    };
    const up = (e) => {
      e.preventDefault();
      this.press(false);
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointerleave", (e) => {
      if (this.holding) up(e);
    });
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("keydown", (e) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) down(e);
    });
    btn.addEventListener("keyup", (e) => {
      if (e.key === " " || e.key === "Enter") up(e);
    });
  }

  press(isDown) {
    this.holding = isDown;
    const st = this.stateName;
    const now = performance.now();
    if (st === "idle" && isDown) {
      this.stateName = "charging";
      this.chargeStart = now;
    } else if (st === "charging" && !isDown) {
      this.cast(clamp((now - this.chargeStart) / 1200, 0.15, 1));
    } else if ((st === "waiting" || st === "nibble") && isDown) {
      this.setStatus(t("fishing.tooEarly"));
      this.resetCast(900);
    } else if (st === "bite" && isDown) {
      this.startReel();
    } else if (st === "missed" || st === "lost") {
      if (isDown) this.resetCast();
    }
    this.renderAction();
  }

  setStatus(text) {
    this.status.textContent = text;
    this.status.hidden = !text;
  }

  renderAction() {
    const st = this.stateName;
    const label = {
      idle: t("fishing.cast"),
      charging: t("fishing.release"),
      flying: t("fishing.wait"),
      waiting: t("fishing.wait"),
      nibble: t("fishing.wait"),
      bite: t("fishing.hook"),
      reel: t("fishing.reelBtn"),
      lost: t("fishing.again"),
      missed: t("fishing.again"),
      result: t("fishing.again"),
    }[st];
    this.actionBtn.textContent = label;
    this.actionBtn.disabled = st === "flying" || st === "result";
    this.actionBtn.classList.toggle("danger", st === "bite");
  }

  resetCast(delay = 0) {
    clearTimeout(this.resetTimer);
    const go = () => {
      this.stateName = "idle";
      this.bobber = null;
      this.reel = null;
      this.reelBox.hidden = true;
      this.setStatus(t("fishing.hold"));
      this.renderAction();
    };
    if (delay) {
      this.stateName = "missed";
      this.renderAction();
      this.resetTimer = setTimeout(go, delay);
    } else go();
  }

  cast(power) {
    const s = core.S();
    if (this.bait !== "worm") {
      if (!(s.inv.bait[this.bait] > 0)) this.bait = "worm";
      else {
        s.inv.bait[this.bait]--;
        core.changed();
      }
    }
    this.castBait = this.bait;
    this.stateName = "flying";
    const now = performance.now();
    this.bobber = { x0: 0.2, y0: 0.62, x: 0.2, y: 0.62, tx: 0.38 + power * 0.48, ty: 0.52 + (1 - power) * 0.3, start: now, dip: 0 };
    const weather = weatherAt(this.spot.id, Date.now());
    let wait = 2600 + Math.random() * 4800;
    if (this.castBait === "shrimpbait") wait *= 0.85;
    if (this.castBait === "glowlure") wait *= 0.9;
    if (weather === "rain") wait *= 0.8;
    this.biteAt = now + 700 + wait;
    this.nibbles = [this.biteAt - 1500, this.biteAt - 800].filter((x) => x > now + 900 && Math.random() < 0.8);
    this.app.audio.bubble(0.7);
    this.setStatus(t("fishing.wait"));
    this.renderSide();
  }

  startReel() {
    const result = rollCatch(this.spot.id, Date.now(), this.castBait);
    const sp = fishById[result.sp];
    this.pending = result;
    this.stateName = "reel";
    this.reel = {
      zone: 0.35,
      zoneV: 0,
      zoneW: clamp(0.36 - sp.rar * 0.035 - (result.golden ? 0.03 : 0), 0.16, 0.36),
      fish: 0.5,
      fishT: 0.5,
      speed: 0.25 + sp.rar * 0.12,
      progress: 0.3,
      last: performance.now(),
      seed: Math.random() * 100,
    };
    this.reelBox.hidden = false;
    this.reelBox.innerHTML = "";
    this.zoneEl = el("div", { class: "reel-zone" });
    this.fishEl = el("div", { class: "reel-fish" });
    this.progressEl = meter(30, 100, t("fishing.reel"));
    this.progressEl.classList.add("reel-progress");
    const legend = el("div", { class: "reel-legend", "aria-hidden": "true" }, [
      el("span", {}, [el("i", { class: "k-fish" }), t("fishing.keyFish")]),
      el("span", {}, [el("i", { class: "k-zone" }), t("fishing.keyZone")]),
      el("span", {}, [el("i", { class: "k-prog" }), t("fishing.keyProgress")]),
    ]);
    this.reelBox.append(el("div", { class: "reel-track", "aria-hidden": "true" }, [this.zoneEl, this.fishEl]), legend, this.progressEl, el("p", { class: "explain", text: t("fishing.reel") }));
    this.setStatus(t("fishing.reelStatus"));
    this.app.audio.bubble(1.6);
  }

  updateReel(now) {
    const r = this.reel;
    const dt = Math.min(0.05, (now - r.last) / 1000);
    r.last = now;
    // the fish darts to new targets
    if (Math.abs(r.fish - r.fishT) < 0.02 || Math.random() < dt * r.speed * 0.8) r.fishT = clamp(Math.random(), 0.04, 0.96);
    r.fish += (r.fishT - r.fish) * clamp(dt * (1.2 + r.speed * 2.2), 0, 1);
    // the zone rises while holding, sinks when released
    r.zoneV += (this.holding ? 2.2 : -1.9) * dt;
    r.zoneV = clamp(r.zoneV, -1.1, 1.1);
    r.zone += r.zoneV * dt;
    if (r.zone < 0) {
      r.zone = 0;
      r.zoneV = Math.max(0, r.zoneV) * 0.3;
    }
    if (r.zone > 1 - r.zoneW) {
      r.zone = 1 - r.zoneW;
      r.zoneV = Math.min(0, r.zoneV) * 0.3;
    }
    const inside = r.fish >= r.zone && r.fish <= r.zone + r.zoneW;
    r.progress = clamp(r.progress + (inside ? 0.3 : -0.2) * dt, 0, 1);
    this.zoneEl.style.left = r.zone * 100 + "%";
    this.zoneEl.style.width = r.zoneW * 100 + "%";
    this.fishEl.style.left = r.fish * 100 + "%";
    this.progressEl.firstChild.style.width = r.progress * 100 + "%";
    this.progressEl.setAttribute("aria-valuenow", String(Math.round(r.progress * 100)));
    if (this.bobber) this.bobber.dip = inside ? 0.6 : 1;
    if (r.progress >= 1) this.landed();
    else if (r.progress <= 0) {
      this.stateName = "lost";
      this.reelBox.hidden = true;
      this.setStatus(t("fishing.lost"));
      this.renderAction();
    }
  }

  landed() {
    this.stateName = "result";
    this.reelBox.hidden = true;
    this.renderAction();
    const res = core.catchFish(this.pending, this.spot.id);
    this.app.audio.chime();
    this.openCatch(res);
  }

  openCatch(res) {
    const fish = res.fish;
    const sp = fishById[fish.sp];
    const s = core.S();
    let decided = false;
    const cv = el("canvas", { "aria-hidden": "true" });
    const tags = el("div", { class: "row" }, [
      el("span", { class: "tag rar-" + sp.rar, text: t("rar." + sp.rar) }),
      res.isNew ? el("span", { class: "tag", text: t("fishing.newSpecies") }) : null,
      res.isRecord ? el("span", { class: "tag", text: t("fishing.record") }) : null,
      fish.golden ? el("span", { class: "tag gold", text: t("fishing.golden") }) : null,
    ]);
    const body = el("div", {}, [
      el("div", { class: "fish-hero" }, [cv, el("div", {}, [el("h3", { text: speciesName(fish.sp) }), el("div", { class: "muted", text: sp.sci + " · " + fish.size + " cm" }), tags])]),
      el("p", { class: "muted", text: t("fishd." + fish.sp) }),
      el("p", { class: "explain", text: t("fish.card.temp", { min: sp.temp[0], max: sp.temp[1] }) + (sp.school ? " · " + t("fish.card.school", { n: sp.school }) : "") + " · " + t("journal.water") + ": " + t("water." + sp.water) }),
      res.frag ? el("p", { class: "tag", text: t("fishing.wildFrag") + (res.frag.pending ? " " + t("fishing.fragPending") : "") }) : null,
    ]);
    requestAnimationFrame(() => fishThumb(cv, fish));
    const homes = s.tanks.filter((tk) => core.canHouse(fish, tk));
    const decide = (fn) => {
      decided = true;
      fn();
      sheet.close();
    };
    const actions = [];
    for (const tk of homes.slice(0, 2)) actions.push(button(t("fishing.putIn", { tank: tk.name }), { kind: "primary", onclick: () => decide(() => core.placeFish(fish, tk.id)) }));
    actions.push(
      button(t("fishing.toBucket") + " (" + core.bucket().length + "/" + core.BUCKET_CAP + ")", { kind: "quiet", disabled: core.bucket().length >= core.BUCKET_CAP, onclick: () => decide(() => core.placeFish(fish, "bucket")) }),
      button(t("fish.card.sell", { n: fishValue(fish) }), { kind: "quiet", onclick: () => decide(() => core.sellFish(fish)) }),
      button(t("fish.card.release"), { kind: "ghost", onclick: () => decide(() => core.releaseFish(fish)) }),
    );
    const sheet = openSheet({
      title: t("fishing.caught") + ": " + speciesName(fish.sp),
      body,
      actions,
      onClose: () => {
        if (!decided) {
          if (core.bucket().length < core.BUCKET_CAP) core.placeFish(fish, "bucket");
          else core.releaseFish(fish);
        }
        this.resetCast();
        this.renderSide();
      },
    });
  }

  // ---------- animation ----------
  loop() {
    cancelAnimationFrame(this.raf);
    const frame = (time) => {
      if (!this.visible || !this.spot) return;
      this.step(time);
      this.draw(time);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  step(now) {
    const st = this.stateName;
    const b = this.bobber;
    if (st === "flying" && b) {
      const k = clamp((now - b.start) / 700, 0, 1);
      b.x = lerp(b.x0, b.tx, k);
      b.y = lerp(b.y0, b.ty, k) - Math.sin(k * Math.PI) * 0.25;
      if (k >= 1) {
        this.stateName = "waiting";
        this.splash = { x: b.tx, y: b.ty, t: now };
        this.renderAction();
      }
    } else if (st === "waiting" || st === "nibble") {
      if (this.nibbles.length && now >= this.nibbles[0]) {
        this.nibbles.shift();
        this.stateName = "nibble";
        b.dip = 0.35;
        setTimeout(() => {
          if (this.bobber) this.bobber.dip = 0;
        }, 220);
      }
      if (now >= this.biteAt) {
        this.stateName = "bite";
        b.dip = 1;
        this.biteEnd = now + 1100;
        this.setStatus(t("fishing.bite"));
        this.app.audio.bubble(1.8);
        this.renderAction();
        this.actionBtn.focus();
      }
    } else if (st === "bite") {
      if (now > this.biteEnd) {
        this.setStatus(t("fishing.missed"));
        this.stateName = "missed";
        this.bobber = null;
        this.renderAction();
      }
    } else if (st === "reel") {
      this.updateReel(now);
    }
  }

  draw(time) {
    const cv = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth;
    const H = cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const reduce = this.app.reduceMotion();
    paintScene(ctx, W, H, this.spot, Date.now(), reduce ? 0 : time);
    // rod
    const tipX = W * 0.24;
    const tipY = H * 0.44;
    ctx.strokeStyle = "#3b2f25";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    const bend = this.stateName === "reel" ? 0.04 : this.stateName === "charging" ? -0.03 : 0;
    ctx.moveTo(W * 0.06, H * 0.98);
    ctx.quadraticCurveTo(W * (0.14 + bend), H * 0.66, tipX, tipY + bend * H);
    ctx.stroke();
    // line and bobber
    const b = this.bobber;
    if (b) {
      const bob = Math.sin(time * 0.004) * 0.004;
      const bx = b.x * W;
      const by = (b.y + bob + b.dip * 0.02) * H;
      ctx.strokeStyle = "rgba(240,240,235,0.75)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY + bend * H);
      ctx.quadraticCurveTo((tipX + bx) / 2, Math.max(tipY, by) + 20, bx, by);
      ctx.stroke();
      ctx.fillStyle = "#f2efe6";
      ctx.beginPath();
      ctx.arc(bx, by - 4, 5, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = this.castBait === "glowlure" ? "#e8c04a" : "#c4552f";
      ctx.beginPath();
      ctx.arc(bx, by - 4, 5, 0, Math.PI);
      ctx.fill();
      if (this.stateName === "bite" || this.stateName === "reel") {
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        const k = (time % 700) / 700;
        ctx.beginPath();
        ctx.ellipse(bx, by, 8 + k * 22, 3 + k * 7, 0, 0, TAU);
        ctx.stroke();
      }
    }
    if (this.splash) {
      const k = (time - this.splash.t) / 900;
      if (k < 1) {
        ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`;
        ctx.beginPath();
        ctx.ellipse(this.splash.x * W, this.splash.y * H, 6 + k * 30, 2 + k * 9, 0, 0, TAU);
        ctx.stroke();
      } else this.splash = null;
    }
    if (this.stateName === "charging") {
      const k = clamp((performance.now() - this.chargeStart) / 1200, 0, 1);
      ctx.fillStyle = "rgba(16,28,26,0.55)";
      ctx.fillRect(W * 0.3, H - 22, W * 0.4, 10);
      ctx.fillStyle = "#e8c04a";
      ctx.fillRect(W * 0.3, H - 22, W * 0.4 * k, 10);
    }
  }
}
