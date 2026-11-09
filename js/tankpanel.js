// Tank panel: the living plate, its tools, the notes column and every tank-related sheet.
import * as core from "./core.js";
import { TankView } from "./tank.js";
import { t } from "./i18n.js";
import { el, clamp, formatDuration, dayKey } from "./util.js";
import { icon, button, openSheet, toast, confirmSheet, meter, segmented } from "./ui.js";
import { fishById, plantById, hardById, fishNeeds, waterQuality, fishValue, tankSize, lightsOn, HOUR } from "./sim.js";
import { fishThumb } from "./draw.js";
import { PLANTS, HARDSCAPE, SUBSTRATES, TANK_SIZES } from "./data.js";
import { shareLink } from "./share.js";

const TOOLS = [
  { id: "feed", icon: "feed" },
  { id: "care", icon: "drop" },
  { id: "scape", icon: "grid" },
  { id: "fish", icon: "fish" },
  { id: "shop", icon: "bag" },
  { id: "photo", icon: "camera" },
  { id: "watch", icon: "eye" },
  { id: "share", icon: "share" },
];

export function speciesName(sp) {
  return t("fish." + sp);
}
export function plantName(key) {
  const [sp, v] = String(key).split(":");
  return t("plant." + sp) + (v ? " (" + t("garden.variegated") + ")" : "");
}

