// Game rules. Pure functions over a plain state object, so they can be tested without a page.
import { FISH, PLANTS, HOUSEPLANTS, SPOTS, RARITY_WEIGHT, TANK_SIZES, CORAL_FORMS, CORAL_HUES, CORAL_PATTERNS, FISH_NAMES, PERSONALITIES, MILESTONES, HARDSCAPE } from "./data.js";
import { clamp, lerp, rng, hashString, pick, weightedPick, bell, uid, hexToRgb, rgbToHex, hexToHue, hsl, safeHue, dayKey } from "./util.js";

export const SAVE_VERSION = 1;
export const HOUR = 3600000;
export const MAX_OFFLINE = 7 * 24 * HOUR;

export const fishById = Object.fromEntries(FISH.map((f) => [f.id, f]));
export const plantById = Object.fromEntries(PLANTS.map((p) => [p.id, p]));
export const houseById = Object.fromEntries(HOUSEPLANTS.map((p) => [p.id, p]));
export const spotById = Object.fromEntries(SPOTS.map((s) => [s.id, s]));
export const hardById = Object.fromEntries(HARDSCAPE.map((h) => [h.id, h]));

// ---------- Levels ----------
export function xpForLevel(level) {
  // total XP needed to reach `level`
  if (level <= 1) return 0;
  return Math.round(60 * Math.pow(level - 1, 1.6));
}
export function levelFromXp(xp) {
  let level = 1;
  while (xp >= xpForLevel(level + 1) && level < 60) level++;
  return level;
}

// ---------- Time and weather ----------
export function phaseOf(ts) {
  const h = new Date(ts).getHours() + new Date(ts).getMinutes() / 60;
  if (h >= 5 && h < 7) return "dawn";
  if (h >= 7 && h < 17) return "day";
  if (h >= 17 && h < 19) return "dusk";
  return "night";
}
// 0 = midnight dark, 1 = noon bright
export function daylight(ts) {
  const h = new Date(ts).getHours() + new Date(ts).getMinutes() / 60;
  const x = Math.cos(((h - 13) / 24) * Math.PI * 2);
  return clamp((x + 0.35) / 1.35, 0, 1);
}
export function weatherAt(spotId, ts) {
  const spot = spotById[spotId];
  const hourIndex = Math.floor(ts / HOUR / 3); // changes every 3 hours
  const r = rng(hashString(spotId + ":" + hourIndex));
  const entries = Object.entries(spot.weather).filter(([, w]) => w > 0);
  return weightedPick(entries, ([, w]) => w, r)[0];
}

// ---------- Creation ----------
export function defaultSubstrate(seed = 7) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < 25; i++) {
    const x = i / 24;
    // gentle slope: higher at the back corners, a valley left of centre
    const base = 0.16 + 0.1 * Math.pow(Math.abs(x - 0.42) * 1.6, 1.6);
    pts.push(clamp(base + (r() - 0.5) * 0.015, 0.08, 0.4));
  }
  return pts;
}

export function newTank({ name, water = "fresh", size = "nano", substrate = "aquasoil", seed = 7 } = {}) {
  return {
    id: uid("t"),
    name: name || "Tank",
    water,
    size,
    substrate,
    ground: defaultSubstrate(seed),
    hard: [],
    plants: [],
    corals: [],
    lights: [8, 22],
    heater: water === "salt" ? 25.5 : 25,
    w: { amm: 0, no2: 0, no3: 4, bact: 0.85, algae: 0.02, glass: 0.02, temp: water === "salt" ? 25.5 : 25 },
    created: Date.now(),
  };
}

export function rollColors(species, r = Math.random, golden = false) {
  if (golden) return ["#e8b830", "#f6dc7a", "#d99a1f"];
  return species.colors.map((c) => {
    const { h, s, l } = hexToHue(c);
    if (s < 0.12) return c; // keep whites and blacks
    const nh = safeHue(h + (r() - 0.5) * 14);
    return hsl(nh, clamp(s * 100 + (r() - 0.5) * 10, 10, 95), clamp(l * 100 + (r() - 0.5) * 8, 12, 92));
  });
}

