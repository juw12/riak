// Small shared helpers: random numbers, maths, colour, storage, ids.

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const TAU = Math.PI * 2;

// Deterministic PRNG (mulberry32). Same seed, same sequence.
export function rng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pick(list, r = Math.random) {
  return list[Math.floor(r() * list.length)];
}

export function weightedPick(items, weightOf, r = Math.random) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightOf(it));
  if (total <= 0) return items[0];
  let roll = r() * total;
  for (const it of items) {
    roll -= Math.max(0, weightOf(it));
    if (roll <= 0) return it;
  }
  return items[items.length - 1];
}

// Roughly normal number in [0,1] (average of three uniforms).
export function bell(r = Math.random) {
  return (r() + r() + r()) / 3;
}

let idCounter = 0;
export function uid(prefix = "x") {
  idCounter = (idCounter + 1) % 1e6;
  return prefix + Date.now().toString(36) + idCounter.toString(36) + Math.floor(Math.random() * 1e4).toString(36);
}

// Colour helpers. Hex in, hex out.
export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  const to = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return "#" + to(r) + to(g) + to(b);
}

export function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}

export function shade(hex, amount) {
  return amount >= 0 ? mix(hex, "#ffffff", amount) : mix(hex, "#000000", -amount);
}

export function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function hsl(h, s, l) {
  // h 0-360, s/l 0-100 -> hex
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

export function hexToHue(hex) {
  const [r0, g0, b0] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r0, g0, b0);
  const min = Math.min(r0, g0, b0);
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: (max + min) / 2 };
  let h;
  if (max === r0) h = ((g0 - b0) / d) % 6;
  else if (max === g0) h = (b0 - r0) / d + 2;
  else h = (r0 - g0) / d + 4;
  h = (h * 60 + 360) % 360;
  const l = (max + min) / 2;
  const s = d / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

// The product never uses purple or violet. Any hue in this band is pushed out of it.
export const BANNED_HUE = [235, 335];
export function safeHue(h) {
  h = ((h % 360) + 360) % 360;
  if (h > BANNED_HUE[0] && h < BANNED_HUE[1]) {
    const mid = (BANNED_HUE[0] + BANNED_HUE[1]) / 2;
    return h < mid ? BANNED_HUE[0] - 8 : (BANNED_HUE[1] + 8) % 360;
  }
  return h;
}

// localStorage can throw (private mode, opaque origins). Fall back to memory.
const memoryStore = new Map();
export const store = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return memoryStore.has(key) ? memoryStore.get(key) : null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      memoryStore.set(key, value);
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      memoryStore.delete(key);
    }
  },
};

export function formatDuration(ms, t) {
  const min = Math.round(ms / 60000);
  if (min < 60) return t("unit.min", { n: min });
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? t("unit.hmin", { h, m }) : t("unit.h", { n: h });
}

export function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}
