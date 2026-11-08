// Angler: flick casting, a crank reel, line tension vs fish strength, tackle, tournaments and quests.
// Everything here is pure (no DOM) so it can be unit tested.
import { clamp, rng } from "./util.js";
import { FISH } from "./data.js";

// ---------- tackle ----------
// kind: bait (used up on every cast) or lure (kept, lost only when the line snaps).
export const TACKLE = {
  worm: { kind: "bait" },
  shrimpbait: { kind: "bait" },
  cricket: { kind: "bait" },
  minnow: { kind: "bait" },
  glowlure: { kind: "bait" },
  spinner: { kind: "lure" },
  fly: { kind: "lure" },
  crankbait: { kind: "lure" },
  popper: { kind: "lure" },
  jig: { kind: "lure" },
};

export const isLure = (id) => TACKLE[id]?.kind === "lure";

// How much a tackle choice changes the odds for one species. 1 = no effect.
export function tackleFactor(sp, bait, phase) {
  const big = sp.size[1];
  switch (bait) {
    case "cricket":
      return sp.water === "fresh" && big <= 12 ? 1.7 : sp.water === "salt" ? 0.5 : 1;
    case "minnow":
      return big >= 25 ? 2.3 : big < 10 ? 0.35 : 1;
    case "spinner":
      return big >= 8 && big <= 45 && sp.beh !== "bottom" ? 1.7 : 0.8;
    case "fly":
      return sp.spots.some((s) => s === "stream" || s === "glacier" || s === "sawah") && big <= 45 ? 2.1 : sp.water === "salt" ? 0.45 : 0.9;
    case "crankbait":
      return big >= 10 && big <= 60 ? 1.7 : 0.75;
    case "popper":
      return (phase === "dawn" || phase === "dusk" ? 1.8 : 1) * (sp.beh === "bottom" ? 0.45 : 1.2);
    case "jig":
      return sp.water !== "fresh" && (sp.beh === "bottom" || big >= 20) ? 2.2 : sp.water === "fresh" ? 0.65 : 1;
    default:
      return 1;
  }
}

// Long casts reach deeper water where the big and rare fish live; short casts find small fish.
export function distanceFactor(sp, distance01) {
  if (distance01 == null) return 1;
  const d = clamp(distance01, 0, 1);
  const bigOrRare = sp.size[1] >= 30 || sp.rar >= 3;
  return bigOrRare ? 0.55 + 1.25 * d : 1.3 - 0.6 * d;
}

// ---------- casting ----------
export const LINES = [
  { id: "line8", lb: 8, strength: 1, reach: 0, price: 0, level: 1 },
  { id: "line12", lb: 12, strength: 1.3, reach: 6, price: 60, level: 2 },
  { id: "line20", lb: 20, strength: 1.75, reach: 12, price: 160, level: 4 },
];
export const lineOf = (level) => LINES[clamp(level | 0, 0, LINES.length - 1)];

// Swipe speed (px per ms, upward) to cast power 0..1.
export function flickPower(speed) {
  return clamp((speed - 0.25) / 2.1, 0, 1);
}

// Phone motion peak (deg/s of rotation or m/s2 of acceleration, whichever is given) to power 0..1.
export function motionPower(rotationPeak, accelPeak = 0) {
  const fromRotation = clamp((rotationPeak - 180) / 520, 0, 1);
  const fromAccel = clamp((accelPeak - 14) / 22, 0, 1);
  return Math.max(fromRotation, fromAccel);
}

// Cast distance in metres for a power, with the line upgrade adding reach.
export function castMetres(power, lineLevel = 0) {
  const reach = 38 + lineOf(lineLevel).reach;
  return +(4 + clamp(power, 0, 1) * (reach - 4)).toFixed(1);
}
export const MAX_CAST = 50;

// Crank: angle change (radians) over dt seconds to reel speed 0..1. One turn in 0.55 s is full speed.
export function crankSpeed(deltaAngle, dt) {
  if (dt <= 0) return 0;
  return clamp(Math.abs(deltaAngle) / dt / ((Math.PI * 2) / 0.55), 0, 1);
}