export function newFish(spId, { tank = null, r = Math.random, golden = null, size = null, name = null, parents = null } = {}) {
  const sp = fishById[spId];
  const isGolden = golden === null ? r() < 0.03 : golden;
  const sz = size === null ? +(sp.size[0] + (sp.size[1] - sp.size[0]) * bell(r)).toFixed(1) : size;
  return {
    id: uid("f"),
    sp: spId,
    name: name || pick(FISH_NAMES, r),
    golden: isGolden,
    colors: rollColors(sp, r, isGolden),
    size: sz,
    pers: pick(PERSONALITIES, r),
    sex: r() < 0.5 ? "f" : "m",
    born: Date.now(),
    adult: true,
    hunger: 0.3,
    mood: 70,
    tank,
    bred: 0,
    parents,
  };
}

export function newState() {
  const tank = newTank({ name: "Tank 1" });
  return {
    v: SAVE_VERSION,
    created: Date.now(),
    lastTick: Date.now(),
    onboarded: false,
    lang: null,
    theme: "auto",
    palette: "default",
    sound: { on: false, vol: 0.5, music: true },
    reduceMotion: false,
    shells: 120,
    xp: 0,
    tanks: [tank],
    activeTank: tank.id,
    fish: [],
    bucket: [],
    inv: { cuttings: {}, house: {}, hard: {}, bait: { worm: 999, shrimpbait: 3, glowlure: 0 }, food: { flakes: 999, bloodworm: 3 }, frags: 0 },
    greenhouse: { trays: Array.from({ length: 4 }, () => ({ id: uid("g"), crop: null })), unlocked: false },
    reef: { unlocked: false, corals: [] },
    journal: { fish: {}, plants: {}, house: {}, strains: {} },
    orders: { day: "", list: [], done: 0 },
    care: { day: "", done: {}, streak: 0, last: "" },
    focus: { total: 0, sessions: [], running: null, preset: 25 },
    stats: { caught: 0, released: 0, sold: 0, bred: 0, fed: 0, waterChanges: 0, trims: 0, harvested: 0, sports: 0, golden: 0, orders: 0 },
    milestones: {},
    events: [],
    unlockedSpots: ["pond", "sawah"],
  };
}

// Starter kit used by onboarding: a planted tank and three fish.
export function seedStarterTank(state, starter = "guppy") {
  const tank = state.tanks[0];
  tank.hard = [
    { id: uid("h"), kind: "seiryu", x: 0.3, s: 1.1, flip: false },
    { id: uid("h"), kind: "seiryu", x: 0.38, s: 0.6, flip: true },
    { id: uid("h"), kind: "spider", x: 0.68, s: 1, flip: false },
  ];
  const plants = [
    ["val", 0.08], ["val", 0.12], ["rotala", 0.86], ["rotala", 0.9], ["hygro", 0.18], ["crypt", 0.5],
    ["hairgrass", 0.42], ["hairgrass", 0.47], ["hairgrass", 0.55], ["javafern", 0.66], ["anubias", 0.33], ["sword", 0.78],
  ];
  tank.plants = plants.map(([sp, x], i) => ({ id: uid("p"), sp, x, g: 0.55 + ((i * 37) % 30) / 100, v: 0 }));
  const count = { guppy: 3, neon: 6, cherrybarb: 4 }[starter] || 3;
  const r = rng(hashString(starter + state.created));
  for (let i = 0; i < count; i++) {
    const f = newFish(starter, { tank: tank.id, r, golden: false });
    state.fish.push(f);
    recordCatch(state, starter, f.size, false, null);
  }
  // starter shrimp as a cleaner
  const s = newFish("shrimp", { tank: tank.id, r, golden: false });
  state.fish.push(s);
  recordCatch(state, "shrimp", s.size, false, null);
  for (const p of plants) state.journal.plants[p[0]] = state.journal.plants[p[0]] || { count: 1, variants: 0 };
}

