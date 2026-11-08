// Journal: every species, plant, coral strain and milestone, with silhouettes and hints for what is still missing.
import * as core from "./core.js";
import { t } from "./i18n.js";
import { el } from "./util.js";
import { icon, openSheet, meter, segmented } from "./ui.js";
import { FISH, PLANTS, HOUSEPLANTS, MILESTONES, SPOTS } from "./data.js";
import { fishById, statValue, coralColors } from "./sim.js";
import { fishThumb, drawPlant, drawCoral } from "./draw.js";
import { speciesName } from "./tankpanel.js";

function prep(cv) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth || 140;
  const H = cv.clientHeight || 72;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W, H };
}

export class JournalPanel {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.tab = "fish";
    this.filter = "all";
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

  render() {
    const root = this.root;
    root.innerHTML = "";
    root.append(el("div", { class: "panel-head" }, [
      el("div", {}, [el("h2", { text: t("journal.title") }), el("p", { text: t("journal.lead") })]),
      segmented(["fish", "plants", "corals", "milestones"].map((id) => ({ id, label: t("journal." + id) })), this.tab, (id) => {
        this.tab = id;
        this.render();
      }, t("journal.title")),
    ]));
    if (this.tab === "fish") this.renderFish(root);
    if (this.tab === "plants") this.renderPlants(root);
    if (this.tab === "corals") this.renderCorals(root);
    if (this.tab === "milestones") this.renderMilestones(root);
  }

  progress(root, a, b) {
    root.append(el("div", { class: "progress-line" }, [meter(a, b, t("journal.progress", { a, b })), el("b", { class: "num", text: t("journal.progress", { a, b }) })]));
  }

  renderFish(root) {
    const s = core.S();
    const found = FISH.filter((f) => s.journal.fish[f.id]?.count > 0).length;
    this.progress(root, found, FISH.length);
    const filters = el("div", { class: "row", style: { marginBottom: "12px" } }, [
      segmented([
        { id: "all", label: t("journal.all") },
        { id: "fresh", label: t("water.fresh") },
        { id: "brackish", label: t("water.brackish") },
        { id: "salt", label: t("water.salt") },
      ], this.filter, (id) => {
        this.filter = id;
        this.render();
      }, t("journal.water")),
    ]);
    root.append(filters);
    const grid = el("div", { class: "dex" });
    for (const sp of FISH) {
      if (this.filter !== "all" && sp.water !== this.filter) continue;
      const j = s.journal.fish[sp.id];
      const known = j && j.count > 0;
      const cv = el("canvas", { "aria-hidden": "true" });
      const item = el("button", { type: "button", class: "dex-item" + (known ? "" : " unknown"), "aria-label": known ? speciesName(sp.id) : t("journal.unknown") }, [
        cv,
        el("div", { class: "dex-name", text: known ? speciesName(sp.id) : t("journal.unknown") }),
        el("div", { class: "dex-sub" }, [el("span", { class: "rar-" + sp.rar, text: t("rar." + sp.rar) }), known && j.golden ? el("span", { class: "rar-5", text: t("fish.card.golden") }) : el("span", { text: known ? "x" + j.count : "" })]),
      ]);
      item.addEventListener("click", () => this.openFish(sp));
      grid.append(item);
      requestAnimationFrame(() => {
        const fakeFish = { id: "j" + sp.id, sp: sp.id, colors: sp.colors, size: (sp.size[0] + sp.size[1]) / 2, golden: false, adult: true };
        prep(cv);
        fishThumb(cv, fakeFish, { silhouette: !known });
      });
    }
    root.append(grid);
  }

  openFish(sp) {
    const s = core.S();
    const j = s.journal.fish[sp.id];
    const known = j && j.count > 0;
    const cv = el("canvas", { "aria-hidden": "true" });
    const spots = sp.spots.map((id) => t("spot." + id)).join(", ");
    const body = el("div", {}, [
      el("div", { class: "fish-hero" }, [cv, el("div", {}, [
        el("h3", { text: known ? speciesName(sp.id) : t("journal.unknown") }),
        known ? el("div", { class: "muted", text: sp.sci }) : null,
        el("div", { class: "row" }, [el("span", { class: "tag rar-" + sp.rar, text: t("rar." + sp.rar) }), el("span", { class: "tag muted", text: t("water." + sp.water) })]),
      ])]),
    ]);
    if (known) {
      body.append(el("p", { class: "muted", text: t("fishd." + sp.id) }));
      body.append(el("div", { class: "stat-grid" }, [
        el("div", {}, [el("span", { class: "muted", text: t("journal.count") }), el("b", { class: "num", text: String(j.count) })]),
        el("div", {}, [el("span", { class: "muted", text: t("journal.best") }), el("b", { class: "num", text: j.best ? j.best + " cm" : "-" })]),
        el("div", {}, [el("span", { class: "muted", text: t("journal.goldenCount") }), el("b", { class: "num", text: String(j.golden || 0) })]),
        el("div", {}, [el("span", { class: "muted", text: t("journal.where") }), el("b", { text: spots })]),
        el("div", {}, [el("span", { class: "muted", text: t("journal.when") }), el("b", { text: sp.time === "any" ? t("time.any") : t("phase." + sp.time) })]),
        el("div", {}, [el("span", { class: "muted", text: t("journal.weather") }), el("b", { text: sp.weather === "any" ? t("weather.any") : t("weather." + sp.weather) })]),
      ]));
      body.append(el("p", { class: "explain", text: t("fish.card.temp", { min: sp.temp[0], max: sp.temp[1] }) + (sp.school ? " · " + t("fish.card.school", { n: sp.school }) : "") }));
    } else {
      // hints get more specific as you level up
      const L = core.level();
      body.append(el("p", { text: t("journal.hintAt", { spot: t("spot." + sp.spots[0]) }) }));
      if (L >= 3 && sp.time !== "any") body.append(el("p", { class: "muted", text: t("journal.when") + ": " + t("phase." + sp.time) }));
      if (L >= 5 && sp.weather !== "any") body.append(el("p", { class: "muted", text: t("journal.weather") + ": " + t("weather." + sp.weather) }));
      body.append(el("p", { class: "explain", text: t("journal.hintMore") }));
    }
    openSheet({ title: known ? speciesName(sp.id) : t("journal.unknown"), body });
    requestAnimationFrame(() => fishThumb(cv, { id: "jj" + sp.id, sp: sp.id, colors: sp.colors, size: sp.size[1], golden: false, adult: true }, { silhouette: !known }));
  }

