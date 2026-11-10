// Vector drawing for fish, plants, hardscape and corals on a 2D canvas.
import { fishById, plantById, hardById, coralColors } from "./sim.js";
import { rng, hashString, shade, rgba, mix, clamp, TAU } from "./util.js";

// ---------- Fish ----------
// Each species gets a body form so the tank reads like a field guide rather than one fish in many colours.
// nose 0 = pointed .. 1 = blunt; crown = x of the highest point of the back; back/belly scale the
// profile; ped = tail-stalk half height; mouth = nose height (negative = upturned); eye = eye scale.
const FORM_DEFAULT = { nose: 0.5, crown: 0.05, back: 1, belly: 1, bellyX: 0.02, ped: 0.13, mouth: 0, eye: 1, flat: false, fx: [] };
const CLEAR_FIN = "rgba(226,236,232,0.42)";
const FORMS = {
  guppy: { nose: 0.45, back: 0.9, belly: 1.12, ped: 0.15, mouth: -0.04, tail: "delta", fx: ["rays"] },
  neon: { nose: 0.35, crown: 0.1, back: 0.95, ped: 0.14, eye: 1.4, fin: CLEAR_FIN, fx: ["adipose", "neonRed", "glow"] },
  cardinal: { nose: 0.35, crown: 0.1, back: 0.95, ped: 0.14, eye: 1.4, fin: CLEAR_FIN, fx: ["adipose", "redFull", "glow"] },
  ember: { nose: 0.4, crown: 0.08, ped: 0.13, eye: 1.35, fin: "rgba(240,140,90,0.5)", fx: ["adipose"] },
  cherrybarb: { nose: 0.55, crown: 0.02, back: 1.05, belly: 1.05, ped: 0.14, fx: ["barbels", "rays"] },
  harlequin: { nose: 0.4, crown: 0.06, back: 1.05, belly: 1.1, ped: 0.13, fin: "rgba(232,150,110,0.55)", fx: [] },
  chili: { nose: 0.4, crown: 0.06, ped: 0.13, eye: 1.4, fin: "rgba(232,120,90,0.45)", fx: [] },
  cory: { nose: 0.9, crown: -0.02, back: 1.15, belly: 0.75, ped: 0.17, mouth: 0.26, eye: 1.25, flat: true, fx: ["barbels", "scutes", "adipose"] },
  pandacory: { nose: 0.9, crown: -0.02, back: 1.15, belly: 0.75, ped: 0.17, mouth: 0.26, eye: 1.25, flat: true, fx: ["barbels", "scutes", "adipose", "mask"] },
  oto: { nose: 0.7, crown: -0.05, back: 0.9, belly: 0.7, ped: 0.16, mouth: 0.22, flat: true, fin: CLEAR_FIN, fx: ["scutes"] },
  kuhli: { nose: 0.85, crown: 0, back: 1, belly: 1, ped: 0.34, mouth: 0.12, eye: 0.9, fx: ["barbels"] },
  betta: { nose: 0.55, crown: 0.02, back: 0.95, belly: 1.05, ped: 0.18, mouth: -0.1, fx: ["longAnal", "pelvicLong", "rays"] },
  channoides: { nose: 0.6, back: 0.95, ped: 0.18, mouth: -0.08, fx: ["longAnal"] },
  dwarfgourami: { nose: 0.45, crown: 0.02, back: 1, belly: 1.05, ped: 0.13, mouth: -0.12, fx: ["feelers", "longAnal"] },
  pearlgourami: { nose: 0.45, crown: 0.0, ped: 0.13, mouth: -0.12, fx: ["feelers", "longAnal", "lateral"] },
  honeygourami: { nose: 0.5, crown: 0.0, ped: 0.13, mouth: -0.12, fx: ["feelers", "longAnal"] },
  medaka: { nose: 0.4, crown: -0.12, back: 0.72, belly: 1.05, ped: 0.15, mouth: -0.14, eye: 1.45, fin: CLEAR_FIN, fx: ["longAnal"] },
  whitecloud: { nose: 0.45, crown: 0.0, ped: 0.13, fx: ["rays"] },
  zebra: { nose: 0.4, crown: 0.02, ped: 0.13, fx: ["multiStripe", "barbels"] },
  cpd: { nose: 0.45, ped: 0.13, eye: 1.2, fx: ["rays"] },
  rainbow: { nose: 0.4, crown: 0.04, back: 1.05, ped: 0.13, fx: ["twoDorsal", "rays"] },
  angel: { nose: 0.25, crown: 0.06, back: 1, belly: 1, ped: 0.1, dorsal: "none", fx: ["angelFins", "feelers"] },
  discus: { nose: 0.95, crown: 0.0, back: 1, belly: 1, ped: 0.1, eye: 0.9, dorsal: "none", fx: ["fringe"] },
  goldfish: { nose: 0.85, crown: 0.06, back: 1.15, belly: 1.15, ped: 0.13, fx: ["scales", "doubleTail"] },
  koi: { nose: 0.7, crown: 0.0, back: 1.05, ped: 0.15, mouth: 0.06, fx: ["scales", "barbels"] },
  char: { nose: 0.45, crown: 0.0, ped: 0.15, mouth: 0.04, fx: ["adipose", "lateral", "whiteEdge"] },
  brooktrout: { nose: 0.45, crown: 0.0, ped: 0.15, mouth: 0.04, fx: ["adipose", "lateral", "whiteEdge"] },
  grayling: { nose: 0.4, crown: 0.06, ped: 0.14, fx: ["adipose", "lateral", "rays"] },
  arowana: { nose: 0.15, crown: -0.15, back: 0.62, belly: 1.15, bellyX: -0.08, ped: 0.16, mouth: -0.3, fx: ["scales", "chinBarbels", "rearFins"] },
  archer: { nose: 0.12, crown: -0.1, back: 0.55, belly: 1.3, bellyX: -0.04, ped: 0.13, mouth: -0.22, eye: 1.35, fx: ["rearFins"] },
  bumblebee: { nose: 0.9, crown: -0.05, back: 0.95, belly: 0.95, ped: 0.2, eye: 1.2, dorsal: "low", fx: ["twoDorsal"] },
  mono: { nose: 0.35, crown: 0.05, ped: 0.11, dorsal: "none", fx: ["triFins"] },
  puffer: { nose: 0.95, crown: -0.02, back: 1.1, belly: 1.2, ped: 0.15, eye: 1.6, fx: ["smallFins"] },
  clown: { nose: 0.8, crown: 0.02, ped: 0.15, fx: ["bandEdge", "finEdge"] },
  anthias: { nose: 0.45, crown: 0.06, ped: 0.13, eye: 1.2, fx: ["dorsalFilament", "rays"] },
  damsel: { nose: 0.6, crown: 0.04, ped: 0.13, fx: ["rays"] },
  bluetang: { nose: 0.65, crown: 0.04, back: 1.05, belly: 1.05, ped: 0.11, eye: 1.1, fx: ["scalpel", "finEdge"] },
  yellowtang: { nose: 0.15, crown: 0.06, ped: 0.1, mouth: 0.04, dorsal: "none", fx: ["triFins", "scalpel"] },
  firefish: { nose: 0.7, crown: 0.0, ped: 0.18, eye: 1.3, fx: ["dorsalFilament"] },
  banggai: { nose: 0.55, crown: 0.06, ped: 0.11, eye: 1.3, fx: ["twoDorsal", "longAnal", "rays"] },
  flyingfish: { nose: 0.45, crown: 0.0, ped: 0.13, fx: ["wings"] },
  idol: { nose: 0.05, crown: 0.06, ped: 0.1, mouth: 0.02, dorsal: "none", fx: ["triFins", "dorsalFilament"] },
  lionfish: { nose: 0.6, crown: 0.06, ped: 0.14, dorsal: "none", fx: ["spines", "fans"] },
  mandarin: { nose: 0.85, crown: 0.0, back: 0.95, belly: 1.05, ped: 0.16, eye: 1.25, fx: ["twoDorsal"] },
  coelacanth: { nose: 0.8, crown: 0.0, back: 1.05, belly: 1.05, ped: 0.18, eye: 1.2, fx: ["lobes", "scales"] },
};

