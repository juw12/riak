// Game state container: load/save, the one-second world tick, rewards and every action the panels call.
import {
  migrate, newState, seedStarterTank, catchUp, tickWorld, levelFromXp, xpForLevel, refreshUnlocks, checkMilestones,
  markCare, careToday, dailyOrders, newFish, recordCatch, fishValue, fishById, plantById, houseById, hardById,
  waterChange, trimPlant, feedFish, newTank, tankSize, bioload, newCrop, cropProgress, newCoral, randomGenes,
  crossGenes, recordStrain, strainKey, HOUR,
} from "./sim.js";
import { TANK_SIZES, BAITS, FOODS, HARDSCAPE, PLANTS, HOUSEPLANTS, MILESTONES } from "./data.js";
import { store, uid, dayKey, clamp } from "./util.js";
import { t } from "./i18n.js";
import { LINES, QUESTS, catchFlags, fishKg, isLure, castMetres } from "./angler.js";

const SAVE_KEY = "riak.save.v1";
export const BUCKET_CAP = 8;
export const CARE_REWARD = 25;
export const MILESTONE_REWARD = 30;
export const PRICES = {
  secondTank: 500,
  reef: 600,
  trays: 150,
  starterFrag: 40,
};
export const LEVEL_GATES = { secondTank: 3, reef: 4, glowlure: 3 };

// ---------- tiny event bus ----------
const listeners = {};
export function on(type, fn) {
  (listeners[type] = listeners[type] || []).push(fn);
  return () => {
    listeners[type] = listeners[type].filter((f) => f !== fn);
  };
}
export function emit(type, payload) {
  for (const fn of listeners[type] || []) {
    try {
      fn(payload);
    } catch (e) {
      console.error(e);
    }
  }
}
// A user-visible message. kind: "" | "good" | "warn" | "big"
function notify(key, vars, kind = "") {
  emit("notify", { key, vars, kind });
}

export const game = {
  state: null,
  dirty: false,
  timer: null,
  lastSave: 0,
};

// ---------- load / save ----------
export function load(now = Date.now()) {
  let raw = null;
  try {
    raw = JSON.parse(store.get(SAVE_KEY) || "null");
  } catch (e) {
    raw = null;
  }
  game.state = raw ? migrate(raw) : newState();
  const s = game.state;
  for (const f of s.fish) if (f.tank === undefined) f.tank = "bucket";
  let away = null;
  if (raw && s.onboarded) {
    const gap = now - (s.lastTick || now);
    away = catchUp(s, now);
    away.gap = gap;
    if (gap < 15 * 60000) away = null;
  } else {
    s.lastTick = now;
  }
  return away;
}

export function save() {
  if (!game.state) return;
  game.state.lastTick = game.state.lastTick || Date.now();
  store.set(SAVE_KEY, JSON.stringify(game.state));
  game.lastSave = Date.now();
  game.dirty = false;
}
export function changed() {
  game.dirty = true;
  emit("change");
}
export function exportSave() {
  return JSON.stringify(game.state, null, 1);
}
export function importSave(text) {
  const raw = JSON.parse(text);
  if (!raw || !Array.isArray(raw.tanks) || typeof raw.xp !== "number") throw new Error("bad save");
  game.state = migrate(raw);
  game.state.lastTick = Date.now();
  save();
  changed();
}
export function resetSave() {
  store.remove(SAVE_KEY);
  game.state = newState();
  game.state.lastTick = Date.now();
  changed();
}

// ---------- onboarding ----------
export function startGame({ tankName, starter, lang }) {
  const s = game.state;
  s.tanks[0].name = (tankName || "").trim().slice(0, 30) || s.tanks[0].name;
  seedStarterTank(s, starter);
  s.onboarded = true;
  s.lang = lang;
  s.lastTick = Date.now();
  dailyOrders(s);
  save();
  changed();
}

