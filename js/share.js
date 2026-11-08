// Tank layouts travel inside the link (#visit=...). Nothing is uploaded.
import { fishById, plantById, hardById } from "./sim.js";

function b64urlEncode(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deflate(text) {
  const bytes = new TextEncoder().encode(text);
  if (typeof CompressionStream === "undefined") return { z: false, bytes };
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return { z: true, bytes: new Uint8Array(await new Response(stream).arrayBuffer()) };
}
async function inflate(bytes, z) {
  if (!z) return new TextDecoder().decode(bytes);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

const r2 = (v) => Math.round(v * 100) / 100;

export function packTank(state, tank, owner = "") {
  const fish = state.fish.filter((f) => f.tank === tank.id).slice(0, 40);
  return {
    v: 1,
    n: tank.name.slice(0, 40),
    o: owner.slice(0, 30),
    w: tank.water,
    s: tank.substrate,
    g: tank.ground.map(r2),
    h: tank.hard.map((h) => [h.kind, r2(h.x), r2(h.s || 1), h.flip ? 1 : 0]),
    p: tank.plants.map((p) => [p.sp, r2(p.x), r2(p.g), p.v ? 1 : 0]),
    c: tank.corals.map((c) => [c.genes, r2(c.x), r2(c.g)]),
    f: fish.map((f) => [f.sp, f.name.slice(0, 20), f.colors, r2(f.size), f.golden ? 1 : 0, f.pers]),
  };
}

export function unpackTank(data) {
  if (!data || data.v !== 1 || !Array.isArray(data.g)) throw new Error("bad");
  const tank = {
    id: "visit",
    name: String(data.n || "Tank"),
    water: data.w === "salt" ? "salt" : "fresh",
    substrate: data.s || "aquasoil",
    ground: data.g.slice(0, 25).map(Number),
    hard: (data.h || []).filter((h) => hardById[h[0]]).map((h, i) => ({ id: "vh" + i, kind: h[0], x: +h[1], s: +h[2], flip: !!h[3] })),
    plants: (data.p || []).filter((p) => plantById[p[0]]).map((p, i) => ({ id: "vp" + i, sp: p[0], x: +p[1], g: +p[2], v: p[3] ? 1 : 0 })),
    corals: (data.c || []).map((c, i) => ({ id: "vc" + i, genes: c[0], x: +c[1], g: +c[2], name: "" })),
    lights: [0, 24],
    heater: 25,
    w: { amm: 0, no2: 0, no3: 5, bact: 1, algae: 0, glass: 0, temp: 25 },
  };
  while (tank.ground.length < 25) tank.ground.push(0.2);
  const fish = (data.f || []).filter((f) => fishById[f[0]]).map((f, i) => ({
    id: "vf" + i, sp: f[0], name: String(f[1] || ""), colors: f[2], size: +f[3], golden: !!f[4], pers: f[5] || "curious", adult: true, hunger: 0.3, mood: 80, tank: "visit",
  }));
  return { tank, fish, owner: String(data.o || ""), readOnly: true };
}

export async function shareLink(state, tank, base = location.href.split("#")[0]) {
  const { z, bytes } = await deflate(JSON.stringify(packTank(state, tank)));
  return `${base}#visit=${z ? "z" : "j"}${b64urlEncode(bytes)}`;
}

export async function readVisit(hash = location.hash) {
  const m = /#visit=([zj])([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  const text = await inflate(b64urlDecode(m[2]), m[1] === "z");
  return unpackTank(JSON.parse(text));
}
