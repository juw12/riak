// Boot, navigation, top bar, settings, onboarding and the glue between the game core and the panels.
import * as core from "./core.js";
import { t, setLang, getLang, detectLang, LANGS } from "./i18n.js";
import { el, formatDuration } from "./util.js";
import { icon, button, openSheet, toast, clearToasts, confirmSheet, meter, segmented } from "./ui.js";
import { Ambience } from "./audio.js";
import { readVisit } from "./share.js";
import { cropProgress, xpForLevel } from "./sim.js";
import { SPOTS } from "./data.js";
import { fishThumb } from "./draw.js";
import { newFish } from "./sim.js";
import { TankPanel } from "./tankpanel.js";
import { FishingPanel } from "./fishing.js";
import { GardenPanel } from "./garden.js";
import { JournalPanel } from "./journal.js";
import { FocusPanel } from "./focus.js";

const VERSION = "1.0.0";
const NAV = [
  { id: "tank", icon: "tank" },
  { id: "fishing", icon: "hook" },
  { id: "garden", icon: "leaf" },
  { id: "journal", icon: "book" },
  { id: "focus", icon: "timer" },
];

const app = {
  current: "tank",
  panels: {},
  audio: new Ambience(),
  installPrompt: null,
  reduceMotion() {
    const s = core.S();
    return !!(s && s.reduceMotion) || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  },
  go(name) {
    if (!this.panels[name]) return;
    if (this.current !== name) {
      this.panels[this.current]?.hide();
      clearToasts();
    }
    this.current = name;
    for (const sec of document.querySelectorAll("main > .panel")) sec.hidden = sec.dataset.panel !== name;
    for (const b of document.querySelectorAll(".tab")) {
      if (b.dataset.tab === name) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    }
    this.panels[name].show();
    window.scrollTo(0, 0);
  },
};
window.riak = { app, core }; // handy for debugging and tests

// ---------- theme and language ----------
function applyTheme() {
  const theme = core.S().theme;
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}
function translateStatic() {
  for (const n of document.querySelectorAll("[data-i18n]")) n.textContent = t(n.dataset.i18n);
  document.getElementById("settingsBtn").setAttribute("aria-label", t("nav.settings"));
  document.querySelector(".skip").textContent = t("a11y.skip");
}

// ---------- nav and top bar ----------
function buildNav() {
  const nav = document.getElementById("tabs");
  nav.innerHTML = "";
  for (const item of NAV) {
    const b = el("button", { type: "button", class: "tab", "data-tab": item.id }, [icon(item.icon, 20), el("span", { text: t("nav." + item.id) })]);
    b.addEventListener("click", () => app.go(item.id));
    nav.append(b);
  }
  const settings = document.getElementById("settingsBtn");
  settings.innerHTML = "";
  settings.append(icon("gear", 20));
  settings.onclick = openSettings;
  document.getElementById("levelChip").onclick = openLevel;
  const shells = document.getElementById("shellChip");
  if (!shells.querySelector("svg")) shells.prepend(icon("shell", 16));
}

function updateTop() {
  const s = core.S();
  const lp = core.levelProgress();
  document.getElementById("levelText").textContent = t("top.level", { n: lp.level });
  document.querySelector("#levelBar i").style.width = lp.pct * 100 + "%";
  document.getElementById("levelChip").setAttribute("aria-label", t("top.level", { n: lp.level }) + ". " + t("top.xp", { a: lp.a, b: lp.b, n: lp.level + 1 }));
  document.getElementById("shellText").textContent = String(s.shells);
  document.getElementById("shellChip").setAttribute("aria-label", t("top.shells", { n: s.shells }));
  // a dot on Garden when something is ready to harvest
  const ready = s.greenhouse.unlocked && s.greenhouse.trays.some((tr) => tr.crop && cropProgress(tr.crop, Date.now()) >= 1);
  const gardenTab = document.querySelector('.tab[data-tab="garden"]');
  if (gardenTab) {
    let dot = gardenTab.querySelector(".dot");
    if (ready && !dot) gardenTab.append(el("span", { class: "dot", "aria-label": t("garden.ready") }));
    if (!ready && dot) dot.remove();
  }
}

function unlockName(u) {
  if (u === "greenhouse") return t("garden.greenhouse");
  if (u === "reef") return t("garden.reef");
  return t("spot." + u);
}