// ---------- loop ----------
export function startLoop() {
  stopLoop();
  game.timer = setInterval(() => tick(Date.now()), 1000);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", save);
}
export function stopLoop() {
  if (game.timer) clearInterval(game.timer);
  game.timer = null;
  document.removeEventListener("visibilitychange", onVisibility);
}
function onVisibility() {
  if (document.hidden) {
    save();
    return;
  }
  const s = game.state;
  const gap = Date.now() - (s.lastTick || Date.now());
  if (gap > 15 * 60000) {
    const away = catchUp(s, Date.now());
    away.gap = gap;
    handleWorldEvents(away.born.map((b) => ({ type: "born", ...b })), true);
    emit("away", away);
    changed();
  }
}

export function tick(now = Date.now()) {
  const s = game.state;
  if (!s || !s.onboarded) return;
  const dt = clamp(now - (s.lastTick || now), 0, 60000);
  if (dt <= 0) return;
  const events = tickWorld(s, dt, now);
  s.lastTick = now;
  handleWorldEvents(events, false);
  focusTick(now);
  if (s.orders.day !== dayKey(now)) dailyOrders(s, now);
  if (now - game.lastSave > 10000) save();
  emit("tick", now);
}

function handleWorldEvents(events, quiet) {
  const s = game.state;
  const bornByTank = {};
  for (const e of events) {
    if (e.type === "born") {
      bornByTank[e.tank] = (bornByTank[e.tank] || 0) + 1;
      if (e.golden && !quiet) notify("toast.goldenBorn", {}, "big");
    }
  }
  if (!quiet) {
    for (const [tankId, n] of Object.entries(bornByTank)) {
      const tank = tankById(tankId);
      notify("toast.born", { n, tank: tank ? tank.name : "" }, "good");
      addXp(4 * n);
    }
  }
  if (Object.keys(bornByTank).length) {
    milestones();
    changed();
  }
}

// ---------- accessors ----------
export function S() {
  return game.state;
}
export function tankById(id) {
  return game.state.tanks.find((t) => t.id === id) || null;
}
export function activeTank() {
  const s = game.state;
  return tankById(s.activeTank) || s.tanks[0];
}
export function setActiveTank(id) {
  if (tankById(id)) {
    game.state.activeTank = id;
    changed();
  }
}
export function fishIn(where) {
  return game.state.fish.filter((f) => f.tank === where);
}
export function bucket() {
  return fishIn("bucket");
}
export function level() {
  return levelFromXp(game.state.xp);
}
export function levelProgress() {
  const L = level();
  const a = game.state.xp - xpForLevel(L);
  const b = xpForLevel(L + 1) - xpForLevel(L);
  return { level: L, a, b, pct: clamp(a / b, 0, 1) };
}

// ---------- rewards ----------
export function addShells(n) {
  game.state.shells = Math.max(0, Math.round(game.state.shells + n));
}
export function spend(n) {
  if (game.state.shells < n) {
    notify("common.notEnough", {}, "warn");
    return false;
  }
  game.state.shells -= n;
  return true;
}
export function addXp(n) {
  const s = game.state;
  const before = levelFromXp(s.xp);
  s.xp += Math.round(n);
  const after = levelFromXp(s.xp);
  if (after > before) {
    notify("toast.levelUp", { n: after }, "big");
    emit("levelUp", after);
  }
  for (const u of refreshUnlocks(s)) emit("unlock", u);
}
function milestones() {
  for (const m of checkMilestones(game.state)) {
    addShells(MILESTONE_REWARD);
    emit("milestone", m);
  }
}
function care(task) {
  const done = markCare(game.state, task);
  if (done) {
    addShells(CARE_REWARD);
    addXp(20);
    notify("toast.careDone", { n: game.state.care.streak }, "big");
    milestones();
  }
}
export function careState() {
  return careToday(game.state);
}

// ---------- fish ----------
export function catchFish(result, spotId) {
  const s = game.state;
  const sp = fishById[result.sp];
  const fish = newFish(result.sp, { tank: null, golden: result.golden, size: result.size });
  const rec = recordCatch(s, result.sp, result.size, result.golden, spotId);
  s.stats.caught++;
  if (result.golden) s.stats.golden++;
  addXp(8 + sp.rar * 6 + (rec.isNew ? 20 : 0));
  let frag = null;
  if (result.wildFrag) frag = addFrag();
  milestones();
  changed();
  return { fish, ...rec, frag };
}