export function fishForm(spId) {
  const f = FORMS[spId] || {};
  return { ...FORM_DEFAULT, ...f, fx: f.fx || [] };
}

function bodyPath(ctx, L, H, f) {
  const nx = L * 0.5;
  const ny = H * f.mouth;
  const cx = L * f.crown;
  const cy = -H * 0.5 * f.back;
  const bx = L * f.bellyX;
  const by = H * 0.5 * f.belly;
  const px = -L * 0.4;
  const pt = H * f.ped;
  const blunt = f.nose;
  ctx.beginPath();
  ctx.moveTo(nx, ny);
  ctx.bezierCurveTo(
    nx - L * (0.03 + 0.02 * blunt), ny - H * (0.1 + 0.42 * blunt) * f.back,
    cx + L * (0.1 + 0.16 * (1 - blunt)), cy,
    cx, cy,
  );
  ctx.bezierCurveTo(cx - L * 0.22, cy, px + L * 0.16, -pt * 1.15, px, -pt);
  ctx.lineTo(px, pt);
  if (f.flat) {
    ctx.bezierCurveTo(px + L * 0.12, pt * 1.3, bx - L * 0.3, by, bx, by);
    ctx.bezierCurveTo(bx + L * 0.28, by, nx - L * 0.04, ny + H * 0.12, nx, ny);
  } else {
    ctx.bezierCurveTo(px + L * 0.16, pt * 1.15, bx - L * 0.22, by, bx, by);
    ctx.bezierCurveTo(
      bx + L * (0.1 + 0.16 * (1 - blunt)), by,
      nx - L * (0.03 + 0.02 * blunt), ny + H * (0.1 + 0.36 * blunt) * f.belly,
      nx, ny,
    );
  }
  ctx.closePath();
}