// ---------- Tank chemistry ----------
export function tankFish(state, tankId) {
  return state.fish.filter((f) => f.tank === tankId);
}
export function tankSize(tank) {
  return TANK_SIZES.find((s) => s.id === tank.size) || TANK_SIZES[0];
}
export function bioload(state, tank) {
  return tankFish(state, tank.id).reduce((sum, f) => {
    const sp = fishById[f.sp];
    const adultFactor = f.adult ? 1 : 0.4;
    return sum + sp.bio * adultFactor;
  }, 0);
}
export function plantMass(tank) {
  return tank.plants.reduce((sum, p) => sum + (plantById[p.sp]?.mass || 0.5) * clamp(p.g, 0.1, 1.5), 0) + tank.corals.length * 0.3;
}
export function cleanerPower(state, tank) {
  return tankFish(state, tank.id).reduce((s, f) => s + (fishById[f.sp].cleaner || 0), 0);
}
export function lightsOn(tank, ts) {
  const h = new Date(ts).getHours();
  const [on, off] = tank.lights;
  return on <= off ? h >= on && h < off : h >= on || h < off;
}

export function waterQuality(w) {
  let q = 100;
  q -= w.amm * 45;
  q -= w.no2 * 35;
  q -= Math.max(0, w.no3 - 20) * 0.9;
  q -= w.algae * 22;
  q -= w.glass * 8;
  return Math.round(clamp(q, 0, 100));
}

// Advance one tank by dtMs. Returns notable events.
export function tickTank(state, tank, dtMs, now) {
  const h = dtMs / HOUR;
  const w = tank.w;
  const light = lightsOn(tank, now);
  const load = bioload(state, tank);
  const mass = plantMass(tank);
  const cleaners = cleanerPower(state, tank);

  // waste -> ammonia -> nitrite -> nitrate
  w.amm += load * 0.05 * h;
  const c1 = Math.min(w.amm, w.bact * 0.35 * h);
  w.amm -= c1;
  w.no2 += c1;
  const c2 = Math.min(w.no2, w.bact * 0.35 * h);
  w.no2 -= c2;
  w.no3 += c2 * 4;
  w.bact = clamp(w.bact + (load > 0 ? 0.01 : -0.002) * h, 0.05, 1);

  // plants feed on nitrate (and some ammonia), mostly under light
  const uptake = mass * 0.12 * h * (light ? 1 : 0.15);
  w.no3 = Math.max(0, w.no3 - uptake);
  w.amm = Math.max(0, w.amm - mass * 0.004 * h);

  // algae likes light + nitrate, dislikes plants and cleaners
  if (light) {
    const plantShade = clamp(mass / 6, 0, 1);
    w.algae += (0.002 + 0.012 * clamp(w.no3 / 25, 0, 2) * (1 - plantShade * 0.8)) * h;
  }
  w.algae = clamp(w.algae - cleaners * 0.006 * h, 0, 1);
  w.glass = clamp(w.glass + (0.003 + w.algae * 0.02) * h, 0, 1);
  w.no3 = clamp(w.no3, 0, 120);
  w.amm = clamp(w.amm, 0, 8);
  w.no2 = clamp(w.no2, 0, 8);
  // temperature moves toward the heater
  w.temp = lerp(w.temp, tank.heater, clamp(h * 0.8, 0, 1));

  // plants grow
  const nutrient = w.no3 > 2 ? 1 : 0.6;
  for (const p of tank.plants) {
    const sp = plantById[p.sp];
    if (!sp) continue;
    const lightNeed = sp.light === "high" ? 1 : sp.light === "mid" ? 0.8 : 0.6;
    p.g = clamp(p.g + sp.rate * h * (light ? 1 : 0.1) * nutrient * lightNeed, 0, 1.6);
  }
  for (const c of tank.corals) {
    c.g = clamp((c.g || 0.3) + 0.01 * h * (light ? 1 : 0.2), 0, 1.4);
  }
  return [];
}

// What a fish needs, as a list of short codes with numbers. Empty list = happy.
export function fishNeeds(state, fish, tank) {
  const sp = fishById[fish.sp];
  const needs = [];
  if (!tank) return needs;
  const w = tank.w;
  if (fish.hunger > 0.7) needs.push({ code: "hungry" });
  if (w.temp < sp.temp[0] - 0.5) needs.push({ code: "cold", temp: w.temp, min: sp.temp[0], max: sp.temp[1] });
  if (w.temp > sp.temp[1] + 0.5) needs.push({ code: "warm", temp: w.temp, min: sp.temp[0], max: sp.temp[1] });
  if (sp.school) {
    const kin = tankFish(state, tank.id).filter((f) => f.sp === fish.sp).length;
    if (kin < sp.school) needs.push({ code: "school", have: kin, want: sp.school });
  }
  const q = waterQuality(w);
  if (q < 60) needs.push({ code: "water", q });
  const cap = tankSize(tank).capacity;
  const load = bioload(state, tank);
  if (load > cap) needs.push({ code: "crowded", load: +load.toFixed(1), cap });
  if (fish.pers === "shy" && plantMass(tank) < 3) needs.push({ code: "cover" });
  if (sp.water === "salt" && tank.water !== "salt") needs.push({ code: "salt" });
  if (sp.water === "fresh" && tank.water === "salt") needs.push({ code: "fresh" });
  return needs;
}