export function canHouse(fish, tank) {
  const sp = fishById[fish.sp];
  if (!tank) return false;
  if (sp.water === "salt") return tank.water === "salt";
  if (sp.water === "fresh") return tank.water !== "salt";
  return true; // brackish fish cope with either
}

// Put a fish (new or existing) somewhere: a tank id or "bucket".
export function placeFish(fish, where) {
  const s = game.state;
  if (where === "bucket" && fish.tank !== "bucket" && bucket().length >= BUCKET_CAP) {
    notify("toast.bucketFull", {}, "warn");
    return false;
  }
  fish.tank = where;
  if (!s.fish.includes(fish)) s.fish.push(fish);
  const tank = tankById(where);
  if (tank) notify("toast.moved", { tank: tank.name });
  changed();
  return true;
}
export function sellFish(fish) {
  const s = game.state;
  const value = fishValue(fish);
  s.fish = s.fish.filter((f) => f !== fish);
  addShells(value);
  s.stats.sold++;
  notify("toast.sold", { n: value }, "good");
  milestones();
  changed();
  return value;
}
export function releaseFish(fish) {
  const s = game.state;
  s.fish = s.fish.filter((f) => f !== fish);
  s.stats.released++;
  addXp(3);
  notify("toast.released");
  milestones();
  changed();
}
export function renameFish(fish, name) {
  const clean = String(name || "").trim().slice(0, 20);
  if (clean) fish.name = clean;
  changed();
}

// ---------- feeding ----------
export function canDropFood(kind) {
  const inv = game.state.inv.food;
  return kind === "flakes" || (inv[kind] || 0) > 0;
}
export function useFood(kind) {
  if (kind === "flakes") return true;
  const inv = game.state.inv.food;
  if ((inv[kind] || 0) <= 0) {
    notify("toast.noItem", {}, "warn");
    return false;
  }
  inv[kind]--;
  changed();
  return true;
}
export function fishAte(fish, kind) {
  const food = FOODS.find((f) => f.id === kind) || FOODS[0];
  feedFish(fish, kind === "bloodworm" ? 0.3 : 0.14, food.mood);
  game.state.stats.fed++;
  care("feed");
}
export function foodWasted(n) {
  const tank = activeTank();
  tank.w.amm = clamp(tank.w.amm + 0.03 * n, 0, 8);
}

// ---------- care ----------
export function testWater() {
  const tank = activeTank();
  tank.lastTest = Date.now();
  tank.lastReadings = { ...tank.w };
  care("test");
  addXp(2);
  changed();
  return tank.w;
}
export function doWaterChange() {
  const tank = activeTank();
  waterChange(tank, 0.4);
  game.state.stats.waterChanges++;
  addXp(5);
  notify("toast.waterChange", {}, "good");
  milestones();
  changed();
}
export function glassCleaned() {
  activeTank().w.glass = 0;
  care("glass");
  addXp(2);
  notify("toast.glassClean", {}, "good");
  changed();
}
export function trim(plant) {
  const n = trimPlant(plant);
  if (!n) {
    notify("toast.trimNotReady", {}, "warn");
    return 0;
  }
  const s = game.state;
  const key = plant.v ? plant.sp + ":v" : plant.sp;
  s.inv.cuttings[key] = (s.inv.cuttings[key] || 0) + n;
  s.stats.trims++;
  addXp(3);
  notify("toast.trim", { n, plant: t("plant." + plant.sp) }, "good");
  milestones();
  changed();
  return n;
}
export function setHeater(temp) {
  activeTank().heater = clamp(+temp, 18, 30);
  changed();
}
export function setLights(on, off) {
  activeTank().lights = [clamp(+on, 0, 23), clamp(+off, 0, 23)];
  changed();
}

