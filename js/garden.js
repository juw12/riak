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
    root.append(el("div", { class: "two-col" }, [el("div", {}, [trays, el("p", { class: "explain", style: { marginTop: "10px" }, text: t("garden.waterHint") })]), inv]));
    requestAnimationFrame(() => {
      for (const ref of this.trayRefs) this.updateTray(ref, Date.now(), true);
    });
  }

  updateTray(ref, now, force = false) {
    const crop = ref.tray.crop;
    const p = crop ? cropProgress(crop, now) : 0;
    const state = !crop ? "empty" : p >= 1 ? "ready" : crop.water > 0 ? "watered" : "growing";
    const { ctx, W, H } = setupCanvas(ref.cv);
    // soil
    ctx.fillStyle = "#5a4636";
    ctx.fillRect(0, H - 14, W, 14);
    if (!crop) {
      // a dashed sprout outline shows where the seedling will go
      const cx = W / 2;
      const base = H - 14;
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(90, 70, 54, 0.45)";
      ctx.beginPath();
      ctx.moveTo(cx, base);
      ctx.lineTo(cx, base - H * 0.32);
      ctx.moveTo(cx, base - H * 0.22);
      ctx.quadraticCurveTo(cx - W * 0.12, base - H * 0.36, cx - W * 0.16, base - H * 0.24);
      ctx.quadraticCurveTo(cx - W * 0.07, base - H * 0.18, cx, base - H * 0.22);
      ctx.moveTo(cx, base - H * 0.3);
      ctx.quadraticCurveTo(cx + W * 0.12, base - H * 0.46, cx + W * 0.16, base - H * 0.33);
      ctx.quadraticCurveTo(cx + W * 0.07, base - H * 0.26, cx, base - H * 0.3);
      ctx.stroke();
      ctx.restore();
    }
    if (crop) {
      const variegated = crop.sport && p >= 0.5;
      if (crop.kind === "house") drawHouseplant(ctx, houseById[crop.id], W / 2, H - 10, H * 0.95, p, variegated, this.app.reduceMotion() ? 0 : now);
      else drawPlant(ctx, { id: ref.tray.id, sp: crop.id, g: 0.15 + p * 0.95, v: variegated ? 1 : 0, x: 0.5 }, W / 2, H - 12, H * 1.35, this.app.reduceMotion() ? 0 : now, {});
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

  fillInventory(box, s) {
    box.innerHTML = "";
    box.append(el("h3", { text: t("garden.inventory") }));
    box.append(el("h3", { style: { fontSize: "15px", fontFamily: "var(--sans)", marginTop: "12px" }, text: t("garden.cuttings") }));
    const cut = Object.entries(s.inv.cuttings).filter(([, n]) => n > 0);
    if (!cut.length) box.append(el("p", { class: "muted", text: t("garden.noCuttings") }));
    else box.append(el("ul", { class: "plain" }, cut.map(([k, n]) => el("li", {}, [el("span", { text: plantName(k) }), el("b", { class: "num", text: "x" + n })]))));
    box.append(el("p", { class: "explain", text: t("garden.cuttingsHint") }));
    box.append(el("h3", { style: { fontSize: "15px", fontFamily: "var(--sans)", marginTop: "12px" }, text: t("garden.houseplants") }));
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
        const cost = core.seedlingCost(kind === "plant" ? "plant" : "house", it.id);
        const mins = kind === "house" ? it.growMin : Math.round(Math.max(10, 20 + 60 * (1 - (it.rate || 0.02) * 10)));
        const name = kind === "house" ? t("house." + it.id) : t("plant." + it.id);
        const sub = [t("garden.cost", { n: cost }), t("garden.time", { t: formatDuration(mins * 60000, t) }), kind === "house" ? t("garden.worth", { n: it.value }) : t("garden.yield")].join(" · ");
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
