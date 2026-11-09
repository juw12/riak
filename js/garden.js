// Garden: the greenhouse (aquarium plants and houseplants, rare sports) and the reef lab (frag, cross, discover strains).
import * as core from "./core.js";
import { t } from "./i18n.js";
import { el, clamp, rng, hashString, mix, TAU, formatDuration } from "./util.js";
import { icon, button, openSheet, toast, meter, segmented } from "./ui.js";
import { plantById, houseById, cropProgress, strainName } from "./sim.js";
import { drawPlant, drawCoral } from "./draw.js";
import { PLANTS, HOUSEPLANTS, CORAL_FORMS } from "./data.js";
import { plantName } from "./tankpanel.js";

function setupCanvas(cv) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth || 200;
  const H = cv.clientHeight || 110;
  if (cv.width !== Math.round(W * dpr)) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  }
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  return { ctx, W, H };
}

function drawHouseplant(ctx, hp, x, base, size, grown, variegated, time) {
  const r = rng(hashString(hp.id));
  const leaf = variegated ? mix(hp.leaf, "#f1ecd8", 0.45) : hp.leaf;
  const leaf2 = variegated ? mix(hp.leaf2, "#e8dfb8", 0.35) : hp.leaf2;
  // pot
  ctx.fillStyle = "#b5734f";
  ctx.beginPath();
  ctx.moveTo(x - size * 0.22, base - size * 0.26);
  ctx.lineTo(x + size * 0.22, base - size * 0.26);
  ctx.lineTo(x + size * 0.17, base);
  ctx.lineTo(x - size * 0.17, base);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#9a5f40";
  ctx.fillRect(x - size * 0.24, base - size * 0.3, size * 0.48, size * 0.06);
  const n = 3 + Math.round(grown * 6);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.2;
    const len = size * (0.22 + grown * 0.45) * (0.7 + r() * 0.4);
    const sway = Math.sin(time * 0.001 + i) * 0.04;
    const tx = x + Math.cos(a + sway) * len;
    const ty = base - size * 0.3 + Math.sin(a + sway) * len;
    ctx.strokeStyle = leaf2;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, base - size * 0.3);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.fillStyle = i % 2 ? leaf : mix(leaf, leaf2, 0.4);
    ctx.beginPath();
    ctx.ellipse(tx, ty, size * 0.09 * (0.6 + grown * 0.6), size * 0.05 * (0.6 + grown * 0.6), a + sway, 0, TAU);
    ctx.fill();
  }
}

// ---------- greenhouse bay art ----------
// Each tray is drawn as one bay of a small glasshouse: glazing with a warm sky behind it, foliage
// outside, a timber bench and a seed tray. Empty bays show a seed packet and trowel instead of an outline.
const BENCH_H = 16;