// ---------- weight ----------
// Length-weight relation W = a L^3 with a fish-shaped constant; good enough for a game, labelled as an estimate.
export function fishKg(sizeCm) {
  const kg = (0.0125 * sizeCm ** 3) / 1000;
  return +kg.toFixed(kg < 1 ? 3 : 2);
}

// ---------- the fight ----------
export function newFight(sp, size, golden, distance, lineLevel = 0) {
  const kg = fishKg(size);
  const power = clamp(0.32 + Math.log10(1 + kg * 4) * 0.42 + sp.rar * 0.05 + (golden ? 0.08 : 0), 0.3, 1.25);
  return {
    dist: Math.max(3, distance),
    startDist: Math.max(3, distance),
    stamina: 1,
    tension: 0.15,
    power,
    lineStrength: lineOf(lineLevel).strength,
    run: 0,
    overload: 0,
    peak: 0,
    lineOut: 0,
    outcome: null,
    time: 0,
    side: 0,
    slack: 0,
  };
}

// One step of the fight. input.reel is crank speed 0..1, input.drag is 0 (light), 1 (medium) or 2 (heavy).
export function fightStep(f, input, dt, r = Math.random) {
  if (f.outcome) return f;
  dt = Math.min(dt, 0.1);
  f.time += dt;
  const reel = clamp(input.reel || 0, 0, 1);
  const drag = input.drag ?? 1;
  const dragHold = [0.55, 0.8, 1.05][drag] ?? 0.8;
  // runs: the fish surges, more often while it still has strength
  if (f.run > 0) f.run -= dt;
  else if (r() < dt * (0.12 + f.stamina * 0.55 * f.power)) {
    f.run = 0.7 + r() * 1.6 * f.stamina;
    f.side = r() * 2 - 1;
  }
  const running = f.run > 0;
  const pull = f.power * (0.25 + 0.75 * f.stamina) * (running ? 1 : 0.32);
  // tension: the fish pull resisted by the drag, plus your own cranking
  const target = (pull * dragHold * (0.45 + 0.55 * reel) + reel * 0.3 + (reel === 0 ? -0.08 : 0)) / f.lineStrength;
  f.tension += (clamp(target, 0, 1.4) - f.tension) * clamp(dt * 5, 0, 1);
  f.tension = clamp(f.tension, 0, 1.4);
  f.peak = Math.max(f.peak, f.tension);
  // line in and out
  if (running) {
    const out = pull * (1.25 - dragHold) * 5.5 * (1 - reel * 0.4) * dt;
    f.dist += out;
    f.lineOut += out;
  }
  f.dist -= reel * 3.1 * (running ? 0.25 : 1 - 0.35 * f.stamina * f.power) * dt;
  // the fish tires fastest when the line is tight but not breaking
  const sweet = f.tension > 0.3 && f.tension < 0.95 ? 1.5 : 0.55;
  f.stamina = clamp(f.stamina - dt * (0.02 + 0.2 * f.tension * dragHold) * sweet / (0.6 + f.power * 0.7), 0, 1);
  // break, spool out or land
  if (f.tension >= 1) f.overload += dt;
  else f.overload = Math.max(0, f.overload - dt * 0.6);
  // a slack line lets the fish shake the hook
  f.slack = f.tension < 0.12 ? f.slack + dt : Math.max(0, f.slack - dt * 2);
  if (f.overload > 0.4) f.outcome = "snap";
  else if (f.slack > 6) f.outcome = "unhooked";
  else if (f.dist > f.startDist + 30 + 12 * f.lineStrength) f.outcome = "spooled";
  else if (f.dist <= 0.6) {
    f.dist = 0;
    f.outcome = "landed";
  }
  return f;
}

// ---------- tournaments ----------
export const CPU_ANGLERS = ["Pak Darto", "Bu Sari", "Wayan", "Mei Lin", "Ucok", "Rina"];