function tailPath(ctx, type, L, H, sway, f) {
  const bx = -L * 0.38;
  ctx.save();
  ctx.translate(bx, 0);
  ctx.rotate(sway);
  ctx.beginPath();
  const t = H;
  const p = Math.max(t * 0.08, H * f.ped * 0.7);
  switch (type) {
    case "fork":
      ctx.moveTo(0, -p);
      ctx.quadraticCurveTo(-L * 0.12, -t * 0.25, -L * 0.24, -t * 0.42);
      ctx.quadraticCurveTo(-L * 0.17, -t * 0.08, -L * 0.13, 0);
      ctx.quadraticCurveTo(-L * 0.17, t * 0.08, -L * 0.24, t * 0.42);
      ctx.quadraticCurveTo(-L * 0.12, t * 0.25, 0, p);
      break;
    case "lyre":
      ctx.moveTo(0, -p);
      ctx.quadraticCurveTo(-L * 0.18, -t * 0.25, -L * 0.36, -t * 0.55);
      ctx.quadraticCurveTo(-L * 0.18, -t * 0.12, -L * 0.14, 0);
      ctx.quadraticCurveTo(-L * 0.18, t * 0.12, -L * 0.36, t * 0.55);
      ctx.quadraticCurveTo(-L * 0.18, t * 0.25, 0, p);
      break;
    case "fan":
      ctx.moveTo(0, -p);
      ctx.quadraticCurveTo(-L * 0.2, -t * 0.7, -L * 0.36, -t * 0.4);
      ctx.quadraticCurveTo(-L * 0.42, 0, -L * 0.36, t * 0.4);
      ctx.quadraticCurveTo(-L * 0.2, t * 0.7, 0, p);
      break;
    case "delta":
      ctx.moveTo(0, -p);
      ctx.quadraticCurveTo(-L * 0.18, -t * 0.55, -L * 0.48, -t * 0.95);
      ctx.quadraticCurveTo(-L * 0.56, 0, -L * 0.48, t * 0.95);
      ctx.quadraticCurveTo(-L * 0.18, t * 0.55, 0, p);
      break;
    case "veil":
      ctx.moveTo(0, -p);
      ctx.bezierCurveTo(-L * 0.3, -t * 0.9, -L * 0.6, -t * 0.3, -L * 0.55, t * 0.2);
      ctx.bezierCurveTo(-L * 0.5, t * 0.7, -L * 0.25, t * 0.8, 0, p);
      break;
    case "round":
      ctx.moveTo(0, -p);
      ctx.quadraticCurveTo(-L * 0.24, -t * 0.42, -L * 0.24, 0);
      ctx.quadraticCurveTo(-L * 0.24, t * 0.42, 0, p);
      break;
    default:
      ctx.moveTo(0, 0);
  }
  ctx.closePath();
  ctx.restore();
}

function dorsalPath(ctx, type, L, H, sway, f) {
  ctx.beginPath();
  const top = -H * 0.48 * f.back;
  const dx = (f.crown - 0.05) * L * 0.7;
  switch (type) {
    case "low":
      ctx.moveTo(dx + L * 0.1, top + H * 0.05);
      ctx.quadraticCurveTo(dx - L * 0.02, top - H * 0.22, dx - L * 0.14, top + H * 0.1);
      break;
    case "tall":
      ctx.moveTo(dx + L * 0.16, top + H * 0.04);
      ctx.quadraticCurveTo(dx + L * 0.02, top - H * 0.55, dx - L * 0.12 + sway * L * 0.1, top - H * 0.2);
      ctx.lineTo(dx - L * 0.16, top + H * 0.14);
      break;
    case "sail":
      ctx.moveTo(dx + L * 0.22, top + H * 0.04);
      ctx.bezierCurveTo(dx + L * 0.1, top - H * 0.9, dx - L * 0.2, top - H * 0.8, dx - L * 0.3 + sway * L * 0.1, top - H * 0.1);
      ctx.lineTo(dx - L * 0.2, top + H * 0.16);
      break;
    default:
      return false;
  }
  ctx.closePath();
  return true;
}

function bandCentres(L) {
  return [L * 0.28, L * 0.01, -L * 0.26];
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
      for (const x of bandCentres(L)) {
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

// Markings drawn inside the body clip, after the base pattern.
function bodyMarks(ctx, f, L, H, colors, detail) {
  const fx = f.fx;
  if (fx.includes("neonRed") || fx.includes("redFull")) {
    const front = fx.includes("redFull") ? L * 0.42 : L * 0.02;
    const g = ctx.createLinearGradient(front, 0, front - L * 0.08, 0);
    g.addColorStop(0, rgba(colors[2], 0));
    g.addColorStop(1, colors[2]);
    ctx.fillStyle = g;
    ctx.fillRect(-L * 0.5, H * 0.04, front + L * 0.5, H);
  }
  if (fx.includes("glow")) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = rgba(colors[1], 0.45);
    ctx.fillRect(-L * 0.4, -H * 0.1, L * 0.82, H * 0.07);
    ctx.restore();
  }
  if (fx.includes("multiStripe")) {
    ctx.fillStyle = colors[1];
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-L * 0.45, -H * 0.27 + i * H * 0.17, L * 0.82, H * 0.07);
    }
  }
  if (fx.includes("bandEdge")) {
    ctx.strokeStyle = "rgba(20,24,24,0.85)";
    ctx.lineWidth = Math.max(0.8, L * 0.016);
    for (const x of bandCentres(L)) {
      ctx.beginPath();
      ctx.ellipse(x, 0, L * 0.055, H * 0.7, 0, 0, TAU);
      ctx.stroke();
    }
  }
  if (fx.includes("mask")) {
    ctx.fillStyle = "rgba(25,28,28,0.9)";
    ctx.beginPath();
    ctx.ellipse(L * 0.34, -H * 0.1, L * 0.06, H * 0.32, 0.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-L * 0.34, -H * 0.02, L * 0.05, H * 0.2, 0, 0, TAU);
    ctx.fill();
  }
  if (fx.includes("scutes") && detail) {
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = Math.max(0.6, L * 0.008);
    for (let i = 0; i < 7; i++) {
      const x = L * 0.2 - i * L * 0.085;
      ctx.beginPath();
      ctx.moveTo(x, -H * 0.35);
      ctx.quadraticCurveTo(x - L * 0.03, 0, x, H * 0.3);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(L * 0.25, 0);
    ctx.lineTo(-L * 0.4, 0);
    ctx.stroke();
  }
  if (fx.includes("scales") && detail) {
    const s = Math.max(3, L * 0.07);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = Math.max(0.5, L * 0.006);
    for (let row = -3; row <= 3; row++) {
      const y = row * s * 0.8;
      for (let col = 0; col < 12; col++) {
        const x = L * 0.22 - col * s * 0.9 + (row % 2 ? s * 0.45 : 0);
        ctx.beginPath();
        ctx.arc(x, y, s * 0.55, Math.PI * 0.6, Math.PI * 1.4);
        ctx.stroke();
      }
    }
  }
  if (fx.includes("lateral") && detail) {
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = Math.max(0.6, L * 0.008);
    ctx.setLineDash([L * 0.025, L * 0.02]);
    ctx.beginPath();
    ctx.moveTo(L * 0.3, -H * 0.12);
    ctx.quadraticCurveTo(0, -H * 0.06, -L * 0.4, 0);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (fx.includes("scalpel")) {
    ctx.fillStyle = "rgba(255,240,200,0.85)";
    ctx.beginPath();
    ctx.ellipse(-L * 0.33, 0, L * 0.03, H * 0.04, 0, 0, TAU);
    ctx.fill();
  }
}

function finPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 4) ctx.quadraticCurveTo(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
  ctx.closePath();
}

