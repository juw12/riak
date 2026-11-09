// The living tank: rendering, fish behaviour and touch interaction on one canvas.
import { fishById, plantById, hardById, lightsOn, daylight, SAVE_VERSION } from "./sim.js";
import { SUBSTRATES } from "./data.js";
import { drawFish, drawPlant, drawHardscape, drawCoral } from "./draw.js";
import { clamp, lerp, rng, hashString, rgba, mix, shade, TAU } from "./util.js";

const SURFACE = 0.07;
const BACK_KINDS = new Set(["stem", "sword", "grass"]);
const GRID = { w: 48, h: 30 };

// A tileable caustic net: bright Voronoi cell edges, built once and reused as a drifting pattern.
let causticCanvas = null;
function causticTexture() {
  if (causticCanvas) return causticCanvas;
  const S = 192;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const g = canvas.getContext("2d");
  const img = g.createImageData(S, S);
  const r = rng(7331);
  const seeds = [];
  for (let i = 0; i < 22; i++) seeds.push([r() * S, r() * S]);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let d1 = Infinity;
      let d2 = Infinity;
      for (const [sx, sy] of seeds) {
        let dx = Math.abs(x - sx);
        let dy = Math.abs(y - sy);
        if (dx > S / 2) dx = S - dx;
        if (dy > S / 2) dy = S - dy;
        const d = dx * dx + dy * dy;
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) d2 = d;
      }
      const edge = Math.sqrt(d2) - Math.sqrt(d1);
      const v = Math.max(0, 1 - edge / 5);
      const o = (y * S + x) * 4;
      img.data[o] = 255;
      img.data[o + 1] = 252;
      img.data[o + 2] = 224;
      img.data[o + 3] = Math.round(v * v * 255);
    }
  }
  g.putImageData(img, 0, 0);
  causticCanvas = canvas;
  return canvas;
}

