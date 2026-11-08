// Vector drawing for fish, plants, hardscape and corals on a 2D canvas.
import { fishById, plantById, hardById, coralColors } from "./sim.js";
import { rng, hashString, shade, rgba, mix, clamp, TAU } from "./util.js";

// ---------- Fish ----------
function bodyPath(ctx, L, H) {
  ctx.beginPath();
  ctx.moveTo(L * 0.5, 0);
  ctx.bezierCurveTo(L * 0.42, -H * 0.42, L * 0.05, -H * 0.55, -L * 0.22, -H * 0.36);
  ctx.quadraticCurveTo(-L * 0.36, -H * 0.2, -L * 0.4, -H * 0.1);
  ctx.lineTo(-L * 0.4, H * 0.1);
  ctx.quadraticCurveTo(-L * 0.36, H * 0.22, -L * 0.22, H * 0.38);
  ctx.bezierCurveTo(L * 0.05, H * 0.6, L * 0.42, H * 0.42, L * 0.5, 0);
  ctx.closePath();
}

function tailPath(ctx, type, L, H, sway) {
  const bx = -L * 0.38;
  ctx.save();
  ctx.translate(bx, 0);
  ctx.rotate(sway);
  ctx.beginPath();
  const t = H;
  switch (type) {
    case "fork":
      ctx.moveTo(0, -t * 0.08);
      ctx.quadraticCurveTo(-L * 0.12, -t * 0.25, -L * 0.24, -t * 0.42);
      ctx.quadraticCurveTo(-L * 0.17, -t * 0.08, -L * 0.13, 0);
      ctx.quadraticCurveTo(-L * 0.17, t * 0.08, -L * 0.24, t * 0.42);
      ctx.quadraticCurveTo(-L * 0.12, t * 0.25, 0, t * 0.08);
      break;
    case "lyre":
      ctx.moveTo(0, -t * 0.08);
      ctx.quadraticCurveTo(-L * 0.18, -t * 0.25, -L * 0.36, -t * 0.55);
      ctx.quadraticCurveTo(-L * 0.18, -t * 0.12, -L * 0.14, 0);
      ctx.quadraticCurveTo(-L * 0.18, t * 0.12, -L * 0.36, t * 0.55);
      ctx.quadraticCurveTo(-L * 0.18, t * 0.25, 0, t * 0.08);
      break;
    case "fan":
      ctx.moveTo(0, -t * 0.08);
      ctx.quadraticCurveTo(-L * 0.2, -t * 0.7, -L * 0.36, -t * 0.4);
      ctx.quadraticCurveTo(-L * 0.42, 0, -L * 0.36, t * 0.4);
      ctx.quadraticCurveTo(-L * 0.2, t * 0.7, 0, t * 0.08);
      break;
    case "veil":
      ctx.moveTo(0, -t * 0.1);
      ctx.bezierCurveTo(-L * 0.3, -t * 0.9, -L * 0.6, -t * 0.3, -L * 0.55, t * 0.2);
      ctx.bezierCurveTo(-L * 0.5, t * 0.7, -L * 0.25, t * 0.8, 0, t * 0.1);
      break;
    case "round":
      ctx.moveTo(0, -t * 0.1);
      ctx.quadraticCurveTo(-L * 0.24, -t * 0.42, -L * 0.24, 0);
      ctx.quadraticCurveTo(-L * 0.24, t * 0.42, 0, t * 0.1);
      break;
    default:
      ctx.moveTo(0, 0);
  }
  ctx.closePath();
  ctx.restore();
}

function dorsalPath(ctx, type, L, H, sway) {
  ctx.beginPath();
  const top = -H * 0.48;
  switch (type) {
    case "low":
      ctx.moveTo(L * 0.1, top + H * 0.05);
      ctx.quadraticCurveTo(-L * 0.02, top - H * 0.22, -L * 0.14, top + H * 0.1);
      break;
    case "tall":
      ctx.moveTo(L * 0.16, top + H * 0.04);
      ctx.quadraticCurveTo(L * 0.02, top - H * 0.55, -L * 0.12 + sway * L * 0.1, top - H * 0.2);
      ctx.lineTo(-L * 0.16, top + H * 0.14);
      break;
    case "sail":
      ctx.moveTo(L * 0.22, top + H * 0.04);
      ctx.bezierCurveTo(L * 0.1, top - H * 0.9, -L * 0.2, top - H * 0.8, -L * 0.3 + sway * L * 0.1, top - H * 0.1);
      ctx.lineTo(-L * 0.2, top + H * 0.16);
      break;
    default:
      return false;
  }
  ctx.closePath();
  return true;
}