// Fins and appendages drawn behind the body.
function backFins(ctx, f, L, H, sway, finColor, colors) {
  const fx = f.fx;
  const back = H * 0.48 * f.back;
  const belly = H * 0.48 * f.belly;
  ctx.fillStyle = finColor;
  if (fx.includes("fringe")) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-L, -H * 2, L * 1.2, H * 4);
    ctx.clip();
    ctx.translate(-L * 0.05, 0);
    ctx.scale(1.08, 1.14);
    bodyPath(ctx, L, H, f);
    ctx.fill();
    ctx.restore();
  }
  if (fx.includes("angelFins") || fx.includes("triFins")) {
    const k = fx.includes("angelFins") ? 1 : 0.62;
    finPath(ctx, [L * 0.08, -back * 0.9, L * -0.1, -back * (1.6 * k + 0.4), -L * 0.32 + sway * L * 0.2, -back * (1.9 * k + 0.3), -L * 0.18, -back * 0.8, -L * 0.36, -H * 0.12]);
    ctx.fill();
    finPath(ctx, [L * 0.04, belly * 0.9, L * -0.12, belly * (1.6 * k + 0.4), -L * 0.32 + sway * L * 0.2, belly * (1.9 * k + 0.3), -L * 0.18, belly * 0.8, -L * 0.36, H * 0.12]);
    ctx.fill();
  }
  if (fx.includes("longAnal")) {
    finPath(ctx, [L * 0.06, belly * 0.85, -L * 0.04, belly * 1.9, -L * 0.3 + sway * L * 0.15, belly * 1.7, -L * 0.34, belly * 0.9, -L * 0.37, H * 0.12]);
    ctx.fill();
  }
  if (fx.includes("rearFins")) {
    finPath(ctx, [-L * 0.12, -back * 0.55, -L * 0.28, -back * 1.15, -L * 0.38, -H * 0.1, -L * 0.3, -back * 0.3, -L * 0.12, -back * 0.55]);
    ctx.fill();
    finPath(ctx, [-L * 0.08, belly * 0.7, -L * 0.26, belly * 1.3, -L * 0.38, H * 0.1, -L * 0.28, belly * 0.4, -L * 0.08, belly * 0.7]);
    ctx.fill();
  }
  if (fx.includes("twoDorsal")) {
    finPath(ctx, [-L * 0.1, -back * 0.85, -L * 0.2, -back * 1.45, -L * 0.32, -back * 0.55, -L * 0.2, -back * 0.6, -L * 0.1, -back * 0.85]);
    ctx.fill();
  }
  if (fx.includes("spines")) {
    ctx.strokeStyle = rgba(colors[1], 0.9);
    ctx.lineWidth = Math.max(0.7, L * 0.012);
    for (let i = 0; i < 9; i++) {
      const x = L * 0.2 - i * L * 0.06;
      ctx.beginPath();
      ctx.moveTo(x, -back * 0.85);
      ctx.lineTo(x - L * 0.06 + sway * L * 0.05, -back * (1.9 - i * 0.07));
      ctx.stroke();
    }
    finPath(ctx, [L * 0.2, -back * 0.85, L * 0.0, -back * 1.5, -L * 0.3, -back * 1.2, -L * 0.3, -back * 0.6, L * 0.2, -back * 0.85]);
    ctx.fillStyle = rgba(colors[0], 0.35);
    ctx.fill();
    ctx.fillStyle = finColor;
  }
  if (fx.includes("dorsalFilament")) {
    ctx.strokeStyle = finColor;
    ctx.lineWidth = Math.max(0.8, L * 0.014);
    ctx.beginPath();
    ctx.moveTo(L * 0.02, -back * 1.0);
    ctx.quadraticCurveTo(-L * 0.2, -back * 2.2, -L * 0.62 + sway * L * 0.3, -back * 1.6);
    ctx.stroke();
  }
  if (fx.includes("lobes")) {
    for (const [x, y, a] of [[-L * 0.12, -back * 0.95, -0.9], [-L * 0.14, belly * 0.95, 0.9]]) {
      ctx.beginPath();
      ctx.ellipse(x, y + Math.sign(y) * H * 0.12, L * 0.09, H * 0.12, a, 0, TAU);
      ctx.fill();
    }
  }
  if (fx.includes("smallFins")) {
    ctx.beginPath();
    ctx.ellipse(-L * 0.28, -back * 0.62, L * 0.06, H * 0.1, -0.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-L * 0.28, belly * 0.62, L * 0.06, H * 0.1, 0.5, 0, TAU);
    ctx.fill();
  }
}