export function targetMood(state, fish, tank) {
  const needs = fishNeeds(state, fish, tank);
  let m = 88;
  for (const n of needs) {
    m -= { hungry: 18, cold: 22, warm: 22, school: 14, water: 20, crowded: 16, cover: 8, salt: 40, fresh: 40 }[n.code] || 10;
  }
  if (tank) m += (waterQuality(tank.w) - 80) * 0.15;
  return clamp(m, 5, 100);
}

export function tickFish(state, dtMs, now) {
  const h = dtMs / HOUR;
  const events = [];
  for (const f of state.fish) {
    const tank = state.tanks.find((t) => t.id === f.tank);
    if (!tank) continue;
    f.hunger = clamp(f.hunger + 0.06 * h, 0, 1);
    const target = targetMood(state, f, tank);
    f.mood = lerp(f.mood, target, clamp(h * 0.4, 0, 1));
    if (!f.adult && now - f.born > 36 * HOUR) {
      f.adult = true;
      events.push({ type: "grown", fish: f.id, name: f.name, sp: f.sp });
    }
  }
  return events;
}

// ---------- Breeding and genetics ----------
export function mixColor(a, b, r) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const t = r();
  return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}

export function childColors(mum, dad, r) {
  const goldenChance = 0.02 + (mum.golden ? 0.15 : 0) + (dad.golden ? 0.15 : 0);
  if (r() < goldenChance) return { golden: true, colors: ["#e8b830", "#f6dc7a", "#d99a1f"] };
  const colors = mum.colors.map((c, i) => {
    let out = mixColor(c, dad.colors[i] || c, r);
    if (r() < 0.08) {
      const { h, s, l } = hexToHue(out);
      if (s > 0.15) out = hsl(safeHue(h + (r() < 0.5 ? -1 : 1) * (20 + r() * 25)), s * 100, l * 100);
    }
    return out;
  });
  return { golden: false, colors };
}

export function tryBreed(state, tank, dtMs, now, r = Math.random) {
  const h = dtMs / HOUR;
  const fish = tankFish(state, tank.id).filter((f) => f.adult && f.mood >= 75 && now - (f.bred || 0) > 20 * HOUR);
  const born = [];
  const cap = tankSize(tank).capacity;
  if (bioload(state, tank) >= cap * 0.95) return born;
  const bySp = {};
  for (const f of fish) (bySp[f.sp] = bySp[f.sp] || []).push(f);
  for (const [spId, group] of Object.entries(bySp)) {
    const mum = group.find((f) => f.sex === "f");
    const dad = group.find((f) => f.sex === "m");
    if (!mum || !dad) continue;
    const sp = fishById[spId];
    if (sp.rar >= 5) continue; // legendary fish do not breed in a home tank
    if (r() > 0.05 * h) continue;
    const n = 1 + Math.floor(r() * (sp.bio < 0.1 ? 3 : 2));
    for (let i = 0; i < n; i++) {
      const g = childColors(mum, dad, r);
      const baby = newFish(spId, { tank: tank.id, r, golden: g.golden, parents: [mum.id, dad.id] });
      baby.colors = g.colors;
      baby.adult = false;
      baby.born = now;
      baby.size = +(sp.size[0] * 0.4).toFixed(1);
      baby.hunger = 0.2;
      state.fish.push(baby);
      born.push(baby);
      state.stats.bred++;
      if (g.golden) state.stats.golden++;
    }
    mum.bred = now;
    dad.bred = now;
    if (bioload(state, tank) >= cap * 0.95) break;
  }
  return born;
}