// ---------- scape ----------
export function invCount(type, key) {
  const inv = game.state.inv;
  if (type === "plant") return inv.cuttings[key] || 0;
  if (type === "hard") return inv.hard[key] || 0;
  return 0;
}
export function placeItem(item, x, size) {
  const s = game.state;
  const tank = activeTank();
  if (item.type === "coral") {
    const coral = s.reef.corals.find((c) => c.id === item.key);
    if (!coral || tank.water !== "salt") return false;
    s.reef.corals = s.reef.corals.filter((c) => c !== coral);
    coral.placed = true;
    coral.x = x;
    tank.corals.push(coral);
    changed();
    return true;
  }
  if (invCount(item.type, item.key) <= 0) {
    notify("toast.noItem", {}, "warn");
    return false;
  }
  if (item.type === "plant") {
    const [sp, v] = item.key.split(":");
    s.inv.cuttings[item.key]--;
    tank.plants.push({ id: uid("p"), sp, x, g: 0.35, v: v ? 1 : 0 });
  } else {
    s.inv.hard[item.key]--;
    tank.hard.push({ id: uid("h"), kind: item.key, x, s: clamp(size, 0.5, 1.8), flip: Math.random() < 0.5 });
  }
  changed();
  return true;
}
export function removeItem(sel) {
  const s = game.state;
  const tank = activeTank();
  if (sel.type === "hard") {
    tank.hard = tank.hard.filter((h) => h !== sel.ref);
    s.inv.hard[sel.ref.kind] = (s.inv.hard[sel.ref.kind] || 0) + 1;
  } else if (sel.type === "plant") {
    tank.plants = tank.plants.filter((p) => p !== sel.ref);
    const key = sel.ref.v ? sel.ref.sp + ":v" : sel.ref.sp;
    s.inv.cuttings[key] = (s.inv.cuttings[key] || 0) + 1;
  } else if (sel.type === "coral") {
    tank.corals = tank.corals.filter((c) => c !== sel.ref);
    sel.ref.placed = false;
    s.reef.corals.push(sel.ref);
  }
  changed();
}
export function setSubstrate(id) {
  activeTank().substrate = id;
  changed();
}

// ---------- shop ----------
export function buyPlant(id) {
  const p = plantById[id];
  if (!spend(p.price)) return false;
  const inv = game.state.inv.cuttings;
  inv[id] = (inv[id] || 0) + 1;
  game.state.journal.plants[id] = game.state.journal.plants[id] || { count: 1, variants: 0 };
  notify("shop.bought", { what: t("plant." + id) });
  changed();
  return true;
}
export function buyHard(id) {
  const h = hardById[id];
  if (!spend(h.price)) return false;
  const inv = game.state.inv.hard;
  inv[id] = (inv[id] || 0) + 1;
  notify("shop.bought", { what: t("hard." + id) });
  changed();
  return true;
}
export function buyBait(id, qty = 5) {
  const b = BAITS.find((x) => x.id === id);
  if (!b || level() < (b.level || 1)) return false;
  if (b.lure) qty = 1;
  if (!spend(b.price * qty)) return false;
  game.state.inv.bait[id] = (game.state.inv.bait[id] || 0) + qty;
  changed();
  return true;
}
// ---------- angler ----------
export const angler = () => game.state.angler;

export function buyLine(lv) {
  const L = LINES[lv];
  const a = game.state.angler;
  if (!L || a.line >= lv || level() < L.level) return false;
  if (!spend(L.price)) return false;
  a.line = lv;
  notify("shop.bought", { what: t("line." + L.id) });
  changed();
  return true;
}

// Bait is used up when cast; lures stay in the tackle box.
export function useBait(id) {
  const inv = game.state.inv.bait;
  if (id === "worm" || isLure(id)) return (inv[id] || 0) > 0 || id === "worm";
  if (!(inv[id] > 0)) return false;
  inv[id]--;
  changed();
  return true;
}

export function recordCast(metres) {
  const a = game.state.angler;
  a.casts++;
  a.maxCast = Math.max(a.maxCast, metres);
  changed();
}