function drawBay(ctx, W, H, { seed, state, progress, kind, time }) {
  const r = rng(seed);
  const benchTop = H - BENCH_H;
  // sky through the glass
  const sky = ctx.createLinearGradient(0, 0, 0, benchTop);
  sky.addColorStop(0, "#eef2ea");
  sky.addColorStop(0.6, "#e4ece2");
  sky.addColorStop(1, "#d9e5d6");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, benchTop);
  // soft garden outside: two rows of rounded shrubs
  const rows = [
    { y: benchTop - H * 0.2, c: "rgba(150, 180, 146, 0.55)", s: 0.16 },
    { y: benchTop - H * 0.08, c: "rgba(118, 156, 116, 0.6)", s: 0.12 },
  ];
  for (const row of rows) {
    ctx.fillStyle = row.c;
    ctx.beginPath();
    ctx.moveTo(0, benchTop);
    let x = -10;
    while (x < W + 20) {
      const rad = H * row.s * (0.7 + r() * 0.6);
      ctx.arc(x + rad, row.y, rad, Math.PI, 0);
      x += rad * 1.6;
    }
    ctx.lineTo(W, benchTop);
    ctx.closePath();
    ctx.fill();
  }
  // sun haze top-left
  const haze = ctx.createRadialGradient(W * 0.2, H * 0.05, 2, W * 0.2, H * 0.05, W * 0.7);
  haze.addColorStop(0, "rgba(255, 246, 222, 0.75)");
  haze.addColorStop(1, "rgba(255, 246, 222, 0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, benchTop);
  // glazing bars: white-painted timber with a thin shadow
  const bars = 3;
  ctx.fillStyle = "rgba(60, 80, 66, 0.12)";
  for (let i = 1; i <= bars; i++) ctx.fillRect((W * i) / (bars + 1) + 1.5, 0, 3, benchTop);
  ctx.fillRect(0, H * 0.3 + 1.5, W, 3);
  ctx.fillStyle = "#f8f6ef";
  for (let i = 1; i <= bars; i++) ctx.fillRect((W * i) / (bars + 1) - 1.5, 0, 3, benchTop);
  ctx.fillRect(0, H * 0.3 - 1.5, W, 3);
  // a diagonal glint across the glass
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(W * 0.58, 0);
  ctx.lineTo(W * 0.68, 0);
  ctx.lineTo(W * 0.38, benchTop);
  ctx.lineTo(W * 0.32, benchTop);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // timber bench
  ctx.fillStyle = "#c39a6b";
  ctx.fillRect(0, benchTop, W, 6);
  ctx.fillStyle = "#9c744b";
  ctx.fillRect(0, benchTop + 6, W, BENCH_H - 6);
  ctx.strokeStyle = "rgba(90, 60, 34, 0.25)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const gy = benchTop + 8 + i * 3;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    for (let x = 0; x <= W; x += 12) ctx.lineTo(x, gy + Math.sin(x * 0.07 + i + seed) * 0.8);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255, 240, 215, 0.45)";
  ctx.fillRect(0, benchTop, W, 1);
  if (kind === "house") {
    drawTools(ctx, W, benchTop, r, state === "ready");
    return;
  }
  // seed tray with cells
  const tw = Math.min(W * 0.78, 260);
  const tx = (W - tw) / 2;
  const ty = benchTop - 11;
  ctx.fillStyle = "rgba(40, 30, 20, 0.22)";
  ctx.beginPath();
  ctx.ellipse(W / 2, benchTop + 1, tw * 0.52, 3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#3d4741";
  ctx.beginPath();
  ctx.moveTo(tx - 3, ty);
  ctx.lineTo(tx + tw + 3, ty);
  ctx.lineTo(tx + tw - 2, benchTop);
  ctx.lineTo(tx + 2, benchTop);
  ctx.closePath();
  ctx.fill();
  const wet = state === "watered";
  ctx.fillStyle = wet ? "#3f3024" : "#5d4837";
  ctx.fillRect(tx, ty, tw, 3);
  ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
  ctx.fillRect(tx - 3, ty + 3, tw + 6, 1);
  const cells = 5;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  for (let i = 1; i < cells; i++) {
    const cx = tx + (tw * i) / cells;
    ctx.beginPath();
    ctx.moveTo(cx, ty + 4);
    ctx.lineTo(cx, benchTop - 1);
    ctx.stroke();
  }
  // companions in the side cells grow with the main plant
  for (let i = 0; i < cells; i++) {
    if (i === Math.floor(cells / 2)) continue;
    const cx = tx + (tw * (i + 0.5)) / cells;
    if (state === "empty") {
      ctx.fillStyle = "#c9b48e";
      ctx.beginPath();
      ctx.ellipse(cx + (r() - 0.5) * 4, ty + 1.2, 1.6, 1, 0.4, 0, TAU);
      ctx.fill();
    } else {
      const g = Math.min(1, progress * (0.7 + r() * 0.5));
      drawSprout(ctx, cx, ty + 1, 4 + g * 10, time, i);
    }
  }
  if (state === "empty") drawTools(ctx, W, benchTop, r, false);
}

function drawSprout(ctx, x, base, h, time, i) {
  const sway = time ? Math.sin(time * 0.0012 + i) * 1.2 : 0;
  ctx.strokeStyle = "#5f8a4e";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.quadraticCurveTo(x + sway * 0.5, base - h * 0.6, x + sway, base - h);
  ctx.stroke();
  ctx.fillStyle = "#79a861";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + sway + side * h * 0.22, base - h + 1, h * 0.24, h * 0.11, side * 0.5, 0, TAU);
    ctx.fill();
  }
}