// Fins and appendages drawn over the body.
function frontFins(ctx, f, L, H, sway, finColor, colors, phase) {
  const fx = f.fx;
  const back = H * 0.48 * f.back;
  const belly = H * 0.48 * f.belly;
  const nx = L * 0.5;
  const ny = H * f.mouth;
  ctx.lineCap = "round";
  if (fx.includes("adipose")) {
    ctx.fillStyle = finColor;
    ctx.beginPath();
    ctx.ellipse(-L * 0.29, -H * (f.ped + 0.07), L * 0.03, H * 0.07, -0.4, 0, TAU);
    ctx.fill();
  }
  if (fx.includes("barbels")) {
    ctx.strokeStyle = rgba(colors[0], 0.9);
    ctx.lineWidth = Math.max(0.6, L * 0.01);
    for (const k of [0, 1]) {
      ctx.beginPath();
      ctx.moveTo(nx - L * 0.03, ny + H * 0.04);
      ctx.quadraticCurveTo(nx + L * 0.02, ny + H * (0.2 + k * 0.08), nx - L * (0.02 + k * 0.04), ny + H * (0.32 + k * 0.06));
      ctx.stroke();
    }
  }
  if (fx.includes("chinBarbels")) {
    ctx.strokeStyle = rgba(colors[0], 0.9);
    ctx.lineWidth = Math.max(0.7, L * 0.01);
    ctx.beginPath();
    ctx.moveTo(nx - L * 0.02, ny + H * 0.06);
    ctx.quadraticCurveTo(nx + L * 0.06, ny - H * 0.02, nx + L * 0.1, ny - H * 0.14);
    ctx.stroke();
  }
  if (fx.includes("feelers")) {
    ctx.strokeStyle = rgba(colors[2] || colors[0], 0.85);
    ctx.lineWidth = Math.max(0.6, L * 0.009);
    ctx.beginPath();
    ctx.moveTo(L * 0.16, belly * 0.8);
    ctx.bezierCurveTo(L * 0.1, belly * 1.6, -L * 0.1, belly * 2.0, -L * 0.36 + Math.sin(phase) * L * 0.06, belly * 2.2);
    ctx.stroke();
  }
  if (fx.includes("pelvicLong")) {
    ctx.fillStyle = finColor;
    finPath(ctx, [L * 0.18, belly * 0.8, L * 0.12, belly * 1.8, L * 0.02 + sway * L * 0.1, belly * 1.9, L * 0.06, belly * 1.1, L * 0.18, belly * 0.8]);
    ctx.fill();
  }
  if (fx.includes("whiteEdge")) {
    ctx.strokeStyle = "rgba(250,248,240,0.95)";
    ctx.lineWidth = Math.max(0.8, L * 0.014);
    ctx.beginPath();
    ctx.moveTo(L * 0.1, belly * 0.86);
    ctx.lineTo(L * 0.02, belly * 1.18);
    ctx.moveTo(-L * 0.16, belly * 0.78);
    ctx.lineTo(-L * 0.22, belly * 1.08);
    ctx.stroke();
  }
  if (fx.includes("fans")) {
    ctx.save();
    ctx.translate(L * 0.18, H * 0.12);
    const spread = 0.9 + Math.sin(phase) * 0.08;
    for (let i = 0; i < 9; i++) {
      const a = 1.2 + (i / 8) * 1.6 * spread;
      ctx.strokeStyle = i % 2 ? rgba(colors[1], 0.85) : rgba(colors[0], 0.85);
      ctx.lineWidth = Math.max(0.8, L * 0.014);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * L * 0.55, Math.sin(a) * L * 0.42);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (fx.includes("wings")) {
    ctx.save();
    ctx.translate(L * 0.18, -H * 0.05);
    ctx.rotate(-0.25 + Math.sin(phase) * 0.05);
    finPath(ctx, [0, 0, -L * 0.2, -H * 1.1, -L * 0.62, -H * 0.85, -L * 0.4, -H * 0.1, 0, H * 0.08]);
    ctx.fillStyle = "rgba(220,235,240,0.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(60,90,110,0.35)";
    ctx.lineWidth = Math.max(0.5, L * 0.006);
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-L * (0.2 + i * 0.07), -H * (1.05 - i * 0.16));
      ctx.stroke();
    }
    ctx.restore();
  }
  if (fx.includes("lobes")) {
    ctx.fillStyle = finColor;
    ctx.beginPath();
    ctx.ellipse(L * 0.14, H * 0.22, L * 0.1, H * 0.11, 0.7 + sway, 0, TAU);
    ctx.fill();
  }
}