// A snapped line costs the lure on it.
export function recordSnap(bait) {
  const a = game.state.angler;
  a.snaps++;
  let lostLure = false;
  if (isLure(bait) && game.state.inv.bait[bait] > 0) {
    game.state.inv.bait[bait]--;
    lostLure = true;
  }
  changed();
  return lostLure;
}

export function recordLanded({ sp, size, bait, spotId, phase, peak, water }) {
  const a = game.state.angler;
  const kg = fishKg(size);
  a.landed++;
  a.bestKg = Math.max(a.bestKg, kg);
  for (const f of catchFlags({ bait, spotId, phase, peak, water })) if (!a.flags.includes(f)) a.flags.push(f);
  let duelBeaten = false;
  if (a.duel && !a.duel.beaten && a.duel.sp === sp && size > a.duel.size) {
    a.duel.beaten = true;
    duelBeaten = true;
  }
  changed();
  return { kg, duelBeaten };
}

export function addPhoto(fish, extra = {}) {
  const a = game.state.angler;
  a.album.unshift({ sp: fish.sp, size: fish.size, kg: fishKg(fish.size), colors: fish.colors, golden: !!fish.golden, ts: Date.now(), ...extra });
  a.album = a.album.slice(0, 60);
  a.photos++;
  changed();
}

export function claimQuest(id) {
  const a = game.state.angler;
  const q = QUESTS.find((x) => x.id === id);
  if (!q || a.claimed[id] || !q.test(a)) return false;
  a.claimed[id] = true;
  game.state.shells += q.reward;
  addXp(20);
  notify("quest.claimed", { n: q.reward });
  changed();
  return true;
}

export function finishTournament({ won, place, score, mode }) {
  const a = game.state.angler;
  if (won) a.wins++;
  a.tourneyBest[mode] = Math.max(a.tourneyBest[mode] || 0, score);
  const reward = [120, 60, 30][place] || 10;
  game.state.shells += reward;
  addXp(15 + (won ? 25 : 0));
  changed();
  return reward;
}

export function setDuel(duel) {
  game.state.angler.duel = duel ? { ...duel, beaten: false, at: Date.now() } : null;
  changed();
}

export function buyFood(id, qty = 5) {
  const f = FOODS.find((x) => x.id === id);
  if (!spend(f.price * qty)) return false;
  game.state.inv.food[id] = (game.state.inv.food[id] || 0) + qty;
  changed();
  return true;
}
export function nextSize(tank) {
  const i = TANK_SIZES.findIndex((z) => z.id === tank.size);
  return TANK_SIZES[i + 1] || null;
}
export function upgradeTank(tank) {
  const next = nextSize(tank);
  if (!next || !spend(next.price)) return false;
  tank.size = next.id;
  addXp(15);
  changed();
  return true;
}
export function buySecondTank() {
  const s = game.state;
  if (level() < LEVEL_GATES.secondTank || s.tanks.filter((t) => t.water !== "salt").length >= 2) return false;
  if (!spend(PRICES.secondTank)) return false;
  const tank = newTank({ name: "Tank 2", seed: 19, substrate: "sand" });
  s.tanks.push(tank);
  s.activeTank = tank.id;
  addXp(20);
  changed();
  return tank;
}
export function buyReef() {
  const s = game.state;
  if (level() < LEVEL_GATES.reef || s.reef.unlocked) return false;
  if (!spend(PRICES.reef)) return false;
  const tank = newTank({ name: "Reef", water: "salt", size: "medium", substrate: "sand", seed: 31 });
  tank.hard.push({ id: uid("h"), kind: "liverock", x: 0.35, s: 1.2, flip: false }, { id: uid("h"), kind: "liverock", x: 0.7, s: 0.9, flip: true });
  s.tanks.push(tank);
  s.reef.unlocked = true;
  s.reef.tank = tank.id;
  // frags found before the reef room existed
  while (s.inv.frags > 0) {
    s.inv.frags--;
    s.reef.corals.push(newCoral(randomGenes()));
  }
  addXp(30);
  emit("unlock", "reef");
  changed();
  return tank;
}
export function buyTrays() {
  const gh = game.state.greenhouse;
  if (gh.trays.length >= 8 || !spend(PRICES.trays)) return false;
  gh.trays.push({ id: uid("g"), crop: null }, { id: uid("g"), crop: null });
  changed();
  return true;
}