// CPU anglers catch on a seeded schedule so the same tournament seed gives the same rivals.
export function cpuCatches(seed, spotId, seconds, pickCatch, count = 3) {
  const r = rng(seed);
  const names = CPU_ANGLERS.slice().sort(() => r() - 0.5).slice(0, count);
  return names.map((name, i) => {
    const skill = 0.75 + r() * 0.5;
    const catches = [];
    let t = 12 + r() * 25;
    while (t < seconds) {
      const c = pickCatch(r);
      catches.push({ at: t, sp: c.sp, size: c.size, kg: fishKg(c.size) });
      t += (26 + r() * 40) / skill;
    }
    return { name, cpu: true, catches, i };
  });
}

export function tournamentScore(catches, mode, untilSeconds = Infinity) {
  const list = catches.filter((c) => (c.at ?? 0) <= untilSeconds);
  if (!list.length) return 0;
  if (mode === "bigfish") return Math.max(...list.map((c) => c.kg));
  return +list.reduce((a, c) => a + c.kg, 0).toFixed(3);
}

export function rankPlayers(players, mode, untilSeconds = Infinity) {
  return players
    .map((p) => ({ ...p, score: tournamentScore(p.catches, mode, untilSeconds) }))
    .sort((a, b) => b.score - a.score);
}

// ---------- quests ----------
export const QUESTS = [
  { id: "cast25", reward: 40, test: (a) => a.maxCast >= 25 },
  { id: "cast40", reward: 90, test: (a) => a.maxCast >= 40 },
  { id: "land5", reward: 60, test: (a) => a.landed >= 5 },
  { id: "kg1", reward: 60, test: (a) => a.bestKg >= 1 },
  { id: "smooth", reward: 80, test: (a) => a.flags.includes("smooth") },
  { id: "night", reward: 70, test: (a) => a.flags.includes("night") },
  { id: "fly", reward: 80, test: (a) => a.flags.includes("fly_stream") },
  { id: "popper", reward: 80, test: (a) => a.flags.includes("popper_low") },
  { id: "jig", reward: 100, test: (a) => a.flags.includes("jig_salt") },
  { id: "kg5", reward: 150, test: (a) => a.bestKg >= 5 },
  { id: "win", reward: 150, test: (a) => a.wins >= 1 },
  { id: "album10", reward: 120, test: (a) => a.photos >= 10 },
];

export function questProgress(a) {
  return QUESTS.map((q) => ({ ...q, done: !!q.test(a), claimed: !!a.claimed[q.id] }));
}

// Flags a landed fish earns for quests.
export function catchFlags({ bait, spotId, phase, peak, water }) {
  const flags = [];
  if (peak < 0.9) flags.push("smooth");
  if (phase === "night") flags.push("night");
  if (bait === "fly" && spotId === "stream") flags.push("fly_stream");
  if (bait === "popper" && (phase === "dawn" || phase === "dusk")) flags.push("popper_low");
  if (bait === "jig" && water === "salt") flags.push("jig_salt");
  return flags;
}

export function newAngler() {
  return {
    controls: "flick",
    drag: 1,
    line: 0,
    motion: false,
    casts: 0,
    landed: 0,
    snaps: 0,
    maxCast: 0,
    bestKg: 0,
    wins: 0,
    photos: 0,
    flags: [],
    claimed: {},
    album: [],
    duel: null,
    tourneyBest: {},
  };
}

// ---------- challenge links ----------
// A friend's catch packed into a URL hash: species, size, spot and a name. No server involved.
export function packDuel({ sp, size, spot, from }) {
  const raw = [sp, size, spot, (from || "").slice(0, 24)].join("|");
  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function unpackDuel(code) {
  try {
    const raw = decodeURIComponent(escape(atob(code.replace(/-/g, "+").replace(/_/g, "/"))));
    const [sp, size, spot, from] = raw.split("|");
    const fish = FISH.find((f) => f.id === sp);
    const n = parseFloat(size);
    if (!fish || !(n > 0) || n > fish.size[1] * 1.6 || !fish.spots.includes(spot)) return null;
    return { sp, size: n, spot, from: (from || "").slice(0, 24), kg: fishKg(n) };
  } catch {
    return null;
  }
}