  renderPlants(root) {
    const s = core.S();
    const all = PLANTS.length + HOUSEPLANTS.length;
    const found = PLANTS.filter((p) => s.journal.plants[p.id]).length + HOUSEPLANTS.filter((h) => s.journal.house[h.id]).length;
    this.progress(root, found, all);
    const grid = el("div", { class: "dex" });
    for (const p of PLANTS) {
      const j = s.journal.plants[p.id];
      const cv = el("canvas", { "aria-hidden": "true" });
      grid.append(el("div", { class: "dex-item" + (j ? "" : " unknown") }, [
        cv,
        el("div", { class: "dex-name", text: j ? t("plant." + p.id) : t("journal.unknown") }),
        el("div", { class: "dex-sub" }, [el("span", { class: "rar-" + p.rar, text: t("rar." + p.rar) }), el("span", { text: j && j.variants ? t("garden.variegated") : "" })]),
      ]));
      requestAnimationFrame(() => {
        const { ctx, W, H } = prep(cv);
        if (!j) ctx.globalAlpha = 0.25;
        drawPlant(ctx, { id: "jp" + p.id, sp: p.id, g: 0.9, v: 0, x: 0.5 }, W / 2, H - 4, H * 1.3, 0, {});
        ctx.globalAlpha = 1;
      });
    }
    for (const h of HOUSEPLANTS) {
      const j = s.journal.house[h.id];
      grid.append(el("div", { class: "dex-item" + (j ? "" : " unknown") }, [
        el("div", { style: { height: "72px", display: "flex", alignItems: "center", justifyContent: "center", color: j ? h.leaf : "var(--rule)" } }, [icon("leaf", 36)]),
        el("div", { class: "dex-name", text: j ? t("house." + h.id) : t("journal.unknown") }),
        el("div", { class: "dex-sub" }, [el("span", { text: t("garden.house") }), el("span", { text: j && j.variants ? t("garden.variegated") : "" })]),
      ]));
    }
    root.append(grid);
  }

  renderCorals(root) {
    const s = core.S();
    const strains = Object.entries(s.journal.strains);
    root.append(el("p", { class: "muted", text: t("reef.strains", { n: strains.length }) + ". " + t("journal.coralLead") }));
    if (!strains.length) {
      root.append(el("p", { class: "empty", text: t("reef.empty") }));
      return;
    }
    const grid = el("div", { class: "dex" });
    for (const [key, st] of strains) {
      const cv = el("canvas", { "aria-hidden": "true", style: { background: "linear-gradient(#1f4f66,#12324a)", borderRadius: "3px" } });
      grid.append(el("div", { class: "dex-item" }, [
        cv,
        el("div", { class: "dex-name", text: st.name }),
        el("div", { class: "dex-sub" }, [el("span", { text: t("form." + st.genes.form) }), el("span", { text: t("reef.pattern." + st.genes.pat) })]),
      ]));
      requestAnimationFrame(() => {
        const { ctx, W, H } = prep(cv);
        drawCoral(ctx, { id: key, genes: st.genes, g: 1 }, W / 2, H - 4, H * 0.8, 0, {});
      });
    }
    root.append(grid);
  }

  renderMilestones(root) {
    const s = core.S();
    const done = MILESTONES.filter((m) => s.milestones[m.id]).length;
    this.progress(root, done, MILESTONES.length);
    const list = el("div", { class: "ms-list" });
    for (const m of MILESTONES) {
      const isDone = !!s.milestones[m.id];
      const v = Math.min(m.goal, statValue(s, m.stat));
      list.append(el("div", { class: "ms" + (isDone ? " done" : "") }, [
        el("span", { class: "ms-icon" }, [icon(isDone ? "check" : "lock", 14)]),
        el("div", {}, [el("div", { text: t("ms." + m.id) }), el("div", { class: "ms-sub", text: isDone ? t("journal.msDone", { n: core.MILESTONE_REWARD }) : t("journal.progress", { a: v, b: m.goal }) })]),
      ]));
    }
    root.append(list);
  }
}