// ---------- greenhouse ----------
export function seedlingCost(kind, id) {
  return kind === "house" ? Math.max(4, Math.round(houseById[id].value * 0.35)) : Math.max(3, Math.round(plantById[id].price * 0.4));
}
export function plantTray(tray, kind, id) {
  if (tray.crop) return false;
  if (!spend(seedlingCost(kind, id))) return false;
  tray.crop = newCrop(kind, id, Date.now());
  changed();
  return true;
}
export function waterTray(tray) {
  if (!tray.crop) return;
  tray.crop.water = 1;
  care("greenhouse");
  changed();
}
export function harvestTray(tray) {
  const s = game.state;
  const crop = tray.crop;
  if (!crop || cropProgress(crop, Date.now()) < 1) return null;
  let n;
  let key;
  if (crop.kind === "house") {
    n = 1;
    key = crop.sport ? crop.id + ":v" : crop.id;
    s.inv.house[key] = (s.inv.house[key] || 0) + 1;
    const j = s.journal.house[crop.id] || { count: 0, variants: 0 };
    j.count++;
    if (crop.sport) j.variants++;
    s.journal.house[crop.id] = j;
  } else {
    n = 3;
    key = crop.sport ? crop.id + ":v" : crop.id;
    s.inv.cuttings[key] = (s.inv.cuttings[key] || 0) + n;
    const j = s.journal.plants[crop.id] || { count: 0, variants: 0 };
    j.count++;
    if (crop.sport) j.variants++;
    s.journal.plants[crop.id] = j;
  }
  if (crop.sport) s.stats.sports++;
  s.stats.harvested++;
  tray.crop = null;
  addXp(6 + (crop.sport ? 15 : 0));
  care("greenhouse");
  milestones();
  changed();
  return { n, kind: crop.kind, id: crop.id, sport: crop.sport };
}
export function houseValue(key) {
  const [id, v] = key.split(":");
  return houseById[id].value * (v ? 3 : 1);
}
export function sellHouse(key) {
  const inv = game.state.inv.house;
  if (!inv[key]) return 0;
  inv[key]--;
  const value = houseValue(key);
  addShells(value);
  game.state.stats.sold++;
  changed();
  return value;
}

// ---------- reef lab ----------
export function addFrag(genes = null) {
  const s = game.state;
  if (!s.reef.unlocked) {
    s.inv.frags = (s.inv.frags || 0) + 1;
    return { pending: true };
  }
  const coral = newCoral(genes || randomGenes());
  s.reef.corals.push(coral);
  const isNew = recordStrain(s, coral);
  return { coral, isNew };
}
export function buyStarterFrag() {
  if (!game.state.reef.unlocked || !spend(PRICES.starterFrag)) return null;
  const r = addFrag();
  changed();
  return r;
}
export function fragCoral(coral) {
  if (coral.g < 1) return null;
  coral.g = 0.55;
  const r = addFrag({ ...coral.genes });
  addXp(5);
  changed();
  return r;
}
export function crossCorals(a, b) {
  if (a.g < 1 || b.g < 1 || a === b) return null;
  a.g = 0.6;
  b.g = 0.6;
  const coral = newCoral(crossGenes(a.genes, b.genes));
  game.state.reef.corals.push(coral);
  const isNew = recordStrain(game.state, coral);
  addXp(isNew ? 25 : 8);
  milestones();
  changed();
  return { coral, isNew };
}
export function coralValue(coral) {
  const g = coral.genes;
  const fancy = (g.pat !== "solid" ? 12 : 0) + Math.round(g.glow * 30) + (g.h1 !== g.h2 ? 8 : 0);
  return Math.round((20 + fancy) * clamp(coral.g, 0.3, 1.2));
}
export function sellCoral(coral) {
  const s = game.state;
  const value = coralValue(coral);
  s.reef.corals = s.reef.corals.filter((c) => c !== coral);
  for (const t of s.tanks) t.corals = t.corals.filter((c) => c !== coral);
  addShells(value);
  s.stats.sold++;
  changed();
  return value;
}
export function renameCoral(coral, name) {
  const clean = String(name || "").trim().slice(0, 24);
  if (clean) coral.name = clean;
  changed();
}