function patternFill(ctx, pattern, L, H, colors, seed) {
  const [base, accent] = colors;
  if (pattern === "gradient") {
    const g = ctx.createLinearGradient(L * 0.5, 0, -L * 0.4, 0);
    g.addColorStop(0, base);
    g.addColorStop(1, accent);
    ctx.fillStyle = g;
    ctx.fillRect(-L, -H, L * 2, H * 2);
    return;
  }
  ctx.fillStyle = base;
  ctx.fillRect(-L, -H, L * 2, H * 2);
  ctx.fillStyle = accent;
  const r = rng(seed);
  switch (pattern) {
    case "stripeH":
      ctx.fillRect(-L * 0.42, -H * 0.12, L * 0.86, H * 0.16);
      break;
    case "stripeV":
      for (let i = 0; i < 4; i++) {
        const x = L * 0.3 - i * L * 0.2;
        ctx.fillRect(x - L * 0.04, -H, L * 0.07, H * 2);
      }
      break;
    case "band":
      for (let i = 0; i < 3; i++) {
        const x = L * 0.28 - i * L * 0.27;
        ctx.beginPath();
        ctx.ellipse(x, 0, L * 0.055, H * 0.7, 0, 0, TAU);
        ctx.fill();
      }
      break;
    case "spots":
      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.arc((r() - 0.55) * L * 0.85, (r() - 0.5) * H * 0.8, L * (0.018 + r() * 0.02), 0, TAU);
        ctx.fill();
      }
      break;
    case "calico":
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.ellipse((r() - 0.5) * L * 0.8, (r() - 0.6) * H * 0.7, L * (0.06 + r() * 0.08), H * (0.12 + r() * 0.14), r() * 3, 0, TAU);
        ctx.fill();
      }
      break;
    case "wedge":
      ctx.beginPath();
      ctx.moveTo(L * 0.05, -H * 0.1);
      ctx.lineTo(-L * 0.4, -H * 0.2);
      ctx.lineTo(-L * 0.4, H * 0.12);
      ctx.closePath();
      ctx.fill();
      break;
  }
}