// A seed packet and a trowel resting on the bench: the bay is ready to plant.
function drawTools(ctx, W, benchTop, r, ready) {
  const px = W * 0.82;
  const ph = Math.min(30, benchTop * 0.32);
  const pw = ph * 0.7;
  ctx.save();
  ctx.translate(px, benchTop);
  ctx.rotate(-0.12);
  ctx.fillStyle = "rgba(40, 30, 20, 0.18)";
  ctx.fillRect(-pw / 2 + 2, -ph + 2, pw, ph);
  ctx.fillStyle = "#f3ead3";
  ctx.fillRect(-pw / 2, -ph, pw, ph);
  ctx.fillStyle = "#5f8a4e";
  ctx.fillRect(-pw / 2, -ph * 0.42, pw, ph * 0.18);
  ctx.fillStyle = "#79a861";
  ctx.beginPath();
  ctx.ellipse(0, -ph * 0.7, pw * 0.2, pw * 0.11, -0.6, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(90, 70, 50, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-pw / 2, -ph + 3);
  ctx.lineTo(pw / 2, -ph + 3);
  ctx.stroke();
  ctx.restore();
  // trowel lying on the bench
  const tx = W * 0.14;
  const ty = benchTop - 2;
  ctx.fillStyle = "#8a6440";
  ctx.beginPath();
  ctx.roundRect(tx - 2, ty - 2.5, 16, 5, 2.5);
  ctx.fill();
  ctx.fillStyle = "#a9b2ad";
  ctx.beginPath();
  ctx.moveTo(tx + 14, ty - 4);
  ctx.quadraticCurveTo(tx + 30, ty - 5, tx + 34, ty);
  ctx.quadraticCurveTo(tx + 30, ty + 4, tx + 14, ty + 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.fillRect(tx + 16, ty - 2.5, 12, 1);
  if (ready) {
    ctx.fillStyle = "rgba(255, 236, 190, 0.35)";
    ctx.beginPath();
    ctx.arc(W / 2, benchTop - benchTop * 0.45, benchTop * 0.42, 0, TAU);
    ctx.fill();
  }
}

function drawDroplets(ctx, W, soil, time) {
  ctx.fillStyle = "rgba(170, 205, 220, 0.85)";
  for (let i = 0; i < 4; i++) {
    const phase = time ? ((time * 0.0006 + i * 0.27) % 1) : 0.4 + i * 0.1;
    const x = W * (0.36 + i * 0.09);
    const y = soil - 28 + phase * 24;
    ctx.globalAlpha = 1 - phase * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y - 3);
    ctx.quadraticCurveTo(x + 2.2, y + 0.5, x, y + 1.8);
    ctx.quadraticCurveTo(x - 2.2, y + 0.5, x, y - 3);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Cost, grow time and outcome for one seedling, shared by the chooser and the seed shelf.
function seedInfo(kind, it) {
  const cost = core.seedlingCost(kind === "plant" ? "plant" : "house", it.id);
  const mins = kind === "house" ? it.growMin : Math.round(Math.max(10, 20 + 60 * (1 - (it.rate || 0.02) * 10)));
  const name = kind === "house" ? t("house." + it.id) : t("plant." + it.id);
  const outcome = kind === "house" ? t("garden.worth", { n: it.value }) : t("garden.yield");
  return { cost, mins, name, outcome };
}

export class GardenPanel {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.tab = "greenhouse";
    this.crossA = null;
    this.trayRefs = [];
  }
  init() {
    this.render();
  }
  show() {
    this.visible = true;
    this.render();
  }
  hide() {
    this.visible = false;
  }
  refresh() {
    if (this.visible) this.render();
  }
  tick() {
    if (!this.visible || this.tab !== "greenhouse") return;
    const now = Date.now();
    for (const ref of this.trayRefs) this.updateTray(ref, now);
  }

  render() {
    const s = core.S();
    const root = this.root;
    const scroll = window.scrollY;
    root.innerHTML = "";
    root.append(el("div", { class: "panel-head" }, [
      el("div", {}, [el("h2", { text: t("garden.title") }), el("p", { text: t(this.tab === "greenhouse" ? "garden.lead" : "reef.lead") })]),
      segmented([
        { id: "greenhouse", label: t("garden.greenhouse") },
        { id: "reef", label: t("garden.reef") },
      ], this.tab, (id) => {
        this.tab = id;
        this.crossA = null;
        this.render();
      }, t("garden.title")),
    ]));
    if (this.tab === "greenhouse") this.renderGreenhouse(root, s);
    else this.renderReef(root, s);
    window.scrollTo(0, scroll);
  }

  // ---------- greenhouse ----------
  renderGreenhouse(root, s) {
    if (!s.greenhouse.unlocked) {
      root.append(el("div", { class: "card" }, [el("h3", { text: t("garden.greenhouse") }), el("p", { class: "muted", text: t("garden.locked") })]));
      return;
    }
    const trays = el("div", { class: "trays" });
    this.trayRefs = [];
    s.greenhouse.trays.forEach((tray, i) => {
      const cv = el("canvas", { "aria-hidden": "true" });
      const title = el("div", { class: "tray-title" }, [el("span", { text: t("garden.tray", { n: i + 1 }) }), el("small", { class: "muted" })]);
      const status = el("div", { class: "muted", style: { fontSize: "14px" } });
      const bar = meter(0, 100, t("garden.tray", { n: i + 1 }));
      const actions = el("div", { class: "row" });
      const card = el("div", { class: "tray" }, [cv, title, bar, status, actions]);
      trays.append(card);
      const ref = { tray, cv, title, status, bar, actions, state: null };
      this.trayRefs.push(ref);
    });
    const inv = el("div", { class: "inv-section" });
    this.fillInventory(inv, s);
    const left = el("div", { class: "garden-main" }, [
      trays,
      el("p", { class: "explain", text: t("garden.waterHint") }),
      this.loopStrip(),
      this.seedShelf(s),
    ]);
    const side = el("div", { class: "garden-side" }, [inv, this.gardenOrders()]);
    root.append(el("div", { class: "two-col" }, [left, side]));
    requestAnimationFrame(() => {
      for (const ref of this.trayRefs) this.updateTray(ref, Date.now(), true);
    });
  }

  updateTray(ref, now, force = false) {
    const crop = ref.tray.crop;
    const p = crop ? cropProgress(crop, now) : 0;
    const state = !crop ? "empty" : p >= 1 ? "ready" : crop.water > 0 ? "watered" : "growing";
    const { ctx, W, H } = setupCanvas(ref.cv);
    drawBay(ctx, W, H, {
      seed: hashString(ref.tray.id || "tray"),
      state,
      progress: p,
      kind: crop ? crop.kind : null,
      time: this.app.reduceMotion() ? 0 : now,
    });
    if (crop) {
      const variegated = crop.sport && p >= 0.5;
      const soil = H - BENCH_H - 9;
      if (crop.kind === "house") drawHouseplant(ctx, houseById[crop.id], W / 2, H - BENCH_H + 1, H * 0.9, p, variegated, this.app.reduceMotion() ? 0 : now);
      else drawPlant(ctx, { id: ref.tray.id, sp: crop.id, g: 0.15 + p * 0.95, v: variegated ? 1 : 0, x: 0.5 }, W / 2, soil, H * 1.2, this.app.reduceMotion() ? 0 : now, {});
      if (state === "watered") drawDroplets(ctx, W, soil, this.app.reduceMotion() ? 0 : now);
    }
    ref.bar.firstChild.style.width = p * 100 + "%";
    ref.bar.setAttribute("aria-valuenow", String(Math.round(p * 100)));
    const name = crop ? (crop.kind === "house" ? t("house." + crop.id) : t("plant." + crop.id)) : t("garden.empty");
    ref.title.lastChild.textContent = name;
    if (crop) {
      const left = Math.max(0, (crop.need - crop.grown) / (crop.water > 0 ? 1.5 : 1));
      ref.status.textContent = p >= 1 ? t("garden.ready") + (crop.sport ? ". " + t("garden.sport") : "") : t("garden.growing", { p: Math.floor(p * 100) }) + ", " + t("garden.left", { t: formatDuration(left, t) }) + (crop.sport && p >= 0.5 ? ". " + t("garden.sport") : "");
    } else {
      ref.status.textContent = t("garden.emptyHint");
    }
    if (state === ref.state && !force) return;
    ref.state = state;
    ref.actions.innerHTML = "";
    if (state === "empty") ref.actions.append(button(t("garden.plant"), { icon: "plus", kind: "primary small", onclick: () => this.openChooser(ref.tray) }));
    if (state === "growing") ref.actions.append(button(t("garden.water"), { icon: "drop", kind: "quiet small", onclick: () => {
      core.waterTray(ref.tray);
      this.app.audio.bubble(1.1);
      this.updateTray(ref, Date.now(), true);
    } }));
    if (state === "watered") ref.actions.append(el("span", { class: "tag", text: t("garden.watered") }));
    if (state === "ready") ref.actions.append(button(t("garden.harvest"), { icon: "scissors", kind: "primary small", onclick: () => {
      const res = core.harvestTray(ref.tray);
      if (res) {
        const what = res.kind === "house" ? t("house." + res.id) : t("plant." + res.id);
        toast(t("garden.harvested", { n: res.n, what }) + (res.sport ? ". " + t("garden.sport") : ""), res.sport ? "big" : "good");
        this.app.audio.chime();
      }
      this.render();
    } }));
  }

  // The greenhouse loop in four steps, so the link to Scape and orders is visible.
  loopStrip() {
    const steps = ["garden.loop1", "garden.loop2", "garden.loop3", "garden.loop4"];
    return el("section", { class: "garden-loop", "aria-label": t("garden.loopTitle") }, [
      el("h3", { text: t("garden.loopTitle") }),
      el("ol", {}, steps.map((key, i) => el("li", {}, [el("span", { class: "step-no num", text: String(i + 1) }), el("span", { text: t(key) })]))),
    ]);
  }

  // Seed shelf: every seedling you can grow now, drawn fully grown, with a one-tap Plant into the next empty tray.
  seedShelf(s) {
    const shelf = el("div", { class: "seed-shelf" });
    const freeTray = s.greenhouse.trays.find((tr) => !tr.crop);
    const aquatic = PLANTS.filter((p) => s.journal.plants[p.id] || p.rar <= 1).map((it) => ({ kind: "plant", it }));
    const house = HOUSEPLANTS.map((it) => ({ kind: "house", it }));
    const items = [...house, ...aquatic].slice(0, 8);
    for (const { kind, it } of items) {
      const { cost, mins, name, outcome } = seedInfo(kind, it);
      const cv = el("canvas", { "aria-hidden": "true" });
      const canAfford = s.shells >= cost;
      const plantBtn = button(t("garden.plant") + " · " + cost, {
        kind: freeTray && canAfford ? "primary small" : "quiet small",
        disabled: !freeTray || !canAfford,
        title: !freeTray ? t("garden.noTray") : "",
        onclick: () => {
          if (freeTray && core.plantTray(freeTray, kind === "plant" ? "plant" : "house", it.id)) {
            toast(t("garden.planted", { what: name }), "good");
            this.render();
          }
        },
      });
      shelf.append(el("div", { class: "seed" }, [
        cv,
        el("b", { text: name }),
        el("span", { class: "muted", text: t("garden.time", { t: formatDuration(mins * 60000, t) }) + " · " + outcome }),
        plantBtn,
      ]));
      requestAnimationFrame(() => {
        const { ctx, W, H } = setupCanvas(cv);
        if (kind === "house") drawHouseplant(ctx, it, W / 2, H - 6, H * 0.95, 1, false, 0);
        else drawPlant(ctx, { id: "shelf-" + it.id, sp: it.id, g: 1, v: 0, x: 0.5 }, W / 2, H - 6, H * 1.25, 0, {});
      });
    }
    return el("section", { class: "seed-section" }, [
      el("div", { class: "section-head" }, [
        el("h3", { text: t("garden.shelf") }),
        el("span", { class: "muted", text: freeTray ? t("garden.shelfLead") : t("garden.noTray") }),
      ]),
      shelf,
    ]);
  }

  // Today's plant and houseplant orders, delivered straight from the greenhouse.
  gardenOrders() {
    const box = el("section", { class: "inv-section garden-orders field-card" }, [el("h3", { text: t("garden.orders") })]);
    const list = core.orders().filter((o) => o.kind !== "fish");
    if (!list.length) box.append(el("p", { class: "muted", text: t("garden.noOrders") }));
    list.forEach((o, index) => {
      const what = o.kind === "cutting" ? t("plant." + o.sp) : t("house." + o.sp);
      const can = core.canDeliver(o);
      box.append(el("div", { class: "order" + (o.done ? " done" : "") }, [
        el("div", {}, [el("div", {}, [el("span", { class: "entry-no num", text: "No. " + (index + 1) }), el("span", { text: t("orders." + o.kind, { what, n: o.qty }) })]), el("div", { class: "reward", text: t("orders.reward", { n: o.reward }) })]),
        o.done
          ? el("span", { class: "tag muted", text: t("orders.done") })
          : button(t("orders.deliver"), { kind: can ? "primary small" : "quiet small", disabled: !can, title: can ? "" : t("orders.missing"), onclick: () => {
            if (core.deliver(o)) {
              toast(t("orders.reward", { n: o.reward }), "good");
              this.render();
            }
          } }),
      ]));
    });
    box.append(el("div", { class: "loop-links" }, [this.loopLink(t("garden.ordersHint"), () => this.app.go("tank"))]));
    return box;
  }

  fillInventory(box, s) {
    box.innerHTML = "";
    box.classList.add("field-card");
    box.append(el("h3", { text: t("garden.inventory") }));
    const cut = Object.entries(s.inv.cuttings).filter(([, n]) => n > 0);
    box.append(el("h4", { class: "plate-head" }, [el("span", { class: "plate-no", text: "I" }), el("span", { text: t("garden.cuttings") })]));
    if (!cut.length) {
      box.append(el("p", { class: "muted", text: t("garden.noCuttingsShort") }));
      box.append(el("p", { class: "from-head", text: t("garden.from") }));
      box.append(el("div", { class: "loop-links" }, [
        this.loopLink(t("garden.fromTray"), () => this.root.querySelector(".trays")?.scrollIntoView({ behavior: "smooth", block: "center" })),
        this.loopLink(t("garden.fromTrim"), () => this.app.go("tank")),
      ]));
    } else {
      box.append(el("ul", { class: "plain ledger" }, cut.map(([k, n]) => el("li", {}, [el("span", { text: plantName(k) }), el("i", { class: "leader", "aria-hidden": "true" }), el("b", { class: "num", text: "x" + n })]))));
      box.append(el("div", { class: "loop-links" }, [this.loopLink(t("garden.toScape"), () => this.app.go("tank"))]));
    }
    box.append(el("h4", { class: "plate-head" }, [el("span", { class: "plate-no", text: "II" }), el("span", { text: t("garden.houseplants") })]));
    const hp = Object.entries(s.inv.house).filter(([, n]) => n > 0);
    if (!hp.length) box.append(el("p", { class: "muted", text: t("garden.noHouse") }));
    for (const [k, n] of hp) {
      const [id, v] = k.split(":");
      box.append(el("div", { class: "order" }, [
        el("div", {}, [el("div", { text: t("house." + id) + (v ? " (" + t("garden.variegated") + ")" : "") + " x" + n })]),
        button(t("common.sell") + " · " + core.houseValue(k), { kind: "quiet small", onclick: () => {
          const value = core.sellHouse(k);
          toast(t("toast.sold", { n: value }), "good");
          this.render();
        } }),
      ]));
    }
  }

  // A quiet text link with an arrow that points to the next step of a loop.
  loopLink(label, onclick) {
    return el("button", { type: "button", class: "loop-link", onclick }, [el("span", { text: label }), icon("arrow", 16)]);
  }


  openChooser(tray) {
    let tab = "aquatic";
    const sheet = openSheet({ title: t("garden.choose"), wide: true, body: (b) => render(b) });
    const render = (b) => {
      b.innerHTML = "";
      const s = core.S();
      b.append(segmented([
        { id: "aquatic", label: t("garden.aquatic") },
        { id: "house", label: t("garden.house") },
      ], tab, (id) => {
        tab = id;
        render(b);
      }, t("garden.choose")));
      const list = el("div", { style: { marginTop: "12px" } });
      const items = tab === "aquatic" ? PLANTS.filter((p) => s.journal.plants[p.id] || p.rar <= 1) : HOUSEPLANTS;
      for (const it of items) {
        const kind = tab === "aquatic" ? "plant" : "house";
        const { cost, mins, name, outcome } = seedInfo(kind, it);
        const sub = [t("garden.cost", { n: cost }), t("garden.time", { t: formatDuration(mins * 60000, t) }), outcome].join(" · ");
        list.append(el("div", { class: "list-row", style: { gridTemplateColumns: "minmax(0,1fr) auto" } }, [
          el("div", {}, [el("div", { class: "title", text: name }), el("div", { class: "sub", text: sub })]),
          button(t("garden.plant"), { kind: s.shells >= cost ? "primary small" : "quiet small", disabled: s.shells < cost, onclick: () => {
            if (core.plantTray(tray, kind === "plant" ? "plant" : "house", it.id)) {
              sheet.close();
              this.render();
            }
          } }),
        ]));
      }
      if (tab === "aquatic") list.append(el("p", { class: "explain", text: t("garden.unlockPlants") }));
      b.append(list);
    };
  }

  // ---------- reef lab ----------
  renderReef(root, s) {
    if (!s.reef.unlocked) {
      const lvl = core.level();
      root.append(el("div", { class: "card" }, [
        el("h3", { text: t("reef.title") }),
        el("p", { class: "muted", text: t("reef.locked") }),
        s.inv.frags ? el("p", { text: t("reef.pending", { n: s.inv.frags }) }) : null,
        lvl >= core.LEVEL_GATES.reef ? button(t("shop.reef") + " · " + core.PRICES.reef, { kind: "primary", disabled: s.shells < core.PRICES.reef, onclick: () => {
          if (core.buyReef()) {
            toast(t("toast.unlocked", { what: t("garden.reef") }), "big");
            this.render();
          }
        } }) : el("span", { class: "tag muted" }, [icon("lock", 12), t("common.unlockAt", { n: core.LEVEL_GATES.reef })]),
      ]));
      return;
    }
    const strains = Object.keys(s.journal.strains).length;
    const head = el("div", { class: "row", style: { marginBottom: "12px" } }, [
      el("span", { class: "chip" }, [icon("coral", 16), el("span", { text: t("reef.strains", { n: strains }) })]),
      el("span", { class: "spacer" }),
      button(t("reef.starter") + " · " + core.PRICES.starterFrag, { icon: "plus", kind: "quiet", disabled: s.shells < core.PRICES.starterFrag, onclick: () => {
        const r = core.buyStarterFrag();
        if (r && r.coral) toast(r.isNew ? t("reef.newStrain", { name: r.coral.name }) : t("reef.gotFrag", { name: r.coral.name }), r.isNew ? "big" : "good");
        this.render();
      } }),
    ]);
    root.append(head);
    if (this.crossA) {
      root.append(el("div", { class: "modebar", style: { marginBottom: "12px" } }, [
        el("span", { text: t("reef.crossPick") + " (" + this.crossA.name + ")" }),
        el("span", { class: "spacer" }),
        button(t("common.cancel"), { kind: "quiet small", onclick: () => {
          this.crossA = null;
          this.render();
        } }),
      ]));
    }
    const grid = el("div", { class: "grid-cards" });
    const rack = s.reef.corals;
    if (!rack.length) root.append(el("p", { class: "empty", text: t("reef.empty") }));
    const reefTank = core.tankById(s.reef.tank);
    for (const coral of rack) {
      const cv = el("canvas", { "aria-hidden": "true" });
      const grown = coral.g >= 1;
      const pct = Math.min(100, Math.round((coral.g / 1) * 100));
      const actions = el("div", { class: "row", style: { marginTop: "8px" } });
      if (this.crossA && this.crossA !== coral) {
        actions.append(button(t("reef.crossWith"), { kind: grown ? "primary small" : "quiet small", disabled: !grown, onclick: () => {
          const res = core.crossCorals(this.crossA, coral);
          this.crossA = null;
          if (res) {
            toast(res.isNew ? t("reef.newStrain", { name: res.coral.name }) : t("reef.crossed", { name: res.coral.name }), res.isNew ? "big" : "good");
            this.app.audio.chime();
          }
          this.render();
        } }));
      } else if (!this.crossA) {
        actions.append(
          button(t("reef.frag"), { kind: "quiet small", disabled: !grown, title: grown ? "" : t("reef.needGrown"), onclick: () => {
            const res = core.fragCoral(coral);
            if (res && res.coral) toast(t("reef.gotFrag", { name: res.coral.name }), "good");
            this.render();
          } }),
          button(t("reef.cross"), { kind: "quiet small", disabled: !grown || rack.length < 2, title: grown ? "" : t("reef.needGrown"), onclick: () => {
            this.crossA = coral;
            this.render();
          } }),
          button(t("reef.place"), { kind: "quiet small", disabled: !reefTank, onclick: () => {
            core.placeItem({ type: "coral", key: coral.id }, 0.15 + Math.random() * 0.7, 1);
            toast(t("reef.placed", { name: coral.name, tank: reefTank.name }), "good");
            this.render();
          } }),
          button(t("common.sell") + " · " + core.coralValue(coral), { kind: "ghost small", onclick: () => {
            const v = core.sellCoral(coral);
            toast(t("toast.sold", { n: v }), "good");
            this.render();
          } }),
        );
      }
      const nameBtn = el("button", { type: "button", class: "btn ghost small", style: { padding: "0 6px", marginLeft: "-6px" }, "aria-label": t("reef.rename") + " " + coral.name }, [el("span", { text: coral.name })]);
      nameBtn.addEventListener("click", () => this.rename(coral));
      const card = el("div", { class: "card coral-card" + (this.crossA === coral ? " selected" : "") }, [
        cv,
        el("h3", { style: { marginTop: "8px" } }, [nameBtn]),
        el("div", { class: "muted", style: { fontSize: "14px" }, text: t("form." + coral.genes.form) + " · " + t("reef.pattern." + coral.genes.pat) + (coral.genes.glow > 0.6 ? " · " + t("reef.glows") : "") }),
        el("div", { style: { margin: "8px 0 4px" } }, [meter(pct, 100, t("reef.growth", { p: pct }))]),
        el("div", { class: "muted", style: { fontSize: "13px" }, text: grown ? t("reef.grown") : t("reef.growth", { p: pct }) }),
        actions,
      ]);
      grid.append(card);
      requestAnimationFrame(() => {
        const { ctx, W, H } = setupCanvas(cv);
        drawCoral(ctx, coral, W / 2, H - 8, H * 0.8, 0, { night: coral.genes.glow > 0.6 });
      });
    }
    root.append(grid);
    root.append(el("p", { class: "explain", style: { marginTop: "12px" }, text: t("reef.howto") }));
  }

  rename(coral) {
    const input = el("input", { type: "text", class: "input", value: coral.name, maxlength: "24", "aria-label": t("reef.rename") });
    const sheet = openSheet({
      title: t("reef.rename"),
      body: input,
      actions: [
        button(t("common.cancel"), { kind: "ghost", onclick: () => sheet.close() }),
        button(t("common.done"), { kind: "primary", onclick: () => {
          core.renameCoral(coral, input.value);
          sheet.close();
          this.render();
        } }),
      ],
    });
  }
}