// ---------- orders ----------
export function orders() {
  return dailyOrders(game.state);
}
export function canDeliver(order) {
  const s = game.state;
  if (order.done) return false;
  if (order.kind === "fish") return s.fish.some((f) => f.sp === order.sp && f.adult !== false);
  if (order.kind === "cutting") return (s.inv.cuttings[order.sp] || 0) >= order.qty;
  if (order.kind === "house") return (s.inv.house[order.sp] || 0) >= order.qty;
  return false;
}
export function deliver(order) {
  const s = game.state;
  if (!canDeliver(order)) return false;
  if (order.kind === "fish") {
    // prefer a bucket fish, then the smallest non-golden one
    const pool = s.fish.filter((f) => f.sp === order.sp && f.adult !== false);
    pool.sort((a, b) => (a.tank === "bucket" ? -1 : 0) - (b.tank === "bucket" ? -1 : 0) || a.golden - b.golden || a.size - b.size);
    s.fish = s.fish.filter((f) => f !== pool[0]);
  } else if (order.kind === "cutting") {
    s.inv.cuttings[order.sp] -= order.qty;
  } else {
    s.inv.house[order.sp] -= order.qty;
  }
  order.done = true;
  s.orders.done = (s.orders.done || 0) + 1;
  s.stats.orders++;
  addShells(order.reward);
  addXp(order.xp);
  milestones();
  changed();
  return true;
}

// ---------- focus ----------
export function focusStart(minutes) {
  const f = game.state.focus;
  f.preset = minutes;
  f.running = { start: Date.now(), min: minutes };
  changed();
}
export function focusRemaining(now = Date.now()) {
  const r = game.state.focus.running;
  if (!r) return 0;
  return Math.max(0, r.start + r.min * 60000 - now);
}
function focusFinish(minutes, complete) {
  const s = game.state;
  const f = s.focus;
  f.running = null;
  if (minutes > 0) {
    f.total += minutes;
    f.sessions.push({ day: dayKey(), min: minutes, t: Date.now() });
    if (f.sessions.length > 400) f.sessions = f.sessions.slice(-400);
    addShells(minutes);
    addXp(minutes * 0.6);
    // focus calms the fish
    for (const fish of s.fish) fish.mood = clamp(fish.mood + Math.min(10, minutes / 3), 0, 100);
    care("focus");
  }
  milestones();
  changed();
  emit(complete ? "focusDone" : "focusStopped", minutes);
}
function focusTick(now) {
  const r = game.state.focus.running;
  if (r && focusRemaining(now) <= 0) focusFinish(r.min, true);
}
export function focusStop() {
  const r = game.state.focus.running;
  if (!r) return;
  focusFinish(Math.floor((Date.now() - r.start) / 60000), false);
}
export function focusWeek(now = Date.now()) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const key = dayKey(now - i * 24 * HOUR);
    const min = game.state.focus.sessions.filter((x) => x.day === key).reduce((a, x) => a + x.min, 0);
    days.push({ key, min, date: new Date(now - i * 24 * HOUR) });
  }
  return days;
}

// ---------- misc helpers for panels ----------
export function stocking(tank) {
  return { load: bioload(game.state, tank), cap: tankSize(tank).capacity };
}
export { MILESTONES, PLANTS, HOUSEPLANTS, HARDSCAPE, BAITS, FOODS, TANK_SIZES, strainKey, LINES, castMetres };