export class TankView {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hooks = hooks; // { source(): {tank, fish, readOnly}, onFishTap, onEat, onEvent, onScape, reduceMotion() }
    this.sprites = new Map();
    this.food = [];
    this.bubbles = [];
    this.ripples = [];
    this.snips = [];
    this.pointer = { x: 0, y: 0, down: false, active: false, moved: 0, startX: 0, startY: 0, lastT: 0 };
    this.mode = "view";
    this.scape = { tool: "place", item: null, size: 1, selected: null };
    this.dirt = new Float32Array(GRID.w * GRID.h);
    this.dirtFor = null;
    this.dirtCanvas = document.createElement("canvas");
    this.dirtCanvas.width = GRID.w;
    this.dirtCanvas.height = GRID.h;
    this.dirtDirty = true;
    this.lastGlass = 0;
    this.time = 0;
    this.running = false;
    this.calm = 0; // 0..1, focus mode dims and slows the tank
    this.W = 300;
    this.H = 200;
    this.dpr = 1;
    this.schoolTargets = {};
    this.bind();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  bind() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => this.onDown(e));
    c.addEventListener("pointermove", (e) => this.onMove(e));
    c.addEventListener("pointerup", (e) => this.onUp(e));
    c.addEventListener("pointercancel", () => {
      this.pointer.down = false;
      this.pointer.active = false;
    });
    c.addEventListener("pointerleave", () => {
      this.pointer.active = false;
    });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(50, rect.width);
    this.H = Math.max(50, rect.height);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    if (!this.running) this.render(performance.now());
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.prev = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.prev) / 1000);
      this.prev = t;
      this.update(dt, t);
      this.render(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setMode(mode) {
    this.mode = mode;
    this.scape.selected = null;
    this.canvas.dataset.mode = mode;
  }

  // ---------- geometry helpers ----------
  groundAt(tank, x) {
    const g = tank.ground;
    const f = clamp(x, 0, 1) * (g.length - 1);
    const i = Math.floor(f);
    const t = f - i;
    const a = g[i];
    const b = g[Math.min(g.length - 1, i + 1)];
    return 1 - lerp(a, b, t * t * (3 - 2 * t));
  }
  fishLen(fish) {
    const sp = fishById[fish.sp];
    const base = clamp(this.H * 0.18, 38, 130) * sp.len;
    // small species are lifted more than large ones, so a school of tetras still reads at a glance
    const sizeFactor = clamp(0.88 + Math.log2(Math.max(1, fish.size) / 4) * 0.24, 0.78, 1.6);
    return base * sizeFactor * (fish.adult === false ? 0.55 : 1);
  }

  // ---------- simulation of motion ----------
  spriteFor(fish, tank) {
    let s = this.sprites.get(fish.id);
    if (!s) {
      const r = rng(hashString(fish.id));
      const sp = fishById[fish.sp];
      const ground = this.groundAt(tank, 0.5);
      s = {
        x: 0.15 + r() * 0.7,
        y: sp.beh === "bottom" || sp.beh === "cleaner" ? ground - 0.04 : 0.25 + r() * 0.4,
        vx: (r() - 0.5) * 20,
        vy: 0,
        z: r(),
        phase: r() * TAU,
        dir: r() < 0.5 ? -1 : 1,
        tx: r(),
        ty: 0.3 + r() * 0.4,
        wait: 0,
        dash: 0,
        startle: 0,
      };
      this.sprites.set(fish.id, s);
    }
    return s;
  }

  pickTarget(s, fish, tank, r = Math.random) {
    const sp = fishById[fish.sp];
    const gx = 0.06 + r() * 0.88;
    const ground = this.groundAt(tank, gx);
    let ty;
    switch (sp.beh) {
      case "surface":
        ty = SURFACE + 0.05 + r() * 0.25;
        break;
      case "bottom":
        ty = ground - 0.03 - r() * 0.05;
        break;
      case "cleaner":
        ty = sp.body ? ground - 0.015 : ground - 0.04 - r() * 0.25;
        break;
      default:
        ty = SURFACE + 0.12 + r() * Math.max(0.05, ground - SURFACE - 0.25);
    }
    if (fish.pers === "shy" && tank.plants.length) {
      const p = tank.plants[Math.floor(r() * tank.plants.length)];
      s.tx = clamp(p.x + (r() - 0.5) * 0.08, 0.05, 0.95);
    } else {
      s.tx = gx;
    }
    s.ty = clamp(ty, SURFACE + 0.04, ground - 0.02);
    s.wait = fish.pers === "lazy" ? 1 + r() * 4 : r() < 0.3 ? r() * 2 : 0;
  }

  update(dt, t) {
    const src = this.hooks.source();
    if (!src) return;
    const { tank, fish } = src;
    this.time = t;
    const now = this.hooks.now ? this.hooks.now() : Date.now();
    const lit = lightsOn(tank, now);
    const sleepy = !lit;
    const reduce = this.hooks.reduceMotion?.();
    const W = this.W;
    const H = this.H;
    const present = new Set();
    const groups = {};
    for (const f of fish) {
      present.add(f.id);
      const sp = fishById[f.sp];
      if (sp && sp.beh === "school") (groups[f.sp] = groups[f.sp] || []).push(f);
    }
    for (const id of [...this.sprites.keys()]) if (!present.has(id)) this.sprites.delete(id);

    // school centroids and shared targets
    const centroids = {};
    for (const [spId, list] of Object.entries(groups)) {
      let cx = 0;
      let cy = 0;
      let vx = 0;
      let vy = 0;
      for (const f of list) {
        const s = this.spriteFor(f, tank);
        cx += s.x;
        cy += s.y;
        vx += s.vx;
        vy += s.vy;
      }
      const n = list.length;
      centroids[spId] = { x: cx / n, y: cy / n, vx: vx / n, vy: vy / n };
      let st = this.schoolTargets[spId];
      if (!st || Math.hypot((st.x - cx / n) * W, (st.y - cy / n) * H) < 40) {
        const gx = 0.1 + Math.random() * 0.8;
        st = { x: gx, y: SURFACE + 0.12 + Math.random() * (this.groundAt(tank, gx) - SURFACE - 0.3) };
        this.schoolTargets[spId] = st;
      }
    }

    // food in the water wakes resting fish
    const feeding = this.food.some((p) => !p.eaten);
    const slow = (sleepy && !feeding ? 0.35 : 1) * (1 - this.calm * 0.5);
    for (const f of fish) {
      const sp = fishById[f.sp];
      if (!sp) continue;
      const s = this.spriteFor(f, tank);
      const L = this.fishLen(f);
      let speed = 46 * slow * (sp.beh === "cleaner" ? (sp.body ? 0.12 : 0.4) : sp.beh === "bottom" ? 0.6 : 1);
      if (f.pers === "lazy") speed *= 0.6;
      if (f.pers === "playful") speed *= 1.15;
      if (f.mood < 35) speed *= 0.7;
      s.dash = Math.max(0, s.dash - dt);
      s.startle = Math.max(0, s.startle - dt);
      if (f.pers === "playful" && !sleepy && Math.random() < dt * 0.08) s.dash = 0.6;
      if (s.dash > 0) speed *= 2.4;
      if (s.startle > 0) speed *= 2.6;

      let tx = s.tx;
      let ty = s.ty;
      let wantFood = null;
      if (this.food.length && (f.hunger > 0.12 || f.pers === "greedy") && !this.hooks.source().readOnly) {
        let best = Infinity;
        for (const p of this.food) {
          if (p.eaten) continue;
          const d = Math.hypot((p.x - s.x) * W, (p.y - s.y) * H);
          if (d < best && (sp.beh !== "bottom" || p.landed || p.y > 0.6)) {
            best = d;
            wantFood = p;
          }
        }
        if (wantFood) {
          tx = wantFood.x;
          ty = wantFood.y;
          speed *= f.pers === "greedy" ? 1.9 : 1.5;
          if (best < L * 0.45) {
            wantFood.eaten = true;
            this.hooks.onEat?.(f, wantFood.kind);
          }
        }
      }
      if (!wantFood && this.pointer.active && !sleepy && (f.pers === "curious" || f.pers === "social") && this.mode === "view") {
        const d = Math.hypot((this.pointer.x - s.x) * W, (this.pointer.y - s.y) * H);
        if (d < W * 0.45) {
          tx = this.pointer.x + (f.pers === "social" ? 0.05 : 0.02) * Math.sign(s.x - this.pointer.x || 1);
          ty = this.pointer.y;
          speed *= 1.2;
        }
      }
      let desiredX;
      let desiredY;
      if (!wantFood && sp.beh === "school" && groups[f.sp] && groups[f.sp].length > 1) {
        const c = centroids[f.sp];
        const st = this.schoolTargets[f.sp];
        desiredX = (st.x - s.x) * W * 0.6 + (c.x - s.x) * W * 0.8 + c.vx * 0.3;
        desiredY = (st.y - s.y) * H * 0.6 + (c.y - s.y) * H * 0.8 + c.vy * 0.3;
        for (const o of groups[f.sp]) {
          if (o === f) continue;
          const os = this.sprites.get(o.id);
          if (!os) continue;
          const dx = (s.x - os.x) * W;
          const dy = (s.y - os.y) * H;
          const d = Math.hypot(dx, dy);
          if (d < L * 1.1 && d > 0.01) {
            desiredX += (dx / d) * (L * 1.1 - d) * 3;
            desiredY += (dy / d) * (L * 1.1 - d) * 3;
          }
        }
      } else {
        if (s.wait > 0 && !wantFood) {
          s.wait -= dt;
          desiredX = 0;
          desiredY = 0;
        } else {
          desiredX = (tx - s.x) * W;
          desiredY = (ty - s.y) * H;
          if (!wantFood && Math.hypot(desiredX, desiredY) < Math.max(12, L * 0.4)) this.pickTarget(s, f, tank);
        }
      }
      if (sleepy && sp.beh !== "cleaner" && !wantFood) {
        // rest low among plants at night
        const ground = this.groundAt(tank, s.x);
        desiredY += ((ground - 0.12) - s.y) * H * 0.3;
      }
      const mag = Math.hypot(desiredX, desiredY) || 1;
      const targetVx = (desiredX / mag) * speed * Math.min(1, mag / 30);
      const targetVy = (desiredY / mag) * speed * Math.min(1, mag / 30) * 0.7;
      const turn = s.startle > 0 ? 6 : 2.2;
      s.vx = lerp(s.vx, targetVx, clamp(dt * turn, 0, 1));
      s.vy = lerp(s.vy, targetVy, clamp(dt * turn, 0, 1));
      s.x += (s.vx * dt) / W;
      s.y += (s.vy * dt) / H;
      const ground = this.groundAt(tank, s.x);
      const bottomPad = sp.body ? 0.012 : (L * sp.h * 0.5) / H + 0.01;
      s.x = clamp(s.x, 0.03, 0.97);
      s.y = clamp(s.y, SURFACE + 0.03, ground - bottomPad);
      if (Math.abs(s.vx) > 3) s.dir = s.vx > 0 ? 1 : -1;
      const swim = Math.hypot(s.vx, s.vy);
      s.phase += dt * (reduce ? 3 : 4 + swim * 0.12);
    }

    // food
    for (const p of this.food) {
      if (p.landed) {
        p.age += dt;
        continue;
      }
      p.vy = Math.min(p.vy + dt * 0.02, 0.05);
      p.y += p.vy * dt;
      p.x += Math.sin(t * 0.002 + p.seed) * 0.0004;
      const g = this.groundAt(tank, p.x) - 0.008;
      if (p.y >= g) {
        p.y = g;
        p.landed = true;
      }
    }
    const dissolved = this.food.filter((p) => !p.eaten && p.landed && p.age > 25);
    if (dissolved.length) this.hooks.onEvent?.("foodWasted", dissolved.length);
    this.food = this.food.filter((p) => !p.eaten && !(p.landed && p.age > 25));

    // bubbles: air stone on the right, oxygen pearls from plants when lit
    if (!reduce && Math.random() < dt * 9) this.bubbles.push({ x: 0.93 + (Math.random() - 0.5) * 0.01, y: this.groundAt(tank, 0.93) - 0.01, r: 1.5 + Math.random() * 2.5, v: 0.12 + Math.random() * 0.08 });
    if (lit && !reduce && tank.plants.length && Math.random() < dt * 0.9) {
      const p = tank.plants[Math.floor(Math.random() * tank.plants.length)];
      if (p.g > 0.6) this.bubbles.push({ x: p.x, y: this.groundAt(tank, p.x) - 0.1 - Math.random() * 0.2, r: 1 + Math.random(), v: 0.05 });
    }
    for (const b of this.bubbles) {
      b.y -= b.v * dt;
      b.x += Math.sin(t * 0.003 + b.r * 10) * 0.0003;
    }
    this.bubbles = this.bubbles.filter((b) => b.y > SURFACE);
    for (const rp of this.ripples) rp.t += dt;
    this.ripples = this.ripples.filter((rp) => rp.t < 0.9);
    for (const sn of this.snips) {
      sn.t += dt;
      sn.y -= dt * 0.04;
    }
    this.snips = this.snips.filter((sn) => sn.t < 1.2);

    // glass dirt follows the tank value
    this.syncDirt(tank);
  }

  syncDirt(tank) {
    if (this.dirtFor !== tank.id) {
      this.dirtFor = tank.id;
      this.lastGlass = 0;
      this.dirt.fill(0);
    }
    const target = tank.w.glass;
    if (target > this.lastGlass + 0.004) {
      const d = target - this.lastGlass;
      const r = rng(hashString(tank.id + Math.floor(target * 100)));
      for (let i = 0; i < this.dirt.length; i++) {
        const yy = Math.floor(i / GRID.w) / GRID.h;
        const edge = 0.6 + 0.6 * Math.abs(yy - 0.5);
        this.dirt[i] = clamp(this.dirt[i] + d * (0.5 + r() * 0.9) * edge, 0, 1);
      }
      this.lastGlass = target;
      this.dirtDirty = true;
    } else if (target < this.lastGlass - 0.02) {
      // cleaned elsewhere (e.g. care action): scale down
      const k = target / Math.max(0.0001, this.lastGlass);
      for (let i = 0; i < this.dirt.length; i++) this.dirt[i] *= k;
      this.lastGlass = target;
      this.dirtDirty = true;
    }
  }

  wipe(px, py, radius) {
    const src = this.hooks.source();
    if (!src) return;
    const gx = px * GRID.w;
    const gy = py * GRID.h;
    const rr = radius * GRID.w;
    let changed = false;
    for (let y = Math.max(0, Math.floor(gy - rr)); y < Math.min(GRID.h, Math.ceil(gy + rr)); y++) {
      for (let x = Math.max(0, Math.floor(gx - rr)); x < Math.min(GRID.w, Math.ceil(gx + rr)); x++) {
        const d = Math.hypot(x - gx, (y - gy) * (GRID.w / GRID.h) * (this.H / this.W));
        if (d < rr) {
          const i = y * GRID.w + x;
          const nv = Math.max(0, this.dirt[i] - 0.35 * (1 - d / rr));
          if (nv !== this.dirt[i]) {
            this.dirt[i] = nv;
            changed = true;
          }
        }
      }
    }
    if (changed) {
      this.dirtDirty = true;
      let sum = 0;
      for (const v of this.dirt) sum += v;
      const avg = sum / this.dirt.length;
      const before = src.tank.w.glass;
      src.tank.w.glass = Math.min(before, avg);
      this.lastGlass = src.tank.w.glass;
      if (avg < 0.03 && before >= 0.03) {
        this.dirt.fill(0);
        src.tank.w.glass = 0;
        this.lastGlass = 0;
        this.hooks.onEvent?.("glassClean");
      }
    }
  }

  dropFood(x, kind = "flakes") {
    const n = kind === "bloodworm" ? 2 : 4;
    for (let i = 0; i < n; i++) {
      this.food.push({ x: clamp(x + (Math.random() - 0.5) * 0.04, 0.04, 0.96), y: SURFACE + 0.005, vy: 0.01 + Math.random() * 0.01, landed: false, age: 0, seed: Math.random() * 10, kind });
    }
    this.ripples.push({ x, y: SURFACE + 0.01, t: 0 });
  }

  // ---------- input ----------
  local(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  }

  fishAt(x, y) {
    const src = this.hooks.source();
    if (!src) return null;
    let best = null;
    let bestD = Infinity;
    for (const f of src.fish) {
      const s = this.sprites.get(f.id);
      if (!s) continue;
      const L = this.fishLen(f);
      const d = Math.hypot((s.x - x) * this.W, (s.y - y) * this.H);
      if (d < Math.max(22, L * 0.7) && d < bestD) {
        best = f;
        bestD = d;
      }
    }
    return best;
  }

  plantAt(tank, x, y) {
    let best = null;
    let bestD = Infinity;
    for (const p of tank.plants) {
      const dx = Math.abs(p.x - x) * this.W;
      const gy = this.groundAt(tank, p.x);
      const sp = plantById[p.sp];
      const top = sp.kind === "floater" ? SURFACE - 0.02 : gy - 0.08 - p.g * (sp.kind === "stem" || sp.tall ? 0.45 : 0.15);
      const bottom = sp.kind === "floater" ? SURFACE + 0.12 : gy + 0.02;
      if (dx < Math.max(18, this.H * 0.05) && y > top && y < bottom && dx < bestD) {
        best = p;
        bestD = dx;
      }
    }
    return best;
  }

  hardAt(tank, x, y) {
    for (let i = tank.hard.length - 1; i >= 0; i--) {
      const h = tank.hard[i];
      const gy = this.groundAt(tank, h.x);
      const w = (this.H * 0.16 * (h.s || 1)) / this.W;
      const ht = 0.22 * (h.s || 1);
      if (Math.abs(h.x - x) < w && y > gy - ht && y < gy + 0.03) return h;
    }
    return null;
  }

  coralAt(tank, x, y) {
    for (const c of tank.corals) {
      const gy = this.groundAt(tank, c.x);
      if (Math.abs(c.x - x) * this.W < this.H * 0.1 && y > gy - 0.2 && y < gy + 0.03) return c;
    }
    return null;
  }

  onDown(e) {
    const p = this.local(e);
    this.canvas.setPointerCapture?.(e.pointerId);
    Object.assign(this.pointer, { x: p.x, y: p.y, down: true, active: true, moved: 0, startX: p.x, startY: p.y, lastT: performance.now() });
    const src = this.hooks.source();
    if (!src || src.readOnly) return;
    const tank = src.tank;
    if (this.mode === "scape") {
      if (this.scape.tool === "move") {
        const h = this.hardAt(tank, p.x, p.y);
        const pl = h ? null : this.plantAt(tank, p.x, p.y);
        const c = h || pl ? null : this.coralAt(tank, p.x, p.y);
        this.scape.selected = h ? { type: "hard", ref: h } : pl ? { type: "plant", ref: pl } : c ? { type: "coral", ref: c } : null;
        this.hooks.onScape?.("select", this.scape.selected);
      } else if (this.scape.tool === "sculpt") {
        this.sculpt(tank, p.x, p.y);
      }
    } else if (this.mode === "clean") {
      this.wipe(p.x, p.y, 0.06);
    }
  }

  onMove(e) {
    const p = this.local(e);
    const dx = (p.x - this.pointer.x) * this.W;
    const dy = (p.y - this.pointer.y) * this.H;
    this.pointer.moved += Math.hypot(dx, dy);
    this.pointer.x = p.x;
    this.pointer.y = p.y;
    this.pointer.active = true;
    const src = this.hooks.source();
    if (!src || !this.pointer.down || src.readOnly) return;
    const tank = src.tank;
    if (this.mode === "clean") this.wipe(p.x, p.y, 0.06);
    if (this.mode === "scape") {
      if (this.scape.tool === "sculpt") this.sculpt(tank, p.x, p.y);
      if (this.scape.tool === "move" && this.scape.selected) {
        this.scape.selected.ref.x = clamp(p.x, 0.04, 0.96);
        this.hooks.onScape?.("moved", this.scape.selected);
      }
    }
  }

  onUp(e) {
    const p = this.local(e);
    const wasTap = this.pointer.moved < 10;
    this.pointer.down = false;
    if (e.pointerType !== "mouse") this.pointer.active = false;
    const src = this.hooks.source();
    if (!src) return;
    const tank = src.tank;
    if (!wasTap) return;
    if (this.mode === "view") {
      const f = this.fishAt(p.x, p.y);
      if (f) {
        this.hooks.onFishTap?.(f);
        return;
      }
      if (src.readOnly) return;
      this.ripples.push({ x: p.x, y: p.y, t: 0 });
      for (const fish of src.fish) {
        const s = this.sprites.get(fish.id);
        if (!s) continue;
        const d = Math.hypot((s.x - p.x) * this.W, (s.y - p.y) * this.H);
        if (d < this.W * 0.25) {
          if (fish.pers === "curious") {
            s.tx = p.x;
            s.ty = p.y;
            s.wait = 0;
          } else {
            s.startle = fish.pers === "shy" ? 1.2 : 0.4;
            s.tx = clamp(s.x + (s.x - p.x) * 2, 0.05, 0.95);
            s.ty = clamp(s.y + (s.y - p.y), SURFACE + 0.05, 0.9);
            s.wait = 0;
          }
        }
      }
      this.hooks.onEvent?.("tapGlass");
    } else if (this.mode === "feed") {
      if (src.readOnly) return;
      this.hooks.onEvent?.("feedTap", p.x);
    } else if (this.mode === "trim") {
      const pl = this.plantAt(tank, p.x, p.y);
      if (pl) {
        this.hooks.onEvent?.("trim", pl);
        this.snips.push({ x: pl.x, y: this.groundAt(tank, pl.x) - 0.3, t: 0 });
      }
    } else if (this.mode === "scape") {
      const tool = this.scape.tool;
      if (tool === "place" && this.scape.item) {
        this.hooks.onScape?.("place", { item: this.scape.item, x: clamp(p.x, 0.04, 0.96), size: this.scape.size });
      } else if (tool === "remove") {
        const h = this.hardAt(tank, p.x, p.y);
        const pl = h ? null : this.plantAt(tank, p.x, p.y);
        const c = h || pl ? null : this.coralAt(tank, p.x, p.y);
        if (h) this.hooks.onScape?.("remove", { type: "hard", ref: h });
        else if (pl) this.hooks.onScape?.("remove", { type: "plant", ref: pl });
        else if (c) this.hooks.onScape?.("remove", { type: "coral", ref: c });
      }
    }
  }

  sculpt(tank, x, y) {
    const g = tank.ground;
    const target = clamp(1 - y, 0.06, 0.48);
    const centre = x * (g.length - 1);
    for (let i = 0; i < g.length; i++) {
      const d = Math.abs(i - centre);
      if (d < 2.5) {
        const w = 1 - d / 2.5;
        g[i] = lerp(g[i], target, 0.35 * w);
      }
    }
    this.hooks.onScape?.("sculpt");
  }

  // ---------- rendering ----------
  render(t) {
    const src = this.hooks.source?.();
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const W = this.W;
    const H = this.H;
    ctx.clearRect(0, 0, W, H);
    if (!src) return;
    const { tank, fish } = src;
    const now = this.hooks.now ? this.hooks.now() : Date.now();
    const lit = lightsOn(tank, now);
    const day = daylight(now);
    const salt = tank.water === "salt";
    const reduce = this.hooks.reduceMotion?.();
    const algae = tank.w.algae;

    // water body
    const top = salt ? "#bfe6ea" : mix("#cfe6dc", "#b9dccf", algae);
    const mid = salt ? "#5fb7c8" : mix("#7fb9a6", "#86b07a", algae * 0.8);
    const deep = salt ? "#1f6f8a" : mix("#2f6a62", "#3f6a42", algae * 0.6);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, top);
    bg.addColorStop(0.45, mid);
    bg.addColorStop(1, deep);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // back-wall vignette
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.35, H * 0.2, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    vg.addColorStop(0, "rgba(255,255,255,0.10)");
    vg.addColorStop(1, "rgba(0,20,25,0.25)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // box interior in one-point perspective: the side panes recede toward a smaller back wall
    const inset = W * 0.045;
    const backTop = SURFACE * H + H * 0.02;
    const backBottom = H * 0.8;
    const sidePane = (x0, x1) => {
      const sg = ctx.createLinearGradient(x0, 0, x1, 0);
      sg.addColorStop(0, "rgba(0,24,28,0.22)");
      sg.addColorStop(1, "rgba(0,24,28,0.04)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x1, backTop);
      ctx.lineTo(x1, backBottom);
      ctx.lineTo(x0, H);
      ctx.closePath();
      ctx.fill();
    };
    sidePane(0, inset);
    sidePane(W, W - inset);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(inset, backTop);
    ctx.lineTo(inset, backBottom);
    ctx.moveTo(W - inset, backTop);
    ctx.lineTo(W - inset, backBottom);
    ctx.stroke();

    // distant planting on the back glass: soft, low-contrast silhouettes that give the water column depth
    {
      const r = rng(hashString(tank.id + "backdrop"));
      const tone = salt ? "rgba(20,70,90," : "rgba(24,72,58,";
      for (let layer = 0; layer < 2; layer++) {
        const alpha = layer ? 0.16 : 0.1;
        const count = 9 + layer * 5;
        for (let i = 0; i < count; i++) {
          const bx = inset + r() * (W - inset * 2);
          const tall = H * (0.18 + r() * 0.28) * (layer ? 0.8 : 1);
          const base = backBottom + H * 0.01;
          const sway = reduce ? 0 : Math.sin(t * 0.0005 + i) * W * 0.004;
          ctx.fillStyle = tone + alpha + ")";
          if (salt || r() < 0.4) {
            // rounded clump (rock or coral head seen through haze)
            ctx.beginPath();
            ctx.ellipse(bx, base, W * (0.025 + r() * 0.03), tall * 0.35, 0, Math.PI, TAU);
            ctx.fill();
          } else {
            // stem-plant spray
            const blades = 4 + Math.floor(r() * 4);
            for (let b = 0; b < blades; b++) {
              const lean = (b - blades / 2) * W * 0.008;
              const bw = W * 0.006;
              const h2 = tall * (0.7 + r() * 0.3);
              ctx.beginPath();
              ctx.moveTo(bx - bw, base);
              ctx.quadraticCurveTo(bx + lean * 0.5, base - h2 * 0.6, bx + lean * 2 + sway, base - h2);
              ctx.quadraticCurveTo(bx + lean * 0.5 + bw * 2, base - h2 * 0.5, bx + bw, base);
              ctx.closePath();
              ctx.fill();
            }
          }
        }
      }
      // haze band where the back glass meets the substrate
      const hz = ctx.createLinearGradient(0, backBottom - H * 0.2, 0, backBottom + H * 0.02);
      hz.addColorStop(0, rgba(mid, 0));
      hz.addColorStop(1, rgba(mid, 0.35));
      ctx.fillStyle = hz;
      ctx.fillRect(0, backBottom - H * 0.2, W, H * 0.22);
    }

    // light rays
    if (lit) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 5; i++) {
        const phase = reduce ? 0 : t * 0.00008 + i * 1.7;
        const x0 = W * (0.12 + i * 0.2 + Math.sin(phase) * 0.03);
        const w0 = W * 0.05;
        const gr = ctx.createLinearGradient(0, 0, 0, H * 0.9);
        gr.addColorStop(0, "rgba(255,255,235,0.12)");
        gr.addColorStop(1, "rgba(255,255,235,0)");
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(x0, SURFACE * H);
        ctx.lineTo(x0 + w0, SURFACE * H);
        ctx.lineTo(x0 + w0 * 3 + W * 0.05, H * 0.9);
        ctx.lineTo(x0 + W * 0.05, H * 0.9);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // fish far behind (z < 0.3)
    const sorted = fish.map((f) => ({ f, s: this.sprites.get(f.id) })).filter((o) => o.s);
    sorted.sort((a, b) => a.s.z - b.s.z);
    const sleepy = !lit;
    const drawOne = ({ f, s }) => {
      const L = this.fishLen(f) * (0.82 + s.z * 0.18);
      const tilt = clamp(s.vy / 120, -0.35, 0.35) * s.dir;
      drawFish(ctx, f, s.x * W, s.y * H, L, s.dir, s.phase, { sleeping: sleepy && f.hunger < 0.9, tilt, alpha: 0.75 + s.z * 0.25 });
      if (this.selectedFish === f.id) {
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, L * 0.7, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };

    // substrate
    const sub = SUBSTRATES.find((x) => x.id === tank.substrate) || SUBSTRATES[0];
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const x = i / 48;
      pts.push([x * W, this.groundAt(tank, x) * H]);
    }
    const drawGround = () => {
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.lineTo(W, H);
      ctx.closePath();
      const sg = ctx.createLinearGradient(0, H * 0.6, 0, H);
      sg.addColorStop(0, sub.color2);
      sg.addColorStop(1, sub.color);
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.save();
      ctx.clip();
      const r = rng(hashString(tank.id + "grain"));
      ctx.fillStyle = rgba(sub.grain, 0.55);
      for (let i = 0; i < 260; i++) {
        const gx = r() * W;
        const gy = this.groundAt(tank, gx / W) * H + r() * H * 0.4;
        ctx.fillRect(gx, gy, 1.6, 1.6);
      }
      for (let i = 0; i < 18; i++) {
        const sx = r() * W;
        const top = this.groundAt(tank, sx / W) * H;
        const sy = top + (H - top) * (0.25 + r() * 0.7);
        const sr = 3 + r() * 7;
        ctx.fillStyle = rgba(shade(sub.color, 0.15 + r() * 0.2), 0.55);
        ctx.beginPath();
        ctx.ellipse(sx, sy, sr * 1.4, sr, r() * 0.6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.beginPath();
        ctx.ellipse(sx - sr * 0.4, sy - sr * 0.35, sr * 0.6, sr * 0.3, 0, 0, TAU);
        ctx.fill();
      }
      // caustic shimmer on the ground surface
      if (lit && !reduce) {
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 14; i++) {
          const cx = ((i * 0.13 + Math.sin(t * 0.0004 + i) * 0.05) % 1) * W;
          const cy = this.groundAt(tank, cx / W) * H + 4;
          ctx.fillStyle = "rgba(255,255,220,0.06)";
          ctx.beginPath();
          ctx.ellipse(cx, cy, W * 0.03, 3, 0, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
      // ground edge line
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = rgba(shade(sub.color2, 0.2), 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    // the substrate's top surface, seen receding toward the back glass
    const floorDepth = H * 0.075;
    const drawFloor = () => {
      ctx.beginPath();
      ctx.moveTo(0, H);
      pts.forEach(([x, y], i) => {
        const pull = Math.abs(x / W - 0.5) * 2;
        ctx.lineTo(x + (W / 2 - x) * 0.06 * pull, y - floorDepth);
      });
      ctx.lineTo(W, H);
      ctx.closePath();
      const fg = ctx.createLinearGradient(0, H * 0.62, 0, H);
      fg.addColorStop(0, mix(sub.color2, mid, 0.45));
      fg.addColorStop(1, sub.color2);
      ctx.fillStyle = fg;
      ctx.fill();
      ctx.save();
      ctx.clip();
      const r = rng(hashString(tank.id + "floor"));
      ctx.fillStyle = rgba(sub.grain, 0.3);
      for (let i = 0; i < 120; i++) {
        const gx = r() * W;
        const gy = this.groundAt(tank, gx / W) * H - r() * floorDepth;
        ctx.fillRect(gx, gy, 1.2, 1.2);
      }
      if (lit) {
        const pattern = ctx.createPattern(causticTexture(), "repeat");
        ctx.globalCompositeOperation = "lighter";
        const drift = reduce ? 0 : t * 0.006;
        for (const [k, a] of [[1, 0.2], [-0.7, 0.12]]) {
          pattern.setTransform(new DOMMatrix().translate(drift * k, H * 0.6).scale(W / 520, (W / 520) * 0.32));
          ctx.fillStyle = pattern;
          ctx.globalAlpha = a;
          ctx.fillRect(0, H * 0.55, W, H * 0.45);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.restore();
    };
    // fine growth on the substrate: a low carpet of grass blades and moss cushions (freshwater),
    // sand ripples and shell grit (reef), plus scattered pebbles; seeded per tank so it never jumps
    const drawCarpet = () => {
      const r = rng(hashString(tank.id + "carpet"));
      const sway = reduce ? 0 : t * 0.0011;
      // pebbles first, the carpet grows around them
      for (let i = 0; i < 34; i++) {
        const px = r() * W;
        const depth = r();
        const py = this.groundAt(tank, px / W) * H - floorDepth * depth * 0.85;
        const pr = (2.2 + r() * 4.2) * (1 - depth * 0.45) * (W / 900 + 0.4);
        const tone = r();
        ctx.fillStyle = tone < 0.4 ? "#8d8577" : tone < 0.75 ? "#a39a89" : "#6f6a60";
        ctx.beginPath();
        ctx.ellipse(px, py, pr * 1.3, pr * 0.72, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.beginPath();
        ctx.ellipse(px - pr * 0.35, py - pr * 0.28, pr * 0.5, pr * 0.22, -0.2, 0, TAU);
        ctx.fill();
      }
      if (salt) {
        ctx.strokeStyle = "rgba(255,250,235,0.22)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 26; i++) {
          const px = r() * W;
          const py = this.groundAt(tank, px / W) * H - floorDepth * r() * 0.85;
          const w = W * (0.02 + r() * 0.03);
          ctx.moveTo(px - w, py);
          ctx.quadraticCurveTo(px, py - 2.5, px + w, py);
        }
        ctx.stroke();
        return;
      }
      const tones = ["#4f7d3c", "#6a9a45", "#86b357"];
      const scale = Math.max(0.7, H / 420);
      for (let tone = 0; tone < tones.length; tone++) {
        ctx.fillStyle = tones[tone];
        ctx.beginPath();
        const clumps = 30;
        for (let c = 0; c < clumps; c++) {
          const cx = r() * W;
          const depth = r();
          const base = this.groundAt(tank, cx / W) * H - floorDepth * depth * 0.9;
          const near = 1 - depth * 0.5;
          const blades = 5 + Math.floor(r() * 5);
          for (let b = 0; b < blades; b++) {
            const bx = cx + (r() - 0.5) * 16 * scale;
            const h = (5 + r() * 9) * scale * near * (1 - tone * 0.18);
            const lean = (r() - 0.5) * 5 * scale + Math.sin(sway + cx * 0.02) * 1.6 * scale;
            const w = 1.1 * scale * near;
            ctx.moveTo(bx - w, base);
            ctx.quadraticCurveTo(bx + lean * 0.4, base - h * 0.6, bx + lean, base - h);
            ctx.quadraticCurveTo(bx + lean * 0.4 + w, base - h * 0.5, bx + w, base);
          }
        }
        ctx.fill();
      }
      // moss cushions
      for (let i = 0; i < 9; i++) {
        const cx = r() * W;
        const depth = r();
        const base = this.groundAt(tank, cx / W) * H - floorDepth * depth * 0.8;
        const rw = (10 + r() * 16) * scale * (1 - depth * 0.4);
        const g = ctx.createRadialGradient(cx - rw * 0.3, base - rw * 0.35, 1, cx, base, rw);
        g.addColorStop(0, "#9cc463");
        g.addColorStop(0.6, "#5f8f3c");
        g.addColorStop(1, "rgba(52,90,40,0.85)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(cx, base, rw, rw * 0.42, 0, Math.PI, TAU);
        ctx.fill();
      }
    };
    // soft shadows on the floor; deeper fish cast theirs further back
    const drawShadows = () => {
      if (!lit) return;
      ctx.save();
      for (const { f, s } of sorted) {
        const gx = s.x * W;
        const floorY = this.groundAt(tank, s.x) * H - floorDepth * (1 - s.z) * 0.9;
        const height = clamp((floorY - s.y * H) / H, 0, 1);
        const L = this.fishLen(f) * (0.82 + s.z * 0.18);
        const alpha = 0.22 * (1 - height) * (0.6 + s.z * 0.4);
        if (alpha <= 0.01) continue;
        ctx.fillStyle = `rgba(10,30,28,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(gx, floorY, L * (0.32 + height * 0.25), L * 0.07, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    };

    for (const o of sorted) if (o.s.z < 0.3) drawOne(o);
    // back plants
    const selected = this.scape.selected?.ref;
    for (const p of tank.plants) {
      const sp = plantById[p.sp];
      if (!sp || !BACK_KINDS.has(sp.kind)) continue;
      drawPlant(ctx, p, p.x * W, this.groundAt(tank, p.x) * H, H, reduce ? 0 : t, { algae, highlight: selected === p ? "#ffffff" : this.mode === "trim" && p.g > 1.05 ? "rgba(255,255,255,0.7)" : null });
    }
    // depth haze: everything drawn so far sits deeper in the water
    ctx.fillStyle = rgba(mid, 0.2);
    ctx.fillRect(0, 0, W, H);
    drawFloor();
    drawGround();
    drawShadows();
    drawCarpet();
    for (const h of tank.hard) {
      drawHardscape(ctx, h, h.x * W, this.groundAt(tank, h.x) * H, H, { algae, highlight: selected === h ? "#ffffff" : null });
    }
    for (const c of tank.corals) {
      drawCoral(ctx, c, c.x * W, this.groundAt(tank, c.x) * H + 2, H * 0.28, reduce ? 0 : t, { night: !lit });
    }
    for (const p of tank.plants) {
      const sp = plantById[p.sp];
      if (!sp || BACK_KINDS.has(sp.kind) || sp.kind === "floater") continue;
      drawPlant(ctx, p, p.x * W, this.groundAt(tank, p.x) * H, H, reduce ? 0 : t, { algae, highlight: selected === p ? "#ffffff" : this.mode === "trim" && p.g > 1.05 ? "rgba(255,255,255,0.7)" : null });
    }
    for (const o of sorted) if (o.s.z >= 0.3) drawOne(o);

    // food
    for (const p of this.food) {
      ctx.fillStyle = p.kind === "bloodworm" ? "#a8322a" : "#c98a3a";
      ctx.beginPath();
      if (p.kind === "bloodworm") ctx.ellipse(p.x * W, p.y * H, 3.5, 1.4, Math.sin(p.seed + t * 0.004), 0, TAU);
      else ctx.arc(p.x * W, p.y * H, 1.8, 0, TAU);
      ctx.fill();
    }
    // bubbles
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1;
    for (const b of this.bubbles) {
      ctx.beginPath();
      ctx.arc(b.x * W, b.y * H, b.r, 0, TAU);
      ctx.stroke();
    }
    // floaters at the surface
    for (const p of tank.plants) {
      const sp = plantById[p.sp];
      if (sp && sp.kind === "floater") drawPlant(ctx, p, p.x * W, SURFACE * H, H, reduce ? 0 : t, { surfaceY: SURFACE * H, highlight: selected === p ? "#ffffff" : null });
    }
    // light dancing just under the surface
    if (lit) {
      const pattern = ctx.createPattern(causticTexture(), "repeat");
      const drift = reduce ? 0 : t * 0.004;
      pattern.setTransform(new DOMMatrix().translate(-drift, SURFACE * H).scale(W / 700, (W / 700) * 0.22));
      const band = ctx.createLinearGradient(0, SURFACE * H, 0, SURFACE * H + H * 0.1);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = pattern;
      ctx.beginPath();
      ctx.rect(0, SURFACE * H, W, H * 0.08);
      ctx.fill();
      ctx.restore();
      band.addColorStop(0, "rgba(255,255,240,0.10)");
      band.addColorStop(1, "rgba(255,255,240,0)");
      ctx.fillStyle = band;
      ctx.fillRect(0, SURFACE * H, W, H * 0.1);
    }
    // surface and air gap
    ctx.fillStyle = "rgba(240,246,244,0.55)";
    ctx.fillRect(0, 0, W, SURFACE * H - 2);
    ctx.beginPath();
    ctx.moveTo(0, SURFACE * H);
    for (let x = 0; x <= W; x += 8) {
      ctx.lineTo(x, SURFACE * H + Math.sin(x * 0.03 + (reduce ? 0 : t * 0.002)) * 1.4);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // ripples
    for (const rp of this.ripples) {
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - rp.t / 0.9)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(rp.x * W, rp.y * H, 6 + rp.t * 50, (6 + rp.t * 50) * 0.5, 0, 0, TAU);
      ctx.stroke();
    }
    for (const sn of this.snips) {
      ctx.fillStyle = `rgba(143,194,79,${1 - sn.t / 1.2})`;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(sn.x * W + (k - 1.5) * 8 + sn.t * 10 * (k - 1.5), sn.y * H + sn.t * 30, 4, 2, k, 0, TAU);
        ctx.fill();
      }
    }

    // night and lights
    if (!lit) {
      ctx.fillStyle = `rgba(8,22,34,${0.38 + (1 - day) * 0.2})`;
      ctx.fillRect(0, 0, W, H);
      const moon = ctx.createLinearGradient(0, 0, W, H);
      moon.addColorStop(0, "rgba(160,200,220,0.10)");
      moon.addColorStop(1, "rgba(160,200,220,0)");
      ctx.fillStyle = moon;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.calm > 0) {
      ctx.fillStyle = `rgba(10,30,36,${this.calm * 0.22})`;
      ctx.fillRect(0, 0, W, H);
    }

    // glass dirt
    if (this.dirtDirty) {
      const dctx = this.dirtCanvas.getContext("2d");
      const img = dctx.createImageData(GRID.w, GRID.h);
      for (let i = 0; i < this.dirt.length; i++) {
        img.data[i * 4] = 112;
        img.data[i * 4 + 1] = 138;
        img.data[i * 4 + 2] = 72;
        img.data[i * 4 + 3] = Math.round(clamp(this.dirt[i], 0, 1) * 200);
      }
      dctx.putImageData(img, 0, 0);
      this.dirtDirty = false;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.dirtCanvas, 0, 0, W, H);

    // glass reflection and frame
    const refl = ctx.createLinearGradient(0, 0, W, H);
    refl.addColorStop(0, "rgba(255,255,255,0.10)");
    refl.addColorStop(0.3, "rgba(255,255,255,0)");
    refl.addColorStop(0.7, "rgba(255,255,255,0)");
    refl.addColorStop(1, "rgba(255,255,255,0.05)");
    ctx.fillStyle = refl;
    ctx.fillRect(0, 0, W, H);
    // diagonal streak on the front pane
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const streak = ctx.createLinearGradient(W * 0.62, 0, W * 0.78, H);
    streak.addColorStop(0, "rgba(255,255,255,0)");
    streak.addColorStop(0.5, "rgba(255,255,255,0.07)");
    streak.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = streak;
    ctx.beginPath();
    ctx.moveTo(W * 0.66, 0);
    ctx.lineTo(W * 0.72, 0);
    ctx.lineTo(W * 0.56, H);
    ctx.lineTo(W * 0.5, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // pane edges catch the light: thin bright verticals with a darker inner line
    const edge = Math.max(3, W * 0.006);
    for (const x of [0, W - edge]) {
      const eg = ctx.createLinearGradient(x, 0, x + edge, 0);
      eg.addColorStop(0, x === 0 ? "rgba(255,255,255,0.32)" : "rgba(0,20,24,0.25)");
      eg.addColorStop(1, x === 0 ? "rgba(0,20,24,0.25)" : "rgba(255,255,255,0.32)");
      ctx.fillStyle = eg;
      ctx.fillRect(x, 0, edge, H);
    }
    // lid rim across the top
    const rimH = Math.max(4, H * 0.022);
    const rim = ctx.createLinearGradient(0, 0, 0, rimH);
    rim.addColorStop(0, "#26302d");
    rim.addColorStop(0.7, "#3a4642");
    rim.addColorStop(1, "rgba(255,255,255,0.35)");
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, W, rimH);
    // inner shadow toward the frame so the water reads as a volume
    const iv = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    iv.addColorStop(0, "rgba(0,0,0,0)");
    iv.addColorStop(1, "rgba(0,16,20,0.22)");
    ctx.fillStyle = iv;
    ctx.fillRect(0, 0, W, H);

    // edit overlays
    if (this.mode === "scape" && this.scape.tool === "sculpt") {
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.setLineDash([2, 6]);
      ctx.beginPath();
      ctx.moveTo(0, (1 - 0.48) * H);
      ctx.lineTo(W, (1 - 0.48) * H);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (this.mode === "clean" && this.pointer.active) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.pointer.x * W, this.pointer.y * H, 0.06 * W, 0, TAU);
      ctx.stroke();
    }
    if ((this.mode === "feed" || this.mode === "scape") && this.pointer.active && this.scape.item && this.mode === "scape" && this.scape.tool === "place") {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(this.pointer.x * W, SURFACE * H);
      ctx.lineTo(this.pointer.x * W, H);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  snapshot() {
    return this.canvas.toDataURL("image/png");
  }
}

export { SURFACE, SAVE_VERSION };