export class TankPanel {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.mode = "view";
    this.food = "flakes";
    this.scapeItem = null;
    this.lastWasteToast = 0;
    this.visit = null;
    this.watchTimer = null;
    this.wakeLock = null;
  }

  // ---------- data source for the view ----------
  source() {
    if (this.visit) return this.visit;
    const tank = core.activeTank();
    return { tank, fish: core.fishIn(tank.id), readOnly: false };
  }

  init() {
    this.root.innerHTML = "";
    const canvas = el("canvas", { id: "tankCanvas", role: "img" });
    this.hint = el("div", { class: "tank-hint", "aria-live": "polite" });
    this.wrap = el("div", { class: "tank-wrap" }, [canvas, this.hint]);
    this.caption = el("div", { class: "caption" });
    this.toolbar = el("div", { class: "toolbar", role: "toolbar", "aria-label": t("nav.tank") });
    this.modebar = el("div", { class: "modebar", hidden: true });
    const plate = el("figure", { class: "plate" }, [this.wrap, this.modebar, this.caption, this.toolbar]);
    this.notes = el("aside", { class: "notes", "aria-label": t("care.title") });
    this.root.append(el("div", { class: "tank-layout" }, [plate, this.notes]));

    for (const tool of TOOLS) {
      const b = el("button", { type: "button", class: "tool", "data-tool": tool.id, "aria-pressed": "false" }, [icon(tool.icon, 22), el("span", { text: t("tool." + tool.id) })]);
      b.addEventListener("click", () => this.onTool(tool.id));
      this.toolbar.append(b);
    }

    this.view = new TankView(canvas, {
      source: () => this.source(),
      onFishTap: (f) => this.openFishCard(f),
      onEat: (f, kind) => this.onEat(f, kind),
      onEvent: (type, arg) => this.onEvent(type, arg),
      onScape: (action, payload) => this.onScape(action, payload),
      reduceMotion: () => this.app.reduceMotion(),
      now: () => Date.now(),
    });
    this.setMode("view");
    this.refresh();
  }

  show() {
    this.view.start();
    this.view.resize();
  }
  hide() {
    this.view.stop();
    if (this.mode !== "view") this.setMode("view");
  }

  // ---------- modes ----------
  setMode(mode) {
    if (this.visit && mode !== "view") return;
    this.mode = mode;
    this.view.setMode(mode);
    for (const b of this.toolbar.querySelectorAll(".tool")) {
      const active = (b.dataset.tool === "feed" && mode === "feed") || (b.dataset.tool === "scape" && mode === "scape");
      b.setAttribute("aria-pressed", String(active));
    }
    this.renderModebar();
    this.renderHint();
  }

  renderHint() {
    const key = {
      view: "hint.view",
      feed: "hint.feed",
      clean: "hint.clean",
      trim: "hint.trim",
      scape: "hint.scape." + (this.view.scape.tool || "place"),
    }[this.mode];
    this.hint.textContent = t(key);
    this.hint.hidden = this.mode === "view" && core.S().stats.fed > 3;
  }

  renderModebar() {
    const bar = this.modebar;
    bar.innerHTML = "";
    bar.hidden = this.mode === "view";
    if (this.mode === "view") return;
    const done = button(t("common.done"), { kind: "primary small", onclick: () => this.setMode("view") });
    if (this.mode === "feed") {
      bar.append(el("span", { class: "label", text: t("food.title") }));
      const inv = core.S().inv.food;
      for (const f of core.FOODS) {
        const count = f.id === "flakes" ? t("food.unlimited") : t("food.left", { n: inv[f.id] || 0 });
        const b = el("button", { type: "button", class: "pick", "aria-pressed": String(this.food === f.id) }, [el("span", { text: t("food." + f.id) }), el("small", { text: count })]);
        b.addEventListener("click", () => {
          this.food = f.id;
          this.renderModebar();
        });
        bar.append(b);
      }
      bar.append(el("span", { class: "spacer" }), done);
    } else if (this.mode === "clean" || this.mode === "trim") {
      bar.append(el("span", { text: t(this.mode === "clean" ? "hint.clean" : "hint.trim") }), el("span", { class: "spacer" }), done);
    } else if (this.mode === "scape") {
      this.renderScapebar(bar, done);
    }
  }

  renderScapebar(bar, done) {
    const sc = this.view.scape;
    const tools = segmented(
      ["place", "sculpt", "move", "remove"].map((id) => ({ id, label: t("scape." + id) })),
      sc.tool,
      (id) => {
        sc.tool = id;
        sc.selected = null;
        this.renderModebar();
        this.renderHint();
      },
      t("scape.title"),
    );
    bar.append(tools, el("span", { class: "spacer" }), done);
    const tank = core.activeTank();
    if (sc.tool === "place") {
      const picker = el("div", { class: "picker", role: "listbox", "aria-label": t("scape.place") });
      const s = core.S();
      const items = [];
      for (const [key, n] of Object.entries(s.inv.cuttings)) if (n > 0) items.push({ type: "plant", key, label: plantName(key), n });
      for (const [key, n] of Object.entries(s.inv.hard)) if (n > 0) items.push({ type: "hard", key, label: t("hard." + key), n });
      if (tank.water === "salt") for (const c of s.reef.corals) items.push({ type: "coral", key: c.id, label: c.name, n: 1 });
      if (!items.length) {
        picker.append(el("p", { class: "muted", text: t("scape.empty") }));
        sc.item = null;
      }
      if (sc.item && !items.some((i) => i.type === sc.item.type && i.key === sc.item.key)) sc.item = null;
      if (!sc.item && items.length) sc.item = { type: items[0].type, key: items[0].key };
      for (const it of items) {
        const pressed = sc.item && sc.item.type === it.type && sc.item.key === it.key;
        const b = el("button", { type: "button", class: "pick", role: "option", "aria-pressed": String(!!pressed), "aria-selected": String(!!pressed) }, [el("span", { text: it.label }), el("small", { text: t("scape.inv", { n: it.n }) })]);
        b.addEventListener("click", () => {
          sc.item = { type: it.type, key: it.key };
          this.renderModebar();
        });
        picker.append(b);
      }
      const size = el("input", { type: "range", min: "0.5", max: "1.8", step: "0.1", value: String(sc.size), "aria-label": t("scape.size") });
      size.addEventListener("input", () => (sc.size = +size.value));
      bar.append(picker, el("label", { class: "row muted" }, [t("scape.size"), size]));
    }
    if (sc.tool === "move") {
      const flip = button(t("scape.flip"), { icon: "flip", kind: "quiet small", disabled: !(sc.selected && sc.selected.type === "hard"), onclick: () => {
        if (sc.selected && sc.selected.type === "hard") {
          sc.selected.ref.flip = !sc.selected.ref.flip;
          core.changed();
        }
      } });
      bar.append(flip);
    }
    const sub = el("select", { class: "input", "aria-label": t("scape.substrate"), style: { width: "auto" } });
    for (const s of SUBSTRATES) sub.append(el("option", { value: s.id, text: t("sub." + s.id), selected: tank.substrate === s.id }));
    sub.addEventListener("change", () => core.setSubstrate(sub.value));
    bar.append(el("label", { class: "row muted" }, [t("scape.substrate"), sub]));
  }

  // ---------- tool buttons ----------
  onTool(id) {
    if (this.visit) return;
    if (id === "feed") return this.setMode(this.mode === "feed" ? "view" : "feed");
    if (id === "scape") return this.setMode(this.mode === "scape" ? "view" : "scape");
    if (this.mode !== "view") this.setMode("view");
    if (id === "care") return this.openCare();
    if (id === "fish") return this.openResidents();
    if (id === "shop") return this.openShop();
    if (id === "photo") return this.openPhoto();
    if (id === "watch") return this.enterWatch();
    if (id === "share") return this.openShare();
  }

  // ---------- view hooks ----------
  onEat(fish, kind) {
    const wasHungry = fish.hunger > 0.5;
    core.fishAte(fish, kind);
    this.app.audio.bubble(1.2);
    if (wasHungry) toast(t("toast.fed", { name: fish.name }));
  }
  onEvent(type, arg) {
    if (type === "foodWasted") {
      core.foodWasted(arg || 1);
      if (Date.now() - this.lastWasteToast > 60000) {
        this.lastWasteToast = Date.now();
        toast(t("toast.foodWasted"), "warn");
      }
    } else if (type === "glassClean") {
      core.glassCleaned();
      this.setMode("view");
    } else if (type === "tapGlass") {
      this.app.audio.bubble(0.9);
    } else if (type === "feedTap") {
      if (core.useFood(this.food)) {
        this.view.dropFood(arg, this.food);
        this.app.audio.bubble(1.4);
        if (this.food !== "flakes") this.renderModebar();
      }
    } else if (type === "trim") {
      core.trim(arg);
    }
  }
  onScape(action, payload) {
    if (action === "place") {
      if (core.placeItem(payload.item, payload.x, payload.size)) {
        const it = payload.item;
        const name = it.type === "plant" ? plantName(it.key) : it.type === "hard" ? t("hard." + it.key) : "";
        if (name) toast(t("toast.placed", { what: name }));
        this.renderModebar();
      }
    } else if (action === "remove") {
      core.removeItem(payload);
      this.renderModebar();
    } else if (action === "select") {
      this.renderModebar();
    } else if (action === "moved" || action === "sculpt") {
      core.game.dirty = true;
    }
  }

  // ---------- refresh ----------
  refresh() {
    if (!this.view) return;
    this.renderCaption();
    this.renderNotes();
    for (const b of this.toolbar.querySelectorAll(".tool")) b.disabled = !!this.visit;
    const src = this.source();
    this.view.canvas.setAttribute("aria-label", t("a11y.tank", { n: src.fish.length, q: waterQuality(src.tank.w) }));
  }

  renderCaption() {
    const cap = this.caption;
    cap.innerHTML = "";
    const src = this.source();
    const tank = src.tank;
    let nameNode;
    const s = core.S();
    if (!this.visit && s.tanks.length > 1) {
      nameNode = el("select", { class: "tank-name", "aria-label": t("tank.choose") });
      for (const tk of s.tanks) nameNode.append(el("option", { value: tk.id, text: tk.name, selected: tk.id === tank.id }));
      nameNode.addEventListener("change", () => {
        core.setActiveTank(nameNode.value);
        this.setMode("view");
      });
    } else {
      nameNode = el("b", { class: "tank-name", text: tank.name });
    }
    const meta = el("span", { class: "caption-meta" });
    if (!this.visit) {
      const st = core.stocking(tank);
      meta.append(
        el("span", { text: t("tank.litres", { n: tankSize(tank).litres }) }),
        el("span", { class: st.load > st.cap ? "need" : "", text: t("tank.stock", { a: st.load.toFixed(1), b: st.cap }) }),
        el("span", { text: lightsOn(tank, Date.now()) ? t("tank.lightsOn", { a: tank.lights[0], b: tank.lights[1] }) : t("tank.lightsOffNow") }),
      );
    } else {
      meta.append(el("span", { text: t("share.visiting", { name: tank.name }) }));
    }
    cap.append(nameNode, meta);
  }

  renderNotes() {
    const n = this.notes;
    n.innerHTML = "";
    if (this.visit) {
      n.append(el("section", {}, [el("h2", { text: this.visit.tank.name }), el("p", { class: "muted", text: t("share.lead") })]));
      return;
    }
    const s = core.S();
    const tank = core.activeTank();
    const fish = core.fishIn(tank.id);
    const q = waterQuality(tank.w);
    const needy = fish.map((f) => ({ f, needs: fishNeeds(s, f, tank) })).filter((x) => x.needs.length);
    const statusKey = q >= 75 && needy.length === 0 ? "good" : q >= 55 && needy.length <= 2 ? "ok" : "bad";

    // status
    const status = el("section", {}, [
      el("div", { class: "status-line" + (statusKey === "bad" ? " bad" : ""), text: t("tank.status." + statusKey, { name: tank.name }) }),
      (() => {
        const m = meter(q, 100, t("tank.quality", { q }));
        if (q < 60) m.classList.add("warn");
        return m;
      })(),
      el("p", { class: "muted", style: { marginTop: "6px" }, text: t("tank.quality", { q }) + ". " + (fish.length ? (needy.length ? t("tank.needsCount", { n: needy.length }) : t("tank.needsNone")) : t("tank.empty")) }),
    ]);
    n.append(status);

    // more to do: surfaces the other loops from the tank page
    const explore = el("div", { class: "explore-list" });
    for (const [tab, key] of [["fishing", "Fish"], ["garden", "Garden"], ["journal", "Journal"]]) {
      explore.append(el("button", { type: "button", class: "explore-row", onclick: () => this.app.go(tab) }, [
        el("b", { text: t("tank.explore" + key) }),
        el("span", { class: "muted", text: t("tank.explore" + key + "D") }),
      ]));
    }
    n.append(el("section", {}, [el("h3", { text: t("tank.explore") }), explore]));

    // readings
    const rd = el("section", {}, [el("h3", { text: t("care.test") })]);
    const tested = tank.lastTest && dayKey(tank.lastTest) === dayKey();
    if (tested && tank.lastReadings) {
      rd.append(readingsList(tank.lastReadings, s, tank));
      rd.append(el("p", { class: "explain", text: t("care.lastTest", { t: formatDuration(Date.now() - tank.lastTest, t) }) }));
    } else {
      rd.append(el("p", { class: "muted", text: t("care.notTested") }));
      rd.append(button(t("care.testDo"), { icon: "test", kind: "quiet", onclick: () => {
        core.testWater();
        this.refresh();
      } }));
    }
    n.append(rd);

    // needs
    if (needy.length) {
      const ul = el("ul", { class: "plain" });
      for (const { f, needs } of needy.slice(0, 5)) {
        const li = el("li", {}, [
          el("button", { type: "button", class: "check", onclick: () => this.openFishCard(f) }, [
            el("span", {}, [el("b", { text: f.name }), " ", el("span", { class: "muted", text: speciesName(f.sp) })]),
            el("small", { class: "need", text: needText(needs[0]) }),
          ]),
        ]);
        ul.append(li);
      }
      n.append(el("section", {}, [el("h3", { text: t("tank.whoNeeds") }), ul]));
    }

    // today's care
    const care = core.careState();
    const tasks = [
      { id: "feed", act: () => this.setMode("feed") },
      { id: "test", act: () => {
        core.testWater();
        this.refresh();
      } },
      { id: "glass", act: () => this.setMode("clean") },
      { id: "greenhouse", optional: true, act: () => this.app.go("garden") },
      { id: "focus", optional: true, act: () => this.app.go("focus") },
    ];
    const careBox = el("section", {}, [el("h3", { text: t("care.today") })]);
    for (const task of tasks) {
      const done = !!care.done[task.id];
      const b = el("button", { type: "button", class: "check" + (done ? " done" : ""), "aria-pressed": String(done) }, [
        el("span", { class: "box" }, done ? [icon("check", 14)] : []),
        el("span", { text: t("care.task." + task.id) }),
        task.optional ? el("small", { text: t("care.optional") }) : null,
      ]);
      b.addEventListener("click", () => {
        if (!done) task.act();
      });
      careBox.append(b);
    }
    careBox.append(el("p", { class: "explain", text: t("care.streak", { n: care.streak || 0 }) + ". " + t("care.rewardHint", { n: core.CARE_REWARD }) }));
    n.append(careBox);

    // orders
    const ord = el("section", {}, [el("h3", { text: t("orders.title") })]);
    for (const o of core.orders()) {
      const what = o.kind === "fish" ? speciesName(o.sp) : o.kind === "cutting" ? t("plant." + o.sp) : t("house." + o.sp);
      const label = t("orders." + o.kind, { what, n: o.qty });
      const can = core.canDeliver(o);
      const row = el("div", { class: "order" + (o.done ? " done" : "") }, [
        el("div", {}, [el("div", { text: label }), el("div", { class: "reward", text: t("orders.reward", { n: o.reward }) })]),
        o.done
          ? el("span", { class: "tag muted", text: t("orders.done") })
          : button(t("orders.deliver"), { kind: can ? "primary small" : "quiet small", disabled: !can, title: can ? "" : t("orders.missing"), onclick: () => {
            if (core.deliver(o)) toast(t("orders.reward", { n: o.reward }), "good");
          } }),
      ]);
      ord.append(row);
    }
    n.append(ord);
  }

  // ---------- care sheet ----------
  openCare() {
    const tank = core.activeTank();
    const sheet = openSheet({ title: t("care.title") + ": " + tank.name, body: (b) => this.fillCare(b, sheet) });
    this.careSheet = sheet;
  }
  fillCare(body) {
    const s = core.S();
    const tank = core.activeTank();
    body.innerHTML = "";
    body.append(el("h3", { text: t("care.test") }));
    const out = el("div");
    const showReadings = () => {
      out.innerHTML = "";
      out.append(readingsList(tank.lastReadings || tank.w, s, tank));
      out.append(el("details", { class: "explain-more" }, [
        el("summary", { text: t("care.explainMore") }),
        el("p", { class: "explain", text: t("care.explain.amm") }),
        el("p", { class: "explain", text: t("care.explain.no3") }),
        el("p", { class: "explain", text: t("care.explain.algae") }),
      ]));
    };
    const testBtn = button(t("care.testDo"), { icon: "test", kind: "primary", onclick: () => {
      core.testWater();
      showReadings();
      this.refresh();
    } });
    body.append(testBtn, out);
    if (tank.lastTest && dayKey(tank.lastTest) === dayKey()) showReadings();

    body.append(el("h3", { text: t("care.actions") }));
    body.append(el("div", { class: "row" }, [
      button(t("care.change"), { icon: "wave", kind: "quiet", onclick: () => {
        core.doWaterChange();
        if (tank.lastReadings) tank.lastReadings = { ...tank.w };
        this.fillCare(body);
      } }),
      button(t("care.wipe"), { icon: "brush", kind: "quiet", onclick: () => {
        this.careSheet?.close();
        this.setMode("clean");
      } }),
      button(t("care.trim"), { icon: "scissors", kind: "quiet", onclick: () => {
        this.careSheet?.close();
        this.setMode("trim");
      } }),
    ]));
    const ready = tank.plants.filter((p) => p.g > 1.05).length;
    body.append(el("p", { class: "explain", text: t("care.trimReady", { n: ready }) }));

    body.append(el("h3", { text: t("care.heater") }));
    const tempOut = el("b", { class: "num", text: tank.heater.toFixed(1) + " °C" });
    const heat = el("input", { type: "range", min: "18", max: "30", step: "0.5", value: String(tank.heater), "aria-label": t("care.heater") });
    heat.addEventListener("input", () => {
      core.setHeater(heat.value);
      tempOut.textContent = (+heat.value).toFixed(1) + " °C";
    });
    body.append(el("div", { class: "field" }, [el("div", { class: "row" }, [el("span", { class: "muted", text: t("care.heaterHint") }), el("span", { class: "spacer" }), tempOut]), heat]));

    body.append(el("h3", { text: t("care.lights") }));
    const hours = (sel) => {
      const sl = el("select", { class: "input" });
      for (let h = 0; h < 24; h++) sl.append(el("option", { value: String(h), text: String(h).padStart(2, "0") + ":00", selected: h === sel }));
      return sl;
    };
    const onSel = hours(tank.lights[0]);
    const offSel = hours(tank.lights[1]);
    const upd = () => core.setLights(onSel.value, offSel.value);
    onSel.addEventListener("change", upd);
    offSel.addEventListener("change", upd);
    body.append(el("div", { class: "row" }, [
      el("label", { class: "field", style: { flex: "1" } }, [el("span", { text: t("care.lightsOn") }), onSel]),
      el("label", { class: "field", style: { flex: "1" } }, [el("span", { text: t("care.lightsOff") }), offSel]),
    ]));
    body.append(el("p", { class: "explain", text: t("care.lightsHint") }));
  }

  // ---------- fish card ----------
  openFishCard(fish) {
    const visiting = !!this.visit;
    const sheet = openSheet({ title: fish.name, body: (b) => this.fillFishCard(b, fish, sheet, visiting) });
  }
  fillFishCard(body, fish, sheet, visiting) {
    const s = core.S();
    const sp = fishById[fish.sp];
    const tank = core.tankById(fish.tank);
    body.innerHTML = "";
    const cv = el("canvas", { "aria-hidden": "true" });
    const tags = el("div", { class: "row" }, [
      el("span", { class: "tag rar-" + sp.rar, text: t("rar." + sp.rar) }),
      fish.golden ? el("span", { class: "tag gold", text: t("fish.card.golden") }) : null,
      fish.adult === false ? el("span", { class: "tag muted", text: t("fish.card.juvenile") }) : null,
      fish.parents ? el("span", { class: "tag muted", text: t("fish.card.parents") }) : null,
    ]);
    body.append(el("div", { class: "fish-hero" }, [
      cv,
      el("div", {}, [
        el("h3", { text: fish.name }),
        el("div", { class: "muted", text: speciesName(fish.sp) + " · " + sp.sci }),
        tags,
      ]),
    ]));
    requestAnimationFrame(() => fishThumb(cv, fish));
    const ageDays = Math.floor((Date.now() - (fish.born || Date.now())) / (24 * HOUR));
    body.append(el("div", { class: "stat-grid" }, [
      el("div", {}, [el("span", { class: "muted", text: t("fish.card.mood") }), meter(fish.mood, 100, t("fish.card.mood"))]),
      el("div", {}, [el("span", { class: "muted", text: t("fish.card.hunger") }), meter((1 - fish.hunger) * 100, 100, t("fish.card.hunger"))]),
      el("div", {}, [el("span", { class: "muted", text: t("fish.card.size") }), el("b", { class: "num", text: fish.size + " cm" })]),
      el("div", {}, [el("span", { class: "muted", text: t("fish.card.age") }), el("b", { text: ageDays ? t("fish.card.days", { n: ageDays }) : t("fish.card.today") })]),
    ]));
    body.append(el("p", {}, [
      el("b", { text: t("pers." + fish.pers) }), ", ", t("fish.card.sex." + fish.sex), ". ", el("span", { class: "muted", text: t("pers." + fish.pers + ".d") }),
    ]));
    body.append(el("p", { class: "muted", text: t("fishd." + fish.sp) }));
    body.append(el("p", { class: "explain", text: [t("fish.card.temp", { min: sp.temp[0], max: sp.temp[1] }), sp.school ? t("fish.card.school", { n: sp.school }) : "", t("journal.water") + ": " + t("water." + sp.water)].filter(Boolean).join(" · ") }));
    if (visiting) return;
    if (tank) {
      const needs = fishNeeds(s, fish, tank);
      body.append(el("h3", { text: t("fish.card.needs", { name: fish.name }) }));
      if (!needs.length) body.append(el("p", { text: t("fish.card.happy", { name: fish.name }) }));
      else body.append(el("ul", { class: "plain" }, needs.map((nd) => el("li", { class: "need", text: needText(nd) }))));
    }
    // actions
    body.append(el("h3", { text: t("fish.card.actions") }));
    const nameIn = el("input", { type: "text", class: "input", value: fish.name, maxlength: "20", "aria-label": t("fish.card.rename") });
    body.append(el("div", { class: "row", style: { flexWrap: "nowrap" } }, [nameIn, button(t("fish.card.rename"), { kind: "quiet", onclick: () => {
      core.renameFish(fish, nameIn.value);
      sheet.dialog.querySelector(".sheet-title").textContent = fish.name;
      this.fillFishCard(body, fish, sheet, visiting);
    } })]));
    const move = el("select", { class: "input", "aria-label": t("fish.card.move") });
    move.append(el("option", { value: "", text: t("fish.card.move") + "..." }));
    for (const tk of s.tanks) if (tk.id !== fish.tank) move.append(el("option", { value: tk.id, text: tk.name + (core.canHouse(fish, tk) ? "" : " (" + t("water." + tk.water) + ")"), disabled: !core.canHouse(fish, tk) }));
    if (fish.tank !== "bucket") move.append(el("option", { value: "bucket", text: t("fish.card.bucket") }));
    move.addEventListener("change", () => {
      if (!move.value) return;
      if (core.placeFish(fish, move.value)) {
        if (move.value === "bucket") toast(t("toast.toBucket", { name: fish.name }));
        sheet.close();
      }
    });
    body.append(el("div", { class: "row", style: { marginTop: "8px" } }, [
      move,
      button(t("fish.card.sell", { n: fishValue(fish) }), { kind: "quiet", onclick: () => confirmSheet(t("fish.card.sellConfirm", { name: fish.name, n: fishValue(fish) }), () => {
        core.sellFish(fish);
        sheet.close();
      }) }),
      button(t("fish.card.release"), { kind: "quiet", onclick: () => confirmSheet(t("fish.card.releaseConfirm", { name: fish.name }), () => {
        core.releaseFish(fish);
        sheet.close();
      }) }),
    ]));
  }

  // ---------- residents ----------
  openResidents() {
    let tab = "tank";
    const sheet = openSheet({ title: t("residents.title"), wide: true, body: (b) => render(b) });
    const render = (b) => {
      b.innerHTML = "";
      const tank = core.activeTank();
      b.append(segmented([
        { id: "tank", label: tank.name + " (" + core.fishIn(tank.id).length + ")" },
        { id: "bucket", label: t("residents.bucket") + " (" + core.bucket().length + "/" + core.BUCKET_CAP + ")" },
      ], tab, (id) => {
        tab = id;
        render(b);
      }, t("residents.title")));
      const list = el("div", { style: { marginTop: "12px" } });
      const fish = tab === "tank" ? core.fishIn(tank.id) : core.bucket();
      if (tab === "bucket") list.append(el("p", { class: "explain", text: t("residents.bucketHint", { n: core.BUCKET_CAP }) }));
      if (!fish.length) list.append(el("p", { class: "empty", text: t("residents.none") }));
      for (const f of fish) {
        const cv = el("canvas", { class: "thumb", "aria-hidden": "true" });
        const needs = tab === "tank" ? fishNeeds(core.S(), f, tank) : [];
        const action = tab === "bucket"
          ? button(t("residents.moveIn", { tank: tank.name }), { kind: "quiet small", disabled: !core.canHouse(f, tank), onclick: (e) => {
            e.stopPropagation();
            core.placeFish(f, tank.id);
            render(b);
          } })
          : el("span", { class: needs.length ? "need" : "muted", text: needs.length ? needText(needs[0]) : t("fish.card.content") });
        const row = el("div", { class: "list-row button-like", tabindex: "0", role: "button", "aria-label": f.name + ", " + speciesName(f.sp) }, [
          cv,
          el("div", {}, [el("div", { class: "title" }, [f.name, f.golden ? el("span", { class: "tag gold", style: { marginLeft: "6px" }, text: t("fish.card.golden") }) : null]), el("div", { class: "sub", text: speciesName(f.sp) + " · " + f.size + " cm · " + t("pers." + f.pers) })]),
          action,
        ]);
        const open = () => {
          sheet.close();
          this.openFishCard(f);
        };
        row.addEventListener("click", open);
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        });
        list.append(row);
        requestAnimationFrame(() => fishThumb(cv, f));
      }
      b.append(list);
    };
  }

  // ---------- shop ----------
  openShop() {
    let tab = "plants";
    const sheet = openSheet({ title: t("shop.title"), wide: true, body: (b) => render(b) });
    const render = (b) => {
      b.innerHTML = "";
      const s = core.S();
      const L = core.level();
      b.append(el("div", { class: "row" }, [
        segmented(["plants", "hard", "supplies", "tanks"].map((id) => ({ id, label: t("shop." + id) })), tab, (id) => {
          tab = id;
          render(b);
        }, t("shop.title")),
        el("span", { class: "spacer" }),
        el("span", { class: "chip" }, [icon("shell", 16), el("span", { text: String(s.shells) })]),
      ]));
      const list = el("div", { style: { marginTop: "12px" } });
      const row = (title, sub, price, onBuy, opts = {}) => {
        const locked = opts.lockedAt && L < opts.lockedAt;
        const buy = locked
          ? el("span", { class: "tag muted" }, [icon("lock", 12), t("common.unlockAt", { n: opts.lockedAt })])
          : button(opts.label || t("common.buy") + " · " + price, { kind: s.shells >= price ? "primary small" : "quiet small", disabled: s.shells < price || opts.disabled, onclick: () => {
            if (onBuy()) {
              this.app.audio.chime();
              render(b);
            }
          } });
        list.append(el("div", { class: "list-row", style: { gridTemplateColumns: "minmax(0,1fr) auto" } }, [el("div", {}, [el("div", { class: "title", text: title }), el("div", { class: "sub", text: sub })]), buy]));
      };
      if (tab === "plants") {
        for (const p of PLANTS) {
          const gate = Math.max(1, (p.rar - 1) * 2);
          row(t("plant." + p.id), [t("rar." + p.rar), t("shop.light." + p.light), t("common.owned", { n: s.inv.cuttings[p.id] || 0 })].join(" · "), p.price, () => core.buyPlant(p.id), { lockedAt: gate > 1 ? gate : 0 });
        }
      } else if (tab === "hard") {
        for (const h of HARDSCAPE) {
          if (h.id === "liverock" && !s.reef.unlocked) continue;
          row(t("hard." + h.id), t("common.owned", { n: s.inv.hard[h.id] || 0 }), h.price, () => core.buyHard(h.id));
        }
      } else if (tab === "supplies") {
        row(t("food.bloodworm") + " x5", t("shop.bloodwormHint") + " · " + t("common.owned", { n: s.inv.food.bloodworm || 0 }), 15, () => core.buyFood("bloodworm", 5));
        // bait comes in packs of five; lures are single and kept until a line snaps
        for (const bt of core.BAITS) {
          if (bt.id === "worm") continue;
          const qty = bt.lure ? 1 : 5;
          const name = t("bait." + bt.id) + (bt.lure ? " · " + t("tackle.lure") : " x5");
          row(name, t("bait." + bt.id + ".d") + " · " + t("common.owned", { n: s.inv.bait[bt.id] || 0 }), bt.price * qty, () => core.buyBait(bt.id, qty), { lockedAt: bt.level > 1 ? bt.level : 0 });
        }
        const angler = core.angler();
        for (const [lv, ln] of core.LINES.entries()) {
          if (lv === 0) continue;
          const owned = angler.line >= lv;
          row(t("line." + ln.id), t("line.hint", { lb: ln.lb, m: core.castMetres(1, lv) }), ln.price, () => core.buyLine(lv), { lockedAt: ln.level > 1 ? ln.level : 0, disabled: owned || angler.line !== lv - 1, label: owned ? t("common.owned", { n: 1 }) : undefined });
        }
        if (s.reef.unlocked) row(t("reef.starter"), t("shop.fragHint"), core.PRICES.starterFrag, () => !!core.buyStarterFrag());
      } else {
        for (const tk of s.tanks) {
          const next = core.nextSize(tk);
          if (next) row(t("shop.upgrade", { tank: tk.name, size: t("size." + next.id) }), t("shop.upgradeHint", { a: tankSize(tk).capacity, b: next.capacity }), next.price, () => core.upgradeTank(tk));
          else row(tk.name, t("shop.maxSize"), 0, () => false, { label: t("common.owned", { n: 1 }), disabled: true });
        }
        const fresh = s.tanks.filter((x) => x.water !== "salt").length;
        if (fresh < 2) row(t("shop.newTank"), t("shop.newTankHint"), core.PRICES.secondTank, () => !!core.buySecondTank(), { lockedAt: core.LEVEL_GATES.secondTank });
        if (!s.reef.unlocked) row(t("shop.reef"), t("shop.reefHint"), core.PRICES.reef, () => !!core.buyReef(), { lockedAt: core.LEVEL_GATES.reef });
        if (s.greenhouse.trays.length < 8) row(t("shop.trays"), t("shop.traysHint", { n: s.greenhouse.trays.length }), core.PRICES.trays, () => core.buyTrays(), { lockedAt: 2 });
      }
      b.append(list);
    };
  }

  // ---------- photo / share ----------
  openPhoto() {
    const url = this.view.snapshot();
    const img = el("img", { src: url, alt: t("photo.alt", { name: core.activeTank().name }), style: { width: "100%", display: "block", borderRadius: "2px" } });
    const save = el("a", { class: "btn primary", href: url, download: "riak-" + core.activeTank().name.replace(/\W+/g, "-").toLowerCase() + ".png" }, [icon("camera", 18), el("span", { text: t("photo.save") })]);
    const actions = [save];
    if (navigator.canShare) {
      actions.unshift(button(t("photo.share"), { icon: "share", kind: "quiet", onclick: async () => {
        try {
          const blob = await (await fetch(url)).blob();
          const file = new File([blob], "riak.png", { type: "image/png" });
          if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: "Riak" });
        } catch (e) {
          /* user cancelled */
        }
      } }));
    }
    openSheet({ title: t("photo.title"), wide: true, body: img, actions });
  }
  async openShare() {
    const link = await shareLink(core.S(), core.activeTank());
    const input = el("input", { type: "text", class: "input", value: link, readonly: true, "aria-label": t("share.title") });
    const copy = button(t("share.copy"), { icon: "share", kind: "primary", onclick: async () => {
      try {
        await navigator.clipboard.writeText(link);
      } catch (e) {
        input.select();
        document.execCommand?.("copy");
      }
      toast(t("toast.copied"), "good");
    } });
    openSheet({ title: t("share.title"), body: el("div", {}, [el("p", { class: "muted", text: t("share.lead") }), input]), actions: [copy] });
  }

  // ---------- watch mode ----------
  async enterWatch() {
    document.body.classList.add("watch");
    const clock = el("div", { class: "watch-clock", "aria-live": "off" }, [el("b"), el("span")]);
    const exit = button(t("watch.leave"), { icon: "close", kind: "small watch-exit", onclick: () => this.exitWatch() });
    document.body.append(clock, exit);
    this.watchEls = [clock, exit];
    const tickClock = () => {
      const d = new Date();
      clock.querySelector("b").textContent = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      clock.querySelector("span").textContent = d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
    };
    tickClock();
    this.watchTimer = setInterval(tickClock, 1000);
    this.watchKey = (e) => {
      if (e.key === "Escape") this.exitWatch();
    };
    document.addEventListener("keydown", this.watchKey);
    try {
      this.wakeLock = await navigator.wakeLock?.request("screen");
    } catch (e) {
      this.wakeLock = null;
    }
    try {
      await document.documentElement.requestFullscreen?.();
    } catch (e) {
      /* fullscreen is optional */
    }
    this.view.resize();
    exit.focus();
  }
  exitWatch() {
    document.body.classList.remove("watch");
    clearInterval(this.watchTimer);
    for (const n of this.watchEls || []) n.remove();
    document.removeEventListener("keydown", this.watchKey);
    this.wakeLock?.release?.();
    this.wakeLock = null;
    if (document.fullscreenElement) document.exitFullscreen?.();
    this.view.resize();
  }
}