function openLevel() {
  const lp = core.levelProgress();
  const L = lp.level;
  const upcoming = [];
  for (const s of SPOTS) if (s.level > L) upcoming.push([s.level, t("spot." + s.id)]);
  if (L < 2) upcoming.push([2, t("garden.greenhouse")]);
  if (L < core.LEVEL_GATES.glowlure) upcoming.push([core.LEVEL_GATES.glowlure, t("bait.glowlure")]);
  if (L < core.LEVEL_GATES.secondTank) upcoming.push([core.LEVEL_GATES.secondTank, t("shop.newTank")]);
  if (L < core.LEVEL_GATES.reef) upcoming.push([core.LEVEL_GATES.reef, t("garden.reef")]);
  upcoming.sort((a, b) => a[0] - b[0]);
  const body = el("div", {}, [
    el("p", { text: t("top.xp", { a: lp.a, b: lp.b, n: L + 1 }) }),
    meter(lp.a, lp.b, t("top.level", { n: L })),
    el("p", { class: "explain", style: { marginTop: "8px" }, text: t("level.how") }),
    el("h3", { text: t("level.next") }),
    upcoming.length ? el("ul", { class: "plain" }, upcoming.map(([lv, name]) => el("li", {}, [el("span", { text: name }), el("span", { class: "muted", text: t("top.level", { n: lv }) })]))) : el("p", { class: "muted", text: t("level.all") }),
  ]);
  openSheet({ title: t("top.level", { n: L }), body });
}

// ---------- settings ----------
function openSettings() {
  const s = core.S();
  const body = el("div");
  const sheet = openSheet({ title: t("settings.title"), body });
  const row = (label, control) => el("div", { class: "field-row" }, [el("span", { text: label }), control]);
  const toggle = (checked, onChange, label) => {
    const input = el("input", { type: "checkbox", role: "switch", "aria-label": label });
    input.checked = !!checked;
    input.addEventListener("change", () => onChange(input.checked));
    return el("label", { class: "switch" }, [input, el("span")]);
  };
  const lang = el("select", { class: "input", style: { width: "auto" }, "aria-label": t("settings.language") });
  for (const L of LANGS) lang.append(el("option", { value: L.id, text: L.label, selected: getLang() === L.id }));
  lang.addEventListener("change", () => {
    s.lang = lang.value;
    setLang(lang.value);
    core.save();
    sheet.close();
    rebuild();
  });
  body.append(row(t("settings.language"), lang));
  body.append(el("div", { class: "field-row" }, [el("span", { text: t("settings.theme") }), segmented(["auto", "light", "dark"].map((id) => ({ id, label: t("settings.theme." + id) })), s.theme || "auto", (id) => {
    s.theme = id;
    applyTheme();
    core.changed();
  }, t("settings.theme"))]));
  body.append(row(t("settings.sound"), toggle(s.sound.on, (v) => {
    s.sound.on = v;
    app.audio.set({ on: v, music: s.sound.music, volume: s.sound.vol });
    core.changed();
  }, t("settings.sound"))));
  body.append(row(t("settings.music"), toggle(s.sound.music, (v) => {
    s.sound.music = v;
    app.audio.set({ on: s.sound.on, music: v, volume: s.sound.vol });
    core.changed();
  }, t("settings.music"))));
  const vol = el("input", { type: "range", min: "0", max: "1", step: "0.05", value: String(s.sound.vol), "aria-label": t("settings.volume"), style: { width: "160px", accentColor: "var(--accent)" } });
  vol.addEventListener("input", () => {
    s.sound.vol = +vol.value;
    app.audio.set({ on: s.sound.on, music: s.sound.music, volume: s.sound.vol });
    core.game.dirty = true;
  });
  body.append(row(t("settings.volume"), vol));
  body.append(row(t("settings.motion"), toggle(s.reduceMotion, (v) => {
    s.reduceMotion = v;
    core.changed();
  }, t("settings.motion"))));

  body.append(el("h3", { text: t("settings.backup") }));
  const file = el("input", { type: "file", accept: "application/json,.json", hidden: true });
  file.addEventListener("change", async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      core.importSave(await f.text());
      toast(t("settings.imported"), "good");
      sheet.close();
      rebuild();
    } catch (e) {
      toast(t("settings.importFail"), "warn");
    }
  });
  body.append(el("div", { class: "row" }, [
    button(t("settings.export"), { kind: "quiet", onclick: () => {
      const blob = new Blob([core.exportSave()], { type: "application/json" });
      const a = el("a", { href: URL.createObjectURL(blob), download: "riak-save-" + new Date().toISOString().slice(0, 10) + ".json" });
      document.body.append(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 500);
    } }),
    button(t("settings.import"), { kind: "quiet", onclick: () => file.click() }),
    file,
  ]));
  if (app.installPrompt) {
    body.append(el("div", { class: "row", style: { marginTop: "8px" } }, [button(t("settings.install"), { kind: "primary", onclick: async () => {
      app.installPrompt.prompt();
      app.installPrompt = null;
    } })]));
  }
  body.append(el("h3", { text: t("settings.aboutTitle") }));
  body.append(el("p", { class: "muted", text: t("settings.about") }));
  body.append(el("p", { class: "explain" }, ["Riak " + VERSION + " · ", el("a", { href: "https://github.com/juw12/riak", target: "_blank", rel: "noopener", text: "GitHub" })]));
  body.append(el("div", { class: "row", style: { marginTop: "12px" } }, [button(t("settings.reset"), { kind: "danger", onclick: () => confirmSheet(t("settings.resetConfirm"), () => {
    core.resetSave();
    sheet.close();
    rebuild();
    onboard();
  }) })]));
}