// overlapping scale arcs and a lateral line, faint enough to read as texture
function bodyScales(ctx, L, H) {
  const r = Math.max(2.4, L * 0.06);
  ctx.save();
  ctx.lineWidth = Math.max(0.5, L * 0.006);
  // two passes of the same scale rows: a shadowed rim, then a lit edge just above it,
  // which reads as overlapping plates instead of a flat line pattern
  const scaleRows = (dx, dy) => {
    ctx.beginPath();
    let row = 0;
    for (let y = -H * 0.5; y <= H * 0.5; y += r * 0.9) {
      const off = row % 2 ? r * 0.5 : 0;
      for (let x = -L * 0.4 + off; x <= L * 0.26; x += r) {
        const a = r * 0.62;
        ctx.moveTo(x + dx + a * Math.cos(-1.2), y + dy + a * Math.sin(-1.2));
        ctx.arc(x + dx, y + dy, a, -1.2, 1.2);
      }
      row++;
    }
    ctx.stroke();
  };
  ctx.strokeStyle = "rgba(10,28,28,0.16)";
  scaleRows(0, 0);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  scaleRows(-ctx.lineWidth * 1.1, -ctx.lineWidth * 0.6);
  ctx.beginPath();
  ctx.moveTo(L * 0.26, -H * 0.12);
  ctx.quadraticCurveTo(0, -H * 0.2, -L * 0.42, -H * 0.02);
  ctx.strokeStyle = "rgba(20,35,35,0.16)";
  ctx.lineWidth = Math.max(0.6, L * 0.008);
  ctx.stroke();
  ctx.restore();
}