// ---------- shared helpers ----------
export function needText(nd) {
  const vars = { ...nd };
  if (typeof vars.temp === "number") vars.temp = vars.temp.toFixed(1);
  return t("need." + nd.code, vars);
}

function levelOf(key, v, s, tank) {
  if (key === "amm" || key === "no2") return v > 0.5 ? "high" : "ok";
  if (key === "no3") return v > 40 ? "high" : v < 1 ? "low" : "ok";
  if (key === "algae" || key === "glass") return v > 0.35 ? "high" : "ok";
  if (key === "bact") return v < 0.4 ? "low" : "ok";
  if (key === "temp") {
    const fish = core.fishIn(tank.id);
    if (fish.some((f) => v < fishById[f.sp].temp[0] - 0.5)) return "low";
    if (fish.some((f) => v > fishById[f.sp].temp[1] + 0.5)) return "high";
    return "ok";
  }
  return "ok";
}
export function readingsList(w, s, tank) {
  const rows = [
    ["amm", w.amm.toFixed(2) + " ppm"],
    ["no2", w.no2.toFixed(2) + " ppm"],
    ["no3", Math.round(w.no3) + " ppm"],
    ["temp", w.temp.toFixed(1) + " °C"],
    ["algae", Math.round(w.algae * 100) + "%"],
    ["glass", Math.round(w.glass * 100) + "%"],
    ["bact", Math.round(w.bact * 100) + "%"],
  ];
  // compact tiles: label, value and a status dot, so a test reads at a glance
  const grid = el("div", { class: "readings", role: "list" });
  for (const [key, val] of rows) {
    const lv = levelOf(key, w[key], s, tank);
    grid.append(el("div", { class: "reading " + lv, role: "listitem" }, [
      el("span", { class: "reading-label", text: t("care." + key) }),
      el("b", { class: "reading-value num", text: val }),
      el("span", { class: "lvl " + lv, text: t("level." + lv) }),
    ]));
  }
  return grid;
}