// ---------- onboarding ----------
function onboard() {
  const s = core.S();
  let starter = "guppy";
  let lang = getLang();
  let started = false;
  const nameIn = el("input", { type: "text", class: "input", value: t("onb.defaultName"), maxlength: "30", id: "onbName" });
  const starters = el("div", { class: "onb-starters", role: "radiogroup", "aria-label": t("onb.pickFish") });
  const renderStarters = () => {
    starters.innerHTML = "";
    for (const id of ["guppy", "neon", "cherrybarb"]) {
      const cv = el("canvas", { "aria-hidden": "true" });
      const b = el("button", { type: "button", class: "onb-starter", role: "radio", "aria-checked": String(starter === id), "aria-pressed": String(starter === id) }, [cv, el("span", { text: t("onb.starter." + id) })]);
      b.addEventListener("click", () => {
        starter = id;
        renderStarters();
      });
      starters.append(b);
      requestAnimationFrame(() => fishThumb(cv, newFish(id, { golden: false, r: () => 0.5 })));
    }
  };
  renderStarters();
  const langSel = el("select", { class: "input", "aria-label": t("settings.language") });
  for (const L of LANGS) langSel.append(el("option", { value: L.id, text: L.label, selected: lang === L.id }));
  langSel.addEventListener("change", () => {
    lang = langSel.value;
    setLang(lang);
    s.lang = lang;
    sheet.close();
    started = true; // reopen in the new language
    rebuild();
    onboard();
  });
  const body = el("div", {}, [
    el("p", { text: t("onb.lead") }),
    el("div", { class: "field" }, [el("label", { text: t("settings.language") }), langSel]),
    el("div", { class: "field" }, [el("label", { for: "onbName", text: t("onb.nameTank") }), nameIn]),
    el("div", { class: "field" }, [el("label", { text: t("onb.pickFish") }), starters]),
    el("ul", { class: "tips" }, [el("li", { text: t("onb.tip1") }), el("li", { text: t("onb.tip2") }), el("li", { text: t("onb.tip3") })]),
  ]);
  const start = () => {
    if (started) return;
    started = true;
    core.startGame({ tankName: nameIn.value, starter, lang });
    sheet.close();
    rebuild();
    toast(t("onb.welcome", { name: core.activeTank().name }), "big");
  };
  const sheet = openSheet({ title: t("onb.title"), body, actions: [button(t("onb.start"), { kind: "primary", onclick: start })], onClose: () => {
    if (!started) start();
  } });
}