// ---------- Greenhouse ----------
export function cropProgress(crop, now) {
  if (!crop) return 0;
  const grown = crop.grown + (now - crop.last) * (crop.water > 0 ? 1.5 : 1);
  return clamp(grown / crop.need, 0, 1);
}
export function tickCrop(crop, dtMs) {
  if (!crop) return;
  const speed = crop.water > 0 ? 1.5 : 1;
  crop.grown = Math.min(crop.need, crop.grown + dtMs * speed);
  crop.water = Math.max(0, crop.water - dtMs / (40 * 60000));
  crop.last += dtMs;
}
export function newCrop(kind, id, now, r = Math.random) {
  const need = kind === "house" ? houseById[id].growMin * 60000 : (20 + 60 * (1 - (plantById[id].rate || 0.02) * 10)) * 60000;
  return { kind, id, planted: now, last: now, grown: 0, need: Math.max(10 * 60000, need), water: 0, sport: r() < 0.05 };
}

// ---------- Fishing ----------
export function spotCandidates(spotId, ts, bait = "worm") {
  const phase = phaseOf(ts);
  const weather = weatherAt(spotId, ts);
  return FISH.filter((f) => f.spots.includes(spotId)).map((f) => {
    let w = RARITY_WEIGHT[f.rar];
    if (f.time !== "any") {
      const match = f.time === phase || (f.time === "night" && phase === "dusk") || (f.time === "day" && phase === "dawn");
      w *= f.time === phase ? 2.4 : match ? 1 : 0.2;
    }
    if (f.weather !== "any") w *= f.weather === weather ? 2.2 : 0.6;
    if ((phase === "dawn" || phase === "dusk") && f.rar >= 4) w *= 2;
    if (bait === "shrimpbait" && f.rar >= 2) w *= 1.7;
    if (bait === "glowlure") {
      if (f.rar >= 3) w *= 1.8;
      if (f.time === "night" || f.time === "dusk") w *= 1.6;
    }
    return { sp: f, w };
  });
}

export function rollCatch(spotId, ts, bait, r = Math.random) {
  const list = spotCandidates(spotId, ts, bait);
  const chosen = weightedPick(list, (c) => c.w, r).sp;
  const golden = r() < (bait === "glowlure" ? 0.06 : 0.03);
  const size = +(chosen.size[0] + (chosen.size[1] - chosen.size[0]) * bell(r)).toFixed(1);
  return { sp: chosen.id, golden, size, wildFrag: spotById[spotId].water === "salt" && r() < 0.08 };
}

export function fishValue(fish) {
  const sp = fishById[fish.sp];
  const avg = (sp.size[0] + sp.size[1]) / 2;
  const sizeFactor = clamp(fish.size / avg, 0.4, 1.6);
  return Math.max(1, Math.round(sp.price * sizeFactor * (fish.golden ? 5 : 1) * (fish.adult === false ? 0.5 : 1)));
}

export function recordCatch(state, spId, size, golden, spotId) {
  const j = state.journal.fish[spId] || { count: 0, best: 0, golden: 0, first: Date.now(), spots: [] };
  const isNew = j.count === 0;
  const isRecord = size > j.best && j.count > 0;
  j.count++;
  j.best = Math.max(j.best, size);
  if (golden) j.golden++;
  if (spotId && !j.spots.includes(spotId)) j.spots.push(spotId);
  state.journal.fish[spId] = j;
  return { isNew, isRecord };
}