export function drawFish(ctx, fish, x, y, L, dir, phase, opts = {}) {
  const sp = fishById[fish.sp];
  if (!sp) return;
  const colors = fish.colors || sp.colors;
  if (sp.body === "shrimp") return drawShrimp(ctx, colors, x, y, L, dir, phase, opts);
  if (sp.body === "snail") return drawSnail(ctx, colors, x, y, L, dir, phase, opts);
  const H = L * sp.h;
  const sway = Math.sin(phase) * (opts.sleeping ? 0.08 : 0.28);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  if (opts.tilt) ctx.rotate(opts.tilt);
  ctx.globalAlpha = opts.alpha ?? 1;
  const finColor = rgba(colors[2] || colors[0], 0.78);

  // tail
  tailPath(ctx, sp.tail, L, H, sway);
  ctx.fillStyle = finColor;
  ctx.fill();
  // dorsal
  if (dorsalPath(ctx, sp.dorsal, L, H, sway)) {
    ctx.fillStyle = finColor;
    ctx.fill();
  }
  // anal / pelvic fin
  ctx.beginPath();
  ctx.moveTo(-L * 0.02, H * 0.44);
  ctx.quadraticCurveTo(-L * 0.12, H * (sp.tail === "veil" ? 0.95 : 0.66), -L * 0.24, H * 0.32);
  ctx.closePath();
  ctx.fillStyle = finColor;
  ctx.fill();

  // body with pattern
  ctx.save();
  bodyPath(ctx, L, H);
  ctx.clip();
  patternFill(ctx, sp.pattern, L, H, colors, hashString(fish.id || fish.sp));
  // soft shading: darker back, lighter belly
  const sh = ctx.createLinearGradient(0, -H * 0.5, 0, H * 0.5);
  sh.addColorStop(0, "rgba(10,25,25,0.28)");
  sh.addColorStop(0.55, "rgba(255,255,255,0)");
  sh.addColorStop(1, "rgba(255,255,255,0.22)");
  ctx.fillStyle = sh;
  ctx.fillRect(-L, -H, L * 2, H * 2);
  if (fish.golden) {
    const t = (performance.now() / 1400) % 1;
    const gx = L * (0.7 - t * 1.6);
    const gl = ctx.createLinearGradient(gx - L * 0.15, -H, gx + L * 0.15, H);
    gl.addColorStop(0, "rgba(255,250,220,0)");
    gl.addColorStop(0.5, "rgba(255,250,220,0.55)");
    gl.addColorStop(1, "rgba(255,250,220,0)");
    ctx.fillStyle = gl;
    ctx.fillRect(-L, -H, L * 2, H * 2);
  }
  ctx.restore();
  // outline for legibility on any background
  bodyPath(ctx, L, H);
  ctx.strokeStyle = "rgba(15,30,30,0.28)";
  ctx.lineWidth = Math.max(0.6, L * 0.012);
  ctx.stroke();
  // gill line
  ctx.beginPath();
  ctx.arc(L * 0.3, 0, H * 0.32, -0.9, 0.9);
  ctx.strokeStyle = "rgba(15,30,30,0.18)";
  ctx.stroke();
  // pectoral fin
  ctx.beginPath();
  ctx.ellipse(L * 0.18, H * 0.1, L * 0.08, H * 0.08, 0.6 + sway, 0, TAU);
  ctx.fillStyle = finColor;
  ctx.fill();
  // eye
  const ex = L * 0.36;
  const ey = -H * 0.08;
  const er = Math.max(1.2, L * 0.045);
  ctx.beginPath();
  ctx.arc(ex, ey, er, 0, TAU);
  ctx.fillStyle = "#f4f1ea";
  ctx.fill();
  ctx.beginPath();
  if (opts.sleeping) {
    ctx.moveTo(ex - er * 0.8, ey);
    ctx.lineTo(ex + er * 0.8, ey);
    ctx.strokeStyle = "#1b2422";
    ctx.lineWidth = Math.max(0.8, er * 0.4);
    ctx.stroke();
  } else {
    ctx.arc(ex + er * 0.15, ey, er * 0.62, 0, TAU);
    ctx.fillStyle = "#1b2422";
    ctx.fill();
  }
  ctx.restore();
}

function drawShrimp(ctx, colors, x, y, L, dir, phase, opts) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.globalAlpha = opts.alpha ?? 1;
  const seg = 6;
  ctx.lineCap = "round";
  for (let i = 0; i < seg; i++) {
    const t = i / (seg - 1);
    const px = L * 0.35 - t * L * 0.7;
    const py = -Math.sin(t * Math.PI) * L * 0.18 + t * L * 0.1;
    ctx.beginPath();
    ctx.ellipse(px, py, L * 0.12 * (1 - t * 0.4), L * 0.12 * (1 - t * 0.35), 0, 0, TAU);
    ctx.fillStyle = mix(colors[0], colors[1], t * 0.6);
    ctx.fill();
  }
  // tail fan
  ctx.beginPath();
  ctx.moveTo(-L * 0.36, L * 0.1);
  ctx.lineTo(-L * 0.52, L * 0.02 + Math.sin(phase) * L * 0.03);
  ctx.lineTo(-L * 0.5, L * 0.2);
  ctx.closePath();
  ctx.fillStyle = colors[0];
  ctx.fill();
  // legs
  ctx.strokeStyle = rgba(colors[0], 0.8);
  ctx.lineWidth = Math.max(0.6, L * 0.02);
  for (let i = 0; i < 5; i++) {
    const lx = L * 0.25 - i * L * 0.12;
    ctx.beginPath();
    ctx.moveTo(lx, L * 0.04);
    ctx.lineTo(lx + Math.sin(phase * 2 + i) * L * 0.04, L * 0.18);
    ctx.stroke();
  }
  // antennae
  ctx.beginPath();
  ctx.moveTo(L * 0.42, -L * 0.04);
  ctx.quadraticCurveTo(L * 0.8, -L * 0.3, L * 0.95, -L * 0.1 + Math.sin(phase) * L * 0.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(L * 0.4, -L * 0.06, Math.max(1, L * 0.035), 0, TAU);
  ctx.fillStyle = "#1b2422";
  ctx.fill();
  ctx.restore();
}