function showAway(away) {
  if (!away) return;
  const s = core.S();
  const lines = [el("p", { text: t("away.time", { t: formatDuration(away.gap || away.ms, t) }) })];
  if (away.born.length) lines.push(el("p", { text: t("away.born", { n: away.born.length }) }));
  if (away.grown) lines.push(el("p", { text: t("away.grown", { n: away.grown }) }));
  if (away.readyTrays) lines.push(el("p", { text: t("away.trays", { n: away.readyTrays }) }));
  if (away.overgrown) lines.push(el("p", { text: t("away.overgrown", { n: away.overgrown }) }));
  for (const tk of s.tanks) {
    if (away.before[tk.id] !== undefined) lines.push(el("p", { class: "muted", text: t("away.water", { tank: tk.name, a: away.before[tk.id], b: away.after[tk.id] }) }));
  }
  const sheet = openSheet({ title: t("away.title"), body: el("div", {}, lines), actions: [button(t("away.ok"), { kind: "primary", onclick: () => sheet.close() })] });
}

// ---------- panels ----------
function buildPanels() {
  const P = (id) => document.getElementById("panel-" + id);
  app.panels = {
    tank: new TankPanel(P("tank"), app),
    fishing: new FishingPanel(P("fishing"), app),
    garden: new GardenPanel(P("garden"), app),
    journal: new JournalPanel(P("journal"), app),
    focus: new FocusPanel(P("focus"), app),
  };
  for (const p of Object.values(app.panels)) p.init();
}

function rebuild() {
  const current = app.current;
  for (const p of Object.values(app.panels)) p.hide?.();
  translateStatic();
  buildNav();
  const visit = app.panels.tank?.visit;
  buildPanels();
  app.panels.tank.visit = visit;
  app.panels.tank.refresh();
  app.current = current;
  app.go(current);
  updateTop();
}

let refreshQueued = false;
function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    updateTop();
    app.panels[app.current]?.refresh();
    if (app.current !== "tank") app.panels.tank.refreshLight?.();
  });
}

// ---------- boot ----------
async function boot() {
  let visit = null;
  try {
    visit = await readVisit();
  } catch (e) {
    visit = null;
  }
  const away = core.load();
  const s = core.S();
  setLang(s.lang || detectLang());
  applyTheme();
  translateStatic();
  buildNav();
  buildPanels();

  core.on("notify", ({ key, vars, kind }) => toast(t(key, vars), kind));
  let unlockBatch = [];
  let unlockTimer = 0;
  core.on("unlock", (u) => {
    unlockBatch.push(unlockName(u));
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => {
      const shown = unlockBatch.slice(0, 2).join(", ");
      const more = unlockBatch.length - 2;
      toast(more > 0 ? t("toast.unlockedMore", { what: shown, n: more }) : t("toast.unlocked", { what: shown }), "big");
      unlockBatch = [];
      app.audio.chime();
    }, 300);
  });
  core.on("milestone", (m) => toast(t("toast.milestone", { what: t("ms." + m.id) }) + ". +" + core.MILESTONE_REWARD, "big"));
  core.on("levelUp", () => app.audio.chime());
  core.on("focusDone", (n) => {
    toast(t("focus.done", { n }), "big");
    app.audio.chime();
  });
  core.on("focusStopped", (n) => toast(t("focus.stopped", { n })));
  core.on("change", queueRefresh);
  core.on("away", (a) => showAway(a));
  let ticks = 0;
  core.on("tick", () => {
    ticks++;
    updateTop();
    app.panels.garden.tick();
    app.panels.focus.tick();
    if (ticks % 5 === 0 && app.current === "tank") app.panels.tank.refresh();
  });

  if (visit) {
    app.panels.tank.visit = visit;
    const bar = document.getElementById("visitBar");
    bar.hidden = false;
    bar.append(el("span", { text: t("share.visiting", { name: visit.tank.name }) + (visit.owner ? " · " + visit.owner : "") }), button(t("share.leave"), { icon: "back", kind: "quiet small", onclick: () => {
      history.replaceState(null, "", location.pathname + location.search);
      location.reload();
    } }));
    document.getElementById("tabs").hidden = true;
    app.panels.tank.refresh();
  }

  app.go("tank");
  updateTop();
  core.startLoop();
  if (!visit) {
    if (!s.onboarded) onboard();
    else showAway(away);
  }

  // sound starts only after a user gesture
  const unlockAudio = () => {
    const snd = core.S().sound;
    app.audio.set({ on: snd.on, music: snd.music, volume: snd.vol });
    window.removeEventListener("pointerdown", unlockAudio);
  };
  window.addEventListener("pointerdown", unlockAudio);

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    app.installPrompt = e;
  });
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

boot();