// ---------- Corals ----------
export function randomGenes(r = Math.random) {
  return {
    form: pick(CORAL_FORMS, r),
    h1: pick(CORAL_HUES, r),
    h2: pick(CORAL_HUES, r),
    sat: 45 + Math.round(r() * 40),
    lit: 42 + Math.round(r() * 20),
    pat: pick(CORAL_PATTERNS, r),
    dens: +(0.3 + r() * 0.7).toFixed(2),
    glow: +(r() * 1).toFixed(2),
  };
}
export function crossGenes(a, b, r = Math.random) {
  const choose = (x, y) => (r() < 0.5 ? x : y);
  const g = {
    form: choose(a.form, b.form),
    h1: choose(a.h1, b.h1),
    h2: choose(a.h2, b.h2),
    sat: Math.round(lerp(a.sat, b.sat, r())),
    lit: Math.round(lerp(a.lit, b.lit, r())),
    pat: choose(a.pat, b.pat),
    dens: +lerp(a.dens, b.dens, r()).toFixed(2),
    glow: +clamp(lerp(a.glow, b.glow, r()) + (r() - 0.5) * 0.2, 0, 1).toFixed(2),
  };
  if (r() < 0.2) g.h2 = pick(CORAL_HUES, r);
  if (r() < 0.08) g.pat = pick(CORAL_PATTERNS, r);
  return g;
}
export function strainKey(g) {
  return [g.form, g.h1, g.h2, g.pat, Math.round(g.sat / 10), Math.round(g.lit / 10), Math.round(g.dens * 3), Math.round(g.glow * 2)].join("-");
}
const STRAIN_A = ["Batam", "Lombok", "Bunaken", "Raja", "Komodo", "Banda", "Wakatobi", "Alor", "Togean", "Derawan", "Selayar", "Natuna"];
const STRAIN_B = ["Ember", "Tide", "Lime", "Copper", "Saffron", "Mint", "Rust", "Honey", "Sea Glass", "Lantern", "Ash", "Pearl", "Kelp", "Dawn"];
export function strainName(g) {
  const r = rng(hashString(strainKey(g)));
  return `${pick(STRAIN_A, r)} ${pick(STRAIN_B, r)}`;
}
export function coralColors(g) {
  return [hsl(safeHue(g.h1), g.sat, g.lit), hsl(safeHue(g.h2), Math.min(95, g.sat + 10), Math.min(85, g.lit + 14))];
}
export function newCoral(genes, now = Date.now()) {
  return { id: uid("c"), genes, g: 0.3, name: strainName(genes), born: now, x: null, placed: false };
}
export function recordStrain(state, coral) {
  const key = strainKey(coral.genes);
  const isNew = !state.journal.strains[key];
  if (isNew) state.journal.strains[key] = { name: coral.name, genes: coral.genes, first: Date.now() };
  return isNew;
}

// ---------- Daily orders and care ----------
export function dailyOrders(state, now = Date.now()) {
  const key = dayKey(now);
  if (state.orders.day === key && state.orders.list.length) return state.orders.list;
  const r = rng(hashString("orders:" + key + ":" + state.created));
  const spots = state.unlockedSpots;
  const fishPool = FISH.filter((f) => f.rar <= 3 && f.spots.some((s) => spots.includes(s)));
  const plantPool = PLANTS.filter((p) => p.kind !== "ball");
  const list = [];
  const f = pick(fishPool, r);
  list.push({ id: uid("o"), kind: "fish", sp: f.id, qty: 1, reward: Math.round(f.price * 2.2 + 10), xp: 15 + f.rar * 5, done: false });
  const p = pick(plantPool, r);
  list.push({ id: uid("o"), kind: "cutting", sp: p.id, qty: 2 + Math.floor(r() * 3), reward: 18 + Math.round(p.price * 1.5), xp: 12, done: false });
  const hp = pick(HOUSEPLANTS.filter((x) => x.rar <= 2), r);
  list.push({ id: uid("o"), kind: "house", sp: hp.id, qty: 1, reward: Math.round(hp.value * 1.8), xp: 12, done: false });
  state.orders = { day: key, list, done: state.orders.done || 0 };
  return list;
}

export const CARE_TASKS = ["feed", "test", "glass", "greenhouse", "focus"];
export function careToday(state, now = Date.now()) {
  const key = dayKey(now);
  if (state.care.day !== key) {
    state.care.day = key;
    state.care.done = {};
  }
  return state.care;
}
// Mark a care task done. Returns true when this completes the day.
export function markCare(state, task, now = Date.now()) {
  const care = careToday(state, now);
  if (care.done[task]) return false;
  care.done[task] = true;
  const required = ["feed", "test", "glass"];
  const complete = required.every((t) => care.done[t]);
  if (complete && care.last !== care.day) {
    const yesterday = dayKey(now - 24 * HOUR);
    care.streak = care.last === yesterday ? care.streak + 1 : 1;
    care.last = care.day;
    return true;
  }
  return false;
}

// ---------- Milestones ----------
export function statValue(state, stat) {
  switch (stat) {
    case "species":
      return Object.values(state.journal.fish).filter((j) => j.count > 0).length;
    case "focusMin":
      return state.focus.total;
    case "streak":
      return state.care.streak;
    case "strains":
      return Object.keys(state.journal.strains).length;
    default:
      return state.stats[stat] || 0;
  }
}
export function checkMilestones(state) {
  const fresh = [];
  for (const m of MILESTONES) {
    if (state.milestones[m.id]) continue;
    if (statValue(state, m.stat) >= m.goal) {
      state.milestones[m.id] = Date.now();
      fresh.push(m);
    }
  }
  return fresh;
}