function drawSnail(ctx, colors, x, y, L, dir, phase, opts) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.globalAlpha = opts.alpha ?? 1;
  // foot
  ctx.beginPath();
  ctx.ellipse(L * 0.05, L * 0.18, L * 0.45, L * 0.1, 0, 0, TAU);
  ctx.fillStyle = colors[2];
  ctx.fill();
  // shell
  ctx.beginPath();
  ctx.arc(-L * 0.02, -L * 0.02, L * 0.3, 0, TAU);
  ctx.fillStyle = colors[0];
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = colors[1];
  ctx.lineWidth = Math.max(0.8, L * 0.035);
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * L * 0.1, -L * 0.4);
    ctx.quadraticCurveTo(i * L * 0.1 + L * 0.08, 0, i * L * 0.1, L * 0.4);
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(-L * 0.02, -L * 0.02, L * 0.3, 0, TAU);
  ctx.strokeStyle = "rgba(15,30,30,0.3)";
  ctx.lineWidth = Math.max(0.6, L * 0.015);
  ctx.stroke();
  // eye stalks
  ctx.strokeStyle = colors[2];
  ctx.beginPath();
  ctx.moveTo(L * 0.4, L * 0.12);
  ctx.lineTo(L * 0.5, -L * 0.04 + Math.sin(phase) * L * 0.02);
  ctx.stroke();
  ctx.restore();
}