function finRays(ctx, L, H, sway, tailType, f) {
  ctx.save();
  tailPath(ctx, tailType, L, H, sway, f);
  ctx.clip();
  ctx.translate(-L * 0.38, 0);
  ctx.rotate(sway);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = Math.max(0.5, L * 0.006);
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-L * 0.6, i * H * 0.22);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawFish(ctx, fish, x, y, L, dir, phase, opts = {}) {
  const sp = fishById[fish.sp];
  if (!sp) return;
  const colors = opts.flat ? [opts.flat, opts.flat, opts.flat] : fish.colors || sp.colors;
  if (sp.body === "shrimp") return drawShrimp(ctx, colors, x, y, L, dir, phase, opts);
  if (sp.body === "snail") return drawSnail(ctx, colors, x, y, L, dir, phase, opts);
  const f = fishForm(sp.id);
  const H = L * sp.h;
  const tailType = f.tail || sp.tail;
  const dorsalType = f.dorsal || sp.dorsal;
  const sway = Math.sin(phase) * (opts.sleeping ? 0.08 : 0.28);
  const detail = !opts.flat && L >= 26;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  if (opts.tilt) ctx.rotate(opts.tilt);
  ctx.globalAlpha = opts.alpha ?? 1;
  const finColor = opts.flat ? opts.flat : f.fin || rgba(colors[2] || colors[0], 0.78);

  backFins(ctx, f, L, H, sway, finColor, colors);
  // tail (goldfish carry a second, offset lobe)
  if (f.fx.includes("doubleTail")) {
    tailPath(ctx, tailType, L, H, -sway * 0.7 + 0.12, f);
    ctx.fillStyle = opts.flat ? finColor : rgba(colors[2] || colors[0], 0.5);
    ctx.fill();
  }
  tailPath(ctx, tailType, L, H, sway, f);
  ctx.fillStyle = finColor;
  ctx.fill();
  if (detail) {
    // fins thin out toward the edge: the colour lifts and turns translucent at the tips
    ctx.save();
    tailPath(ctx, tailType, L, H, sway, f);
    ctx.clip();
    const tip = ctx.createLinearGradient(-L * 0.4, 0, -L * 0.9, 0);
    tip.addColorStop(0, "rgba(10,28,28,0.14)");
    tip.addColorStop(0.45, "rgba(255,255,255,0)");
    tip.addColorStop(1, "rgba(255,255,255,0.3)");
    ctx.fillStyle = tip;
    ctx.fillRect(-L * 1.2, -H * 2, L, H * 4);
    ctx.restore();
  }
  if (detail && (f.fx.includes("rays") || L >= 28)) finRays(ctx, L, H, sway, tailType, f);
  if (detail && !f.fx.includes("finEdge")) {
    tailPath(ctx, tailType, L, H, sway, f);
    ctx.strokeStyle = "rgba(15,30,30,0.18)";
    ctx.lineWidth = Math.max(0.5, L * 0.008);
    ctx.stroke();
  }
  if (detail && f.fx.includes("finEdge")) {
    tailPath(ctx, tailType, L, H, sway, f);
    ctx.strokeStyle = "rgba(20,24,24,0.7)";
    ctx.lineWidth = Math.max(0.7, L * 0.014);
    ctx.stroke();
  }
  if (dorsalPath(ctx, dorsalType, L, H, sway, f)) {
    ctx.fillStyle = finColor;
    ctx.fill();
    if (detail) {
      ctx.strokeStyle = "rgba(15,30,30,0.18)";
      ctx.lineWidth = Math.max(0.5, L * 0.008);
      ctx.stroke();
    }
  }
  // anal / pelvic fin
  if (!f.fx.includes("longAnal") && !f.fx.includes("angelFins") && !f.fx.includes("triFins") && !f.fx.includes("smallFins")) {
    const belly = H * 0.44 * f.belly;
    ctx.beginPath();
    ctx.moveTo(-L * 0.02, belly);
    ctx.quadraticCurveTo(-L * 0.12, belly + H * (tailType === "veil" ? 0.5 : 0.22), -L * 0.24, belly * 0.72);
    ctx.closePath();
    ctx.fillStyle = finColor;
    ctx.fill();
  }

  // body with pattern
  ctx.save();
  bodyPath(ctx, L, H, f);
  ctx.clip();
  if (opts.flat) {
    ctx.fillStyle = opts.flat;
    ctx.fillRect(-L, -H * 2, L * 2, H * 4);
  } else {
    patternFill(ctx, sp.pattern, L, H, colors, hashString(fish.id || fish.sp));
    bodyMarks(ctx, f, L, H, colors, detail);
    if (detail) bodyScales(ctx, L, H);
    // soft shading: darker back, lighter belly, a rounded highlight on the flank
    const sh = ctx.createLinearGradient(0, -H * 0.5, 0, H * 0.5);
    sh.addColorStop(0, "rgba(10,25,25,0.30)");
    sh.addColorStop(0.5, "rgba(255,255,255,0)");
    sh.addColorStop(1, "rgba(255,255,255,0.24)");
    ctx.fillStyle = sh;
    ctx.fillRect(-L, -H * 2, L * 2, H * 4);
    const hl = ctx.createRadialGradient(L * 0.12, -H * 0.18, 0, L * 0.12, -H * 0.18, L * 0.3);
    hl.addColorStop(0, "rgba(255,255,255,0.22)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl;
    ctx.fillRect(-L, -H * 2, L * 2, H * 4);
    // roundness: the body edge falls into shade (same treatment as the pond koi)
    if (detail) {
      bodyPath(ctx, L, H, f);
      ctx.strokeStyle = "rgba(10,25,25,0.16)";
      ctx.lineWidth = H * 0.34;
      ctx.stroke();
      ctx.strokeStyle = "rgba(10,25,25,0.14)";
      ctx.lineWidth = H * 0.12;
      ctx.stroke();
      // the back catches the light: a soft specular ridge along the upper flank
      ctx.beginPath();
      ctx.moveTo(L * 0.3, -H * 0.2);
      ctx.quadraticCurveTo(0, -H * 0.34, -L * 0.3, -H * 0.1);
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255,255,255,0.26)";
      ctx.lineWidth = Math.max(1, H * 0.09);
      ctx.stroke();
    }
    if (fish.golden) {
      const t = (performance.now() / 1400) % 1;
      const gx = L * (0.7 - t * 1.6);
      const gl = ctx.createLinearGradient(gx - L * 0.15, -H, gx + L * 0.15, H);
      gl.addColorStop(0, "rgba(255,250,220,0)");
      gl.addColorStop(0.5, "rgba(255,250,220,0.55)");
      gl.addColorStop(1, "rgba(255,250,220,0)");
      ctx.fillStyle = gl;
      ctx.fillRect(-L, -H * 2, L * 2, H * 4);
    }
  }
  ctx.restore();
  if (!opts.flat) {
    // outline for legibility on any background
    bodyPath(ctx, L, H, f);
    ctx.strokeStyle = "rgba(15,30,30,0.3)";
    ctx.lineWidth = Math.max(0.6, L * 0.012);
    ctx.stroke();
    // gill line
    const gx = L * (0.27 - 0.03 * (1 - f.nose));
    ctx.beginPath();
    ctx.arc(gx, H * f.mouth * 0.5, H * 0.3, -0.9, 0.9);
    ctx.strokeStyle = "rgba(15,30,30,0.2)";
    ctx.stroke();
    // mouth
    ctx.beginPath();
    ctx.moveTo(L * 0.5, H * f.mouth);
    ctx.lineTo(L * 0.455, H * f.mouth + H * 0.03);
    ctx.strokeStyle = "rgba(15,30,30,0.45)";
    ctx.stroke();
  }
  frontFins(ctx, f, L, H, sway, finColor, colors, phase);
  // pectoral fin: a small rayed fan behind the gill that rows on its own beat
  if (!f.fx.includes("fans") && !f.fx.includes("wings")) {
    const row = opts.sleeping ? 0 : Math.sin(phase * 1.7 + 0.8);
    const pl = L * 0.13;
    ctx.save();
    ctx.translate(L * 0.2, H * 0.1);
    ctx.rotate(0.35 + row * 0.32);
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.04);
    ctx.quadraticCurveTo(-pl * 0.5, -H * 0.14, -pl, -H * 0.06);
    ctx.quadraticCurveTo(-pl * 1.08, H * 0.04, -pl * 0.86, H * 0.12);
    ctx.quadraticCurveTo(-pl * 0.4, H * 0.12, 0, H * 0.04);
    ctx.closePath();
    ctx.fillStyle = finColor;
    ctx.fill();
    if (detail) {
      ctx.strokeStyle = "rgba(15,30,30,0.22)";
      ctx.lineWidth = Math.max(0.5, L * 0.007);
      ctx.stroke();
      ctx.beginPath();
      for (const k of [-0.05, 0.02, 0.09]) {
        ctx.moveTo(-pl * 0.08, 0);
        ctx.lineTo(-pl * 0.92, H * k);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.32)";
      ctx.stroke();
    }
    ctx.restore();
  }
  if (!opts.flat) {
    // eye with iris and catchlight
    const ex = L * (0.36 - 0.03 * f.nose + 0.02);
    const ey = H * f.mouth * 0.4 - H * 0.1;
    const er = Math.max(1.3, L * 0.045 * f.eye);
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
      ctx.arc(ex + er * 0.15, ey, er * 0.64, 0, TAU);
      ctx.fillStyle = "#1b2422";
      ctx.fill();
      if (er > 2.2) {
        ctx.beginPath();
        ctx.arc(ex + er * 0.35, ey - er * 0.3, er * 0.22, 0, TAU);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fill();
      }
    }
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
    // contact shadow pools under the stone so it sits in the substrate
    const contact = ctx.createRadialGradient(w * 0.05, 0, 1, w * 0.05, 0, w * 0.62);
    contact.addColorStop(0, "rgba(12, 22, 16, 0.42)");
    contact.addColorStop(1, "rgba(12, 22, 16, 0)");
    ctx.fillStyle = contact;
    ctx.beginPath();
    ctx.ellipse(w * 0.05, 0, w * 0.62, h * 0.16, 0, 0, TAU);
    ctx.fill();
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
    // light from the surface: a soft top-left highlight, a core shadow low on the right, a moss cap
    ctx.save();
    ctx.clip();
    const top = ctx.createRadialGradient(-w * 0.18, -h * 0.85, 1, -w * 0.18, -h * 0.85, w * 0.55);
    top.addColorStop(0, "rgba(255, 252, 236, 0.34)");
    top.addColorStop(1, "rgba(255, 252, 236, 0)");
    ctx.fillStyle = top;
    ctx.fillRect(-w, -h * 1.4, w * 2, h * 1.4);
    const core = ctx.createLinearGradient(-w * 0.1, -h * 0.5, w * 0.45, 0);
    core.addColorStop(0, "rgba(16, 26, 20, 0)");
    core.addColorStop(1, "rgba(16, 26, 20, 0.38)");
    ctx.fillStyle = core;
    ctx.fillRect(-w, -h * 1.4, w * 2, h * 1.4);
    if (!def.round) {
      ctx.fillStyle = "rgba(96, 132, 72, 0.32)";
      ctx.beginPath();
      ctx.ellipse(-w * 0.12, -h * 0.95, w * 0.26, h * 0.12, -0.15, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
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
    const foot = ctx.createRadialGradient(0, 0, 1, 0, 0, len * 0.45);
    foot.addColorStop(0, "rgba(12, 22, 16, 0.36)");
    foot.addColorStop(1, "rgba(12, 22, 16, 0)");
    ctx.fillStyle = foot;
    ctx.beginPath();
    ctx.ellipse(0, 0, len * 0.45, H * 0.025, 0, 0, TAU);
    ctx.fill();
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
// The fish is first drawn on a scratch canvas, its painted bounds are measured,
// and the result is scaled to fit, so long fins and fan tails are never clipped.
const thumbScratch = typeof document !== "undefined" ? document.createElement("canvas") : null;

export function fishThumb(canvas, fish, opts = {}) {
  // A canvas inside a sheet that is still opening has no layout yet; wait a few frames
  // so the art is sized for the real box rather than the default 300 x 150 buffer.
  const tries = opts.layoutTries || 0;
  if ((!canvas.clientWidth || !canvas.clientHeight) && tries < 30) {
    requestAnimationFrame(() => fishThumb(canvas, fish, { ...opts, layoutTries: tries + 1 }));
    return;
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sp = fishById[fish.sp];
  let drawOpts = {};
  let drawn = fish;
  if (opts.silhouette) {
    const ink = getComputedStyle(canvas).getPropertyValue("--ink").trim() || "#1d2a27";
    drawOpts = { flat: rgba(ink.startsWith("#") ? ink : "#1d2a27", 0.32) };
    drawn = { ...fish, golden: false };
  }
  const phase = opts.silhouette ? 0.6 : (opts.phase ?? 0.6);
  // Reference size on the scratch canvas, with room on every side for fins.
  const refL = 100;
  const pad = refL * 1.2;
  const sw = Math.ceil(refL + pad * 2);
  const sh = Math.ceil(refL * Math.max(0.4, sp.h) * 2 + pad * 2);
  const scratch = thumbScratch;
  scratch.width = sw;
  scratch.height = sh;
  const sctx = scratch.getContext("2d", { willReadFrequently: true });
  sctx.clearRect(0, 0, sw, sh);
  drawFish(sctx, drawn, sw / 2, sh / 2, refL, 1, phase, drawOpts);
  const data = sctx.getImageData(0, 0, sw, sh).data;
  let minX = sw;
  let minY = sh;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < sh; y += 1) {
    const row = y * sw * 4;
    for (let x = 0; x < sw; x += 1) {
      if (data[row + x * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    return;
  }
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  // Fit the painted bounds into the card art area, never larger than the old body size.
  const fit = Math.min((w * 0.84) / bw, (h * 0.8) / bh, (w * 0.58) / refL);
  const L = refL * fit;
  const cx = w / 2 + (sw / 2 - (minX + bw / 2)) * fit;
  const cy = h / 2 + (sh / 2 - (minY + bh / 2)) * fit;
  ctx.scale(dpr, dpr);
  drawFish(ctx, drawn, cx, cy, L, 1, phase, drawOpts);
}