// ---------- Unlocks ----------
export function refreshUnlocks(state) {
  const level = levelFromXp(state.xp);
  const fresh = [];
  for (const s of SPOTS) {
    if (level >= s.level && !state.unlockedSpots.includes(s.id)) {
      state.unlockedSpots.push(s.id);
      fresh.push(s.id);
    }
  }
  if (level >= 2 && !state.greenhouse.unlocked) {
    state.greenhouse.unlocked = true;
    fresh.push("greenhouse");
  }
  return fresh;
}

// ---------- Whole-world tick and offline catch-up ----------
export function tickWorld(state, dtMs, now, r = Math.random) {
  const events = [];
  for (const tank of state.tanks) {
    tickTank(state, tank, dtMs, now);
    for (const b of tryBreed(state, tank, dtMs, now, r)) events.push({ type: "born", fish: b.id, sp: b.sp, golden: b.golden, tank: tank.id });
  }
  events.push(...tickFish(state, dtMs, now));
  for (const tray of state.greenhouse.trays) tickCrop(tray.crop, dtMs);
  for (const c of state.reef.corals) {
    if (!c.placed) c.g = clamp(c.g + 0.012 * (dtMs / HOUR), 0, 1.4);
  }
  return events;
}

export function catchUp(state, now = Date.now(), r = Math.random) {
  const from = state.lastTick || now;
  let gap = clamp(now - from, 0, MAX_OFFLINE);
  const summary = { ms: gap, born: [], grown: 0, readyTrays: 0, overgrown: 0, before: {}, after: {} };
  for (const t of state.tanks) summary.before[t.id] = waterQuality(t.w);
  const step = 10 * 60000;
  let t = now - gap;
  while (gap > 0) {
    const dt = Math.min(step, gap);
    t += dt;
    const evs = tickWorld(state, dt, t, r);
    for (const e of evs) {
      if (e.type === "born") summary.born.push(e);
      if (e.type === "grown") summary.grown++;
    }
    gap -= dt;
  }
  for (const tk of state.tanks) {
    summary.after[tk.id] = waterQuality(tk.w);
    summary.overgrown += tk.plants.filter((p) => p.g > 1.15).length;
  }
  summary.readyTrays = state.greenhouse.trays.filter((tr) => tr.crop && cropProgress(tr.crop, now) >= 1).length;
  state.lastTick = now;
  return summary;
}

// ---------- Actions ----------
export function waterChange(tank, fraction = 0.4) {
  const w = tank.w;
  w.amm *= 1 - fraction;
  w.no2 *= 1 - fraction;
  w.no3 *= 1 - fraction;
  w.algae *= 1 - fraction * 0.35;
}
export function trimPlant(plant) {
  if (plant.g < 1.05) return 0;
  const cuttings = 1 + Math.floor((plant.g - 0.6) * 4);
  plant.g = 0.6;
  return cuttings;
}
export function feedFish(fish, amount = 0.14, bonusMood = 0) {
  fish.hunger = clamp(fish.hunger - amount, 0, 1);
  fish.mood = clamp(fish.mood + 1.5 + bonusMood, 0, 100);
}

// ---------- Save handling ----------
export function migrate(raw) {
  const base = newState();
  if (!raw || typeof raw !== "object") return base;
  const s = Object.assign(base, raw);
  s.inv = Object.assign(newState().inv, raw.inv || {});
  s.stats = Object.assign(newState().stats, raw.stats || {});
  s.journal = Object.assign(newState().journal, raw.journal || {});
  s.focus = Object.assign(newState().focus, raw.focus || {});
  s.care = Object.assign(newState().care, raw.care || {});
  s.sound = Object.assign(newState().sound, raw.sound || {});
  if (!Array.isArray(s.tanks) || !s.tanks.length) s.tanks = base.tanks;
  if (!s.tanks.find((t) => t.id === s.activeTank)) s.activeTank = s.tanks[0].id;
  s.v = SAVE_VERSION;
  return s;
}