// ---------- Plants ----------
export function drawPlant(ctx, plant, x, groundY, H, time, opts = {}) {
  const sp = plantById[plant.sp];
  if (!sp) return;
  const r = rng(hashString(plant.id || plant.sp));
  const g = clamp(plant.g, 0.05, 1.6);
  let c1 = sp.leaf;
  let c2 = sp.leaf2;
  if (plant.v) {
    c1 = mix(sp.leaf, "#f1ecd8", 0.45);
    c2 = mix(sp.leaf2, "#e8dfb8", 0.35);
  }
  const algae = opts.algae || 0;
  if (algae > 0.2) {
    c1 = mix(c1, "#6f7f3a", (algae - 0.2) * 0.5);
    c2 = mix(c2, "#5f6f30", (algae - 0.2) * 0.5);
  }
  const sway = (yy, k = 1) => Math.sin(time * 0.0012 + x * 0.02 + yy * 0.015) * k;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (sp.kind) {
    case "stem": {
      const stems = 3;
      for (let s = 0; s < stems; s++) {
        const sx = x + (s - 1) * H * 0.018 + (r() - 0.5) * H * 0.01;
        const height = H * (0.22 + g * 0.42) * (0.85 + r() * 0.3);
        const nodes = Math.max(3, Math.round(height / (H * 0.035)));
        let px = sx;
        let py = groundY;
        for (let i = 1; i <= nodes; i++) {
          const t = i / nodes;
          const nx = sx + sway(i * 10, H * 0.03 * t * t);
          const ny = groundY - height * t;
          ctx.strokeStyle = mix(c2, "#3a4a2a", 0.3);
          ctx.lineWidth = Math.max(1, H * 0.004);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(nx, ny);
          ctx.stroke();
          const leafLen = H * (sp.broad ? 0.028 : 0.034) * (1 - t * 0.3);
          const leafW = sp.broad ? leafLen * 0.55 : leafLen * 0.22;
          const col = mix(c2, c1, t);
          ctx.fillStyle = col;
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(nx + side * leafLen * 0.5, ny + leafLen * 0.1, leafLen * 0.5, leafW * 0.5, side * -0.5, 0, TAU);
            ctx.fill();
          }
          px = nx;
          py = ny;
        }
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.arc(px, py, H * 0.012, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "grass": {
      const blades = sp.tall ? 9 : 16;
      const maxH = sp.tall ? H * (0.3 + g * 0.42) : H * (0.05 + g * 0.08);
      for (let i = 0; i < blades; i++) {
        const bx = x + (r() - 0.5) * H * (sp.tall ? 0.06 : 0.1);
        const bh = maxH * (0.6 + r() * 0.4);
        const tipx = bx + sway(i * 5, H * (sp.tall ? 0.05 : 0.008)) + (r() - 0.5) * H * 0.02;
        ctx.strokeStyle = mix(c2, c1, r());
        ctx.lineWidth = Math.max(1, H * (sp.tall ? 0.008 : 0.0035));
        ctx.beginPath();
        ctx.moveTo(bx, groundY);
        ctx.quadraticCurveTo(bx + (tipx - bx) * 0.3, groundY - bh * 0.6, tipx, groundY - bh);
        ctx.stroke();
      }
      break;
    }
    case "sword": {
      const leaves = 9;
      for (let i = 0; i < leaves; i++) {
        const a = -Math.PI / 2 + (i / (leaves - 1) - 0.5) * 1.6;
        const len = H * (0.16 + g * 0.2) * (0.75 + r() * 0.35);
        const tx = x + Math.cos(a) * len + sway(i, H * 0.015);
        const ty = groundY + Math.sin(a) * len;
        const mx = x + Math.cos(a) * len * 0.5;
        const my = groundY + Math.sin(a) * len * 0.5;
        const nx = -Math.sin(a) * len * 0.12;
        const ny = Math.cos(a) * len * 0.12;
        ctx.fillStyle = mix(c2, c1, i / leaves);
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.quadraticCurveTo(mx + nx, my + ny, tx, ty);
        ctx.quadraticCurveTo(mx - nx, my - ny, x, groundY);
        ctx.fill();
        ctx.strokeStyle = rgba("#ffffff", 0.18);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
      break;
    }
    case "rosette": {
      const leaves = 7;
      for (let i = 0; i < leaves; i++) {
        const a = -Math.PI / 2 + (i / (leaves - 1) - 0.5) * 2;
        const len = H * (0.06 + g * 0.08) * (0.8 + r() * 0.3);
        const tx = x + Math.cos(a) * len + sway(i, H * 0.006);
        const ty = groundY + Math.sin(a) * len;
        ctx.fillStyle = i % 2 ? c1 : c2;
        ctx.beginPath();
        ctx.ellipse((x + tx) / 2, (groundY + ty) / 2, len * 0.55, len * 0.22, a, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "epiphyte": {
      const leaves = sp.small ? 5 : 7;
      const size = H * (sp.small ? 0.035 : sp.broad ? 0.05 : 0.07) * (0.7 + g * 0.5);
      for (let i = 0; i < leaves; i++) {
        const a = -Math.PI / 2 + (i / (leaves - 1) - 0.5) * 2.2;
        const len = size * (0.8 + r() * 0.5);
        const tx = x + Math.cos(a) * len + sway(i, H * 0.004);
        const ty = groundY + Math.sin(a) * len;
        ctx.fillStyle = mix(c2, c1, r());
        ctx.beginPath();
        ctx.ellipse((x + tx) / 2, (groundY + ty) / 2, len * 0.55, len * (sp.broad ? 0.32 : 0.16), a, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = rgba("#ffffff", 0.15);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
      break;
    }
    case "carpet": {
      const width = H * (0.06 + g * 0.08);
      const count = Math.round(14 + g * 18);
      for (let i = 0; i < count; i++) {
        const lx = x + (r() - 0.5) * width * 2;
        const ly = groundY - r() * H * 0.025 * g;
        ctx.fillStyle = mix(c2, c1, r());
        ctx.beginPath();
        ctx.arc(lx, ly, H * (0.006 + r() * 0.005), 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "moss": {
      const width = H * (0.04 + g * 0.05);
      for (let i = 0; i < 26; i++) {
        const lx = x + (r() - 0.5) * width * 2;
        const ly = groundY - r() * H * 0.04 * g;
        ctx.fillStyle = mix(c2, c1, r());
        ctx.beginPath();
        ctx.arc(lx, ly, H * (0.008 + r() * 0.008), 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "floater": {
      const surface = opts.surfaceY ?? H * 0.08;
      const count = Math.round(2 + g * 3);
      for (let i = 0; i < count; i++) {
        const fx = x + (i - count / 2) * H * 0.035 + sway(i, H * 0.01);
        ctx.strokeStyle = rgba("#d9cfb8", 0.55);
        ctx.lineWidth = 0.8;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.moveTo(fx + (k - 1.5) * 2, surface + H * 0.008);
          ctx.quadraticCurveTo(fx + (k - 1.5) * 3 + sway(k, 3), surface + H * 0.05, fx + (k - 1.5) * 2, surface + H * (0.05 + r() * 0.05));
          ctx.stroke();
        }
        ctx.fillStyle = mix(c2, c1, r());
        ctx.beginPath();
        ctx.ellipse(fx, surface, H * (sp.small ? 0.012 : 0.022), H * 0.008, 0, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "ball": {
      const rad = H * (0.02 + g * 0.018);
      const gr = ctx.createRadialGradient(x - rad * 0.3, groundY - rad * 1.3, rad * 0.2, x, groundY - rad, rad);
      gr.addColorStop(0, shade(c1, 0.15));
      gr.addColorStop(1, c2);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(x, groundY - rad, rad, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(c1, 0.6);
      for (let i = 0; i < 18; i++) {
        const a = r() * TAU;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * rad * 0.9, groundY - rad + Math.sin(a) * rad * 0.9, rad * 0.1, 0, TAU);
        ctx.fill();
      }
      break;
    }
  }
  if (opts.highlight) {
    ctx.strokeStyle = opts.highlight;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, groundY - H * 0.06, H * 0.07, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- Hardscape ----------
export function stoneShape(id, w, h) {
  const r = rng(hashString(id));
  const pts = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = Math.PI + t * Math.PI; // upper half-ellipse
    const rr = 0.78 + r() * 0.3;
    pts.push([Math.cos(a) * w * 0.5 * rr, Math.sin(a) * h * rr]);
  }
  return pts;
}

export function drawHardscape(ctx, item, x, groundY, H, opts = {}) {
  const def = hardById[item.kind];
  if (!def) return;
  const s = item.s || 1;
  ctx.save();
  ctx.translate(x, groundY + H * 0.02);
  if (item.flip) ctx.scale(-1, 1);
  const algae = opts.algae || 0;
  const c1 = algae > 0.25 ? mix(def.color, "#5f7a3a", (algae - 0.25) * 0.6) : def.color;
  const c2 = def.color2;
  if (def.kind === "stone") {
    const w = H * 0.26 * s * (def.round ? 0.8 : 1);
    const h = H * 0.2 * s * (def.round ? 0.6 : 1);
    const pts = stoneShape(item.id, w, h);
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, 0);
    for (const [px, py] of pts) ctx.lineTo(px, py);
    ctx.lineTo(w * 0.5, 0);
    ctx.closePath();
    const gr = ctx.createLinearGradient(-w * 0.4, -h, w * 0.3, 0);
    gr.addColorStop(0, shade(c1, 0.18));
    gr.addColorStop(0.6, c1);
    gr.addColorStop(1, c2);
    ctx.fillStyle = gr;
    ctx.fill();
    // facets
    const r = rng(hashString(item.id + "f"));
    ctx.strokeStyle = rgba(c2, 0.55);
    ctx.lineWidth = Math.max(1, H * 0.003);
    for (let i = 0; i < (def.rough ? 7 : 3); i++) {
      const fx = (r() - 0.5) * w * 0.7;
      const fy = -r() * h * 0.8;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + (r() - 0.3) * w * 0.25, fy + h * (0.1 + r() * 0.3));
      ctx.stroke();
    }
    if (def.rough) {
      ctx.fillStyle = rgba(c2, 0.5);
      for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.arc((r() - 0.5) * w * 0.8, -r() * h * 0.85, H * 0.004, 0, TAU);
        ctx.fill();
      }
    }
  } else {
    // driftwood: trunk with seeded branches
    const r = rng(hashString(item.id));
    const len = H * 0.5 * s;
    const branch = (bx, by, angle, length, width, depth) => {
      const ex = bx + Math.cos(angle) * length;
      const ey = by + Math.sin(angle) * length;
      const cx = bx + Math.cos(angle + 0.3) * length * 0.5;
      const cy = by + Math.sin(angle + 0.3) * length * 0.5;
      ctx.strokeStyle = depth === 0 ? c2 : mix(c1, c2, 0.3 + depth * 0.1);
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(cx, cy, ex, ey);
      ctx.stroke();
      ctx.strokeStyle = rgba(shade(c1, 0.25), 0.6);
      ctx.lineWidth = width * 0.3;
      ctx.beginPath();
      ctx.moveTo(bx, by - width * 0.2);
      ctx.quadraticCurveTo(cx, cy - width * 0.2, ex, ey - width * 0.2);
      ctx.stroke();
      if (depth < 3 && width > 1.2) {
        const kids = def.low ? 1 : 2;
        for (let k = 0; k < kids; k++) {
          branch(ex, ey, angle + (r() - 0.5) * 1.3 - 0.15, length * (0.5 + r() * 0.25), width * 0.6, depth + 1);
        }
      }
    };
    ctx.lineCap = "round";
    const baseAngle = def.low ? -0.35 : -1.05;
    branch(-len * 0.25, 0, baseAngle, len * (def.low ? 0.55 : 0.45), H * 0.03 * s, 0);
    branch(-len * 0.1, 0, baseAngle - 0.5, len * 0.3, H * 0.02 * s, 1);
  }
  if (opts.highlight) {
    ctx.strokeStyle = opts.highlight;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(-H * 0.15 * s, -H * 0.24 * s, H * 0.3 * s, H * 0.25 * s);
  }
  ctx.restore();
}

// ---------- Corals ----------
export function drawCoral(ctx, coral, x, y, size, time, opts = {}) {
  const g = coral.genes;
  const [c1, c2] = coralColors(g);
  const growth = clamp(coral.g ?? 0.6, 0.15, 1.4);
  const S = size * (0.5 + growth * 0.5);
  const r = rng(hashString(coral.id || coral.name || "c"));
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = "round";
  const tipColor = (t) => {
    if (g.pat === "tips") return t > 0.7 ? c2 : c1;
    if (g.pat === "rings") return Math.floor(t * 5) % 2 ? c2 : c1;
    return mix(c1, c2, t);
  };
  switch (g.form) {
    case "branch": {
      const grow = (bx, by, a, len, w, d) => {
        const ex = bx + Math.cos(a) * len;
        const ey = by + Math.sin(a) * len;
        ctx.strokeStyle = tipColor(d / 4);
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        if (d < 4) {
          grow(ex, ey, a - 0.35 - r() * 0.2, len * 0.75, w * 0.75, d + 1);
          if (r() < g.dens + 0.2) grow(ex, ey, a + 0.35 + r() * 0.2, len * 0.72, w * 0.72, d + 1);
        } else {
          ctx.fillStyle = c2;
          ctx.beginPath();
          ctx.arc(ex, ey, w * 0.7, 0, TAU);
          ctx.fill();
        }
      };
      grow(0, 0, -Math.PI / 2, S * 0.32, S * 0.08, 0);
      break;
    }
    case "brain": {
      const rad = S * 0.42;
      const gr = ctx.createRadialGradient(-rad * 0.3, -rad * 0.6, rad * 0.1, 0, -rad * 0.3, rad);
      gr.addColorStop(0, shade(c1, 0.2));
      gr.addColorStop(1, c1);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(0, 0, rad, rad * 0.8, 0, Math.PI, TAU);
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = c2;
      ctx.lineWidth = Math.max(1, S * 0.025);
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        let px = -rad;
        ctx.moveTo(px, -i * rad * 0.14);
        for (let k = 0; k < 10; k++) {
          px += rad * 0.22;
          ctx.lineTo(px, -i * rad * 0.14 + Math.sin(k * 1.7 + i) * rad * 0.06);
        }
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case "mushroom": {
      for (let i = 0; i < 3 + Math.round(g.dens * 3); i++) {
        const mx = (r() - 0.5) * S * 0.6;
        const my = -r() * S * 0.3;
        const mr = S * (0.12 + r() * 0.08);
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.ellipse(mx, my, mr, mr * 0.45, (r() - 0.5) * 0.6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = c2;
        if (g.pat === "speckle" || g.pat === "rings") {
          for (let k = 0; k < 6; k++) {
            ctx.beginPath();
            ctx.arc(mx + (r() - 0.5) * mr * 1.2, my + (r() - 0.5) * mr * 0.5, mr * 0.08, 0, TAU);
            ctx.fill();
          }
        } else {
          ctx.beginPath();
          ctx.arc(mx, my, mr * 0.18, 0, TAU);
          ctx.fill();
        }
      }
      break;
    }
    case "zoa": {
      const n = 8 + Math.round(g.dens * 10);
      for (let i = 0; i < n; i++) {
        const px = (r() - 0.5) * S * 0.7;
        const py = -r() * S * 0.25;
        const pr = S * 0.05 * (0.8 + Math.sin(time * 0.002 + i) * 0.08);
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, TAU);
        ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.arc(px, py, pr * 0.45, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "torch": {
      const n = 3 + Math.round(g.dens * 3);
      for (let i = 0; i < n; i++) {
        const bx = (i - (n - 1) / 2) * S * 0.12;
        const top = -S * (0.35 + r() * 0.15);
        ctx.strokeStyle = shade(c1, -0.2);
        ctx.lineWidth = S * 0.045;
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx, top);
        ctx.stroke();
        for (let k = 0; k < 9; k++) {
          const a = -Math.PI / 2 + (k / 8 - 0.5) * 2.4 + Math.sin(time * 0.0015 + k + i) * 0.12;
          const tl = S * 0.14;
          const tx = bx + Math.cos(a) * tl;
          const ty = top + Math.sin(a) * tl;
          ctx.strokeStyle = c1;
          ctx.lineWidth = S * 0.022;
          ctx.beginPath();
          ctx.moveTo(bx, top);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.fillStyle = c2;
          ctx.beginPath();
          ctx.arc(tx, ty, S * 0.018, 0, TAU);
          ctx.fill();
        }
      }
      break;
    }
    default: {
      // leather: lobed cap
      ctx.fillStyle = shade(c1, -0.15);
      ctx.fillRect(-S * 0.05, -S * 0.25, S * 0.1, S * 0.25);
      ctx.fillStyle = c1;
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) {
        const a = Math.PI + (i / 5) * Math.PI;
        const lr = S * (0.28 + (i % 2) * 0.05);
        const px = Math.cos(a) * lr;
        const py = -S * 0.25 + Math.sin(a) * lr * 0.5;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = c2;
      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.arc((r() - 0.5) * S * 0.45, -S * 0.25 - r() * S * 0.12, S * 0.012, 0, TAU);
        ctx.fill();
      }
    }
  }
  if (g.glow > 0.6 && opts.night) {
    ctx.globalCompositeOperation = "lighter";
    const gl = ctx.createRadialGradient(0, -S * 0.2, 0, 0, -S * 0.2, S * 0.5);
    gl.addColorStop(0, rgba(c2, 0.25 * g.glow));
    gl.addColorStop(1, rgba(c2, 0));
    ctx.fillStyle = gl;
    ctx.fillRect(-S, -S, S * 2, S * 1.2);
  }
  ctx.restore();
}

// Draw a fish centred in a small canvas (cards, journal).
export function fishThumb(canvas, fish, opts = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  const sp = fishById[fish.sp];
  const L = Math.min(w * 0.62, h * 0.8 / Math.max(0.4, sp.h * 1.6));
  if (opts.silhouette) {
    ctx.globalAlpha = 1;
    drawFish(ctx, { ...fish, colors: ["#9aa5a2", "#9aa5a2", "#9aa5a2"], golden: false }, w * 0.52, h * 0.52, L, 1, 0.6, {});
    return;
  }
  drawFish(ctx, fish, w * 0.54, h * 0.52, L, 1, opts.phase ?? 0.6, {});
}
