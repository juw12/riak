// Fishing: nine places with real-time weather and time of day. Flick to cast, crank the reel and play the
// line tension against the fish (after the 2008 iPhone game Flick Fishing), or use the classic hold controls.
import * as core from "./core.js";
import { t } from "./i18n.js";
import { el, clamp, lerp, mix, rgba, rng, hashString, TAU } from "./util.js";
import { icon, button, openSheet, toast, meter, segmented, confirmSheet } from "./ui.js";
import { SPOTS, FISH } from "./data.js";
import { spotById, fishById, phaseOf, weatherAt, daylight, rollCatch, spotCandidates, fishValue } from "./sim.js";
import { fishThumb } from "./draw.js";
import { speciesName } from "./tankpanel.js";
import { flickPower, motionPower, castMetres, crankSpeed, newFight, fightStep, isLure, MAX_CAST, lineOf, tournamentScore } from "./angler.js";
import { Tournament, clock, boardList, kgText, openTournamentSetup, openQuests, questsReady, openAlbum, shareTrophy, shareDuel } from "./anglerui.js";

const NIGHT_SKY = "#1c2a35";

// ---------- scene painter (shared by the cards and the live scene) ----------
export function paintScene(ctx, W, H, spot, ts, time, extra = {}) {
  const day = daylight(ts);
  const weather = extra.weather || weatherAt(spot.id, ts);
  const grey = weather === "rain" || weather === "fog" || weather === "snow" ? 0.35 : weather === "cloud" ? 0.18 : 0;
  const sky = mix(mix(NIGHT_SKY, spot.sky, day), "#b9c2c4", grey * day);
  const horizon = H * 0.46;
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, mix(sky, "#000000", 0.08));
  g.addColorStop(1, mix(sky, "#ffffff", 0.18 * day));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizon + 2);

  // sun or moon
  const h = new Date(ts).getHours() + new Date(ts).getMinutes() / 60;
  const isDay = h >= 6 && h < 18.5;
  const arc = isDay ? (h - 6) / 12.5 : ((h + 24 - 18.5) % 24) / 11.5;
  const bx = W * (0.1 + arc * 0.8);
  const by = horizon - Math.sin(arc * Math.PI) * horizon * 0.75;
  if (weather !== "fog" && weather !== "rain") {
    ctx.fillStyle = isDay ? rgba("#fff3c8", 0.95 - grey) : rgba("#eef2f0", 0.9);
    ctx.beginPath();
    ctx.arc(bx, by, isDay ? Math.max(8, W * 0.025) : Math.max(6, W * 0.018), 0, TAU);
    ctx.fill();
    if (!isDay) {
      ctx.fillStyle = rgba("#ffffff", 0.7);
      const r = rng(hashString(spot.id));
      for (let i = 0; i < 40; i++) {
        ctx.fillRect(r() * W, r() * horizon * 0.8, 1.2, 1.2);
      }
    }
  }

  // soft cloud banks drifting slowly; more and greyer in poor weather
  {
    const rc = rng(hashString(spot.id + "clouds"));
    const banks = weather === "clear" ? 3 : 6;
    const cloudTone = mix(mix("#ffffff", "#9aa3a6", grey * 1.6), NIGHT_SKY, (1 - day) * 0.8);
    for (let b = 0; b < banks; b++) {
      const cy = horizon * (0.18 + rc() * 0.5);
      const span = W * (0.12 + rc() * 0.16);
      const cx = ((rc() * (W + span * 2) + time * 0.004 * (0.6 + rc())) % (W + span * 2)) - span;
      const puffs = 5 + Math.floor(rc() * 4);
      ctx.fillStyle = rgba(cloudTone, 0.16 + 0.22 * day * (0.6 + grey));
      ctx.beginPath();
      for (let p = 0; p < puffs; p++) {
        const px = cx + (p / (puffs - 1) - 0.5) * span;
        const pr = span * (0.12 + rc() * 0.1) * (1 - Math.abs(p / (puffs - 1) - 0.5));
        ctx.moveTo(px + pr * 1.6, cy);
        ctx.ellipse(px, cy, pr * 1.6, pr, 0, 0, TAU);
      }
      ctx.fill();
      // flat, slightly darker underside
      ctx.fillStyle = rgba(mix(cloudTone, sky, 0.5), 0.12 * day);
      ctx.fillRect(cx - span * 0.45, cy + span * 0.02, span * 0.9, span * 0.05);
    }
  }

  // far hills
  const far = mix(mix(spot.far, NIGHT_SKY, 1 - day * 0.85), sky, 0.25 + grey);
  const farPts = [];
  let ridgePts = [];
  ctx.fillStyle = far;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  const r = rng(hashString(spot.id + "h"));
  const peaks = spot.id === "ocean" || spot.id === "lagoon" ? 0 : 5;
  for (let i = 0; i <= 10; i++) {
    const x = (i / 10) * W;
    const y = horizon - (peaks ? (0.05 + r() * 0.14) * H : 0.005 * H);
    ctx.lineTo(x, y);
    farPts.push([x, y]);
  }
  ctx.lineTo(W, horizon);
  ctx.closePath();
  ctx.fill();
  if (peaks) {
    const nearRidge = mix(far, mix(spot.near, NIGHT_SKY, (1 - day) * 0.75), 0.45);
    ctx.fillStyle = nearRidge;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    const rr = rng(hashString(spot.id + "ridge"));
    for (let i = 0; i <= 16; i++) {
      const x = (i / 16) * W;
      const y = horizon - (0.015 + rr() * 0.05) * H;
      ctx.lineTo(x, y);
      ridgePts.push([x, y]);
    }
    ctx.lineTo(W, horizon);
    ctx.closePath();
    ctx.fill();
    // a treeline of rounded crowns along the near ridge
    const crowns = mix(nearRidge, "#000000", 0.12);
    ctx.fillStyle = crowns;
    ctx.beginPath();
    const rt = rng(hashString(spot.id + "trees"));
    for (let i = 0; i < 60; i++) {
      const x = rt() * W;
      const seg = Math.min(15, Math.floor((x / W) * 16));
      const f = (x / W) * 16 - seg;
      const y = ridgePts[seg][1] * (1 - f) + ridgePts[seg + 1][1] * f;
      const tr = H * (0.008 + rt() * 0.014);
      ctx.moveTo(x + tr, y + tr * 0.4);
      ctx.ellipse(x, y + tr * 0.4, tr, tr * 1.25, 0, 0, TAU);
    }
    ctx.fill();
  }
  // haze where land meets sky
  const haze = ctx.createLinearGradient(0, horizon - H * 0.12, 0, horizon);
  haze.addColorStop(0, rgba(sky, 0));
  haze.addColorStop(1, rgba(mix(sky, "#ffffff", 0.3 * day), 0.45));
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - H * 0.12, W, H * 0.12);

  // water
  const w1 = mix(mix(spot.water1, NIGHT_SKY, 1 - day * 0.8), sky, 0.15);
  const w2 = mix(spot.water2, NIGHT_SKY, (1 - day) * 0.7);
  const wg = ctx.createLinearGradient(0, horizon, 0, H);
  wg.addColorStop(0, w1);
  wg.addColorStop(1, w2);
  ctx.fillStyle = wg;
  ctx.fillRect(0, horizon, W, H - horizon);
  // the hills mirrored in still water, squashed and faded
  if (farPts.length) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizon, W, (H - horizon) * 0.4);
    ctx.clip();
    const reflect = (pts, color, alpha) => {
      ctx.fillStyle = rgba(color, alpha);
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      for (const [x, y] of pts) ctx.lineTo(x, horizon + (horizon - y) * 0.7);
      ctx.lineTo(W, horizon);
      ctx.closePath();
      ctx.fill();
    };
    reflect(farPts, far, weather === "rain" ? 0.12 : 0.3);
    if (ridgePts.length) reflect(ridgePts, mix(spot.near, NIGHT_SKY, (1 - day) * 0.75), 0.22);
    ctx.restore();
  }
  // wave texture: short ripple dashes, dense and fine near the horizon, longer near the viewer
  {
    const rw = rng(hashString(spot.id + "waves"));
    const drift = time * 0.01;
    for (const [tone, alpha] of [["#ffffff", 0.1 + 0.08 * day], ["#0b2a2c", 0.1]]) {
      ctx.strokeStyle = rgba(tone, alpha);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 110; i++) {
        const d = rw() ** 1.6;
        const y = horizon + 3 + d * (H - horizon) * 0.95;
        const len = (6 + rw() * 14) * (0.35 + d * 2.2);
        const x = ((rw() * (W + 60) + drift * (0.3 + d)) % (W + 60)) - 30;
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + len * 0.5, y - 1.2 * (0.5 + d), x + len, y);
      }
      ctx.stroke();
    }
  }
  // glitter on the light path
  if (weather !== "fog" && weather !== "rain" && day > 0.2) {
    const rg = rng(hashString(spot.id + "glitter") + Math.floor(time / 300));
    ctx.fillStyle = rgba("#fffbe6", 0.75 * day);
    for (let i = 0; i < 40; i++) {
      const d = rg() ** 1.4;
      const y = horizon + 2 + d * (H - horizon) * 0.9;
      const spread = W * (0.012 + d * 0.06);
      const x = bx + (rg() - 0.5) * 2 * spread;
      const s = 0.8 + d * 2.2;
      ctx.fillRect(x - s, y - 0.5, s * 2, 1 + d);
    }
  }
  // horizon mist on the water, fading toward the viewer
  const mist = ctx.createLinearGradient(0, horizon, 0, horizon + (H - horizon) * 0.35);
  mist.addColorStop(0, rgba(mix(sky, "#ffffff", 0.2), 0.35));
  mist.addColorStop(1, rgba(sky, 0));
  ctx.fillStyle = mist;
  ctx.fillRect(0, horizon, W, (H - horizon) * 0.35);
  // sun or moon glint column
  if (weather !== "fog" && weather !== "rain") {
    const glint = ctx.createLinearGradient(0, horizon, 0, H);
    glint.addColorStop(0, rgba(isDay ? "#fff3c8" : "#eef2f0", isDay ? 0.32 * day : 0.16));
    glint.addColorStop(1, rgba("#ffffff", 0));
    ctx.fillStyle = glint;
    ctx.beginPath();
    ctx.moveTo(bx - W * 0.012, horizon);
    ctx.lineTo(bx + W * 0.012, horizon);
    ctx.lineTo(bx + W * 0.07, H);
    ctx.lineTo(bx - W * 0.07, H);
    ctx.closePath();
    ctx.fill();
  }
  // shimmer lines in perspective
  ctx.strokeStyle = rgba("#ffffff", 0.12 + 0.1 * day);
  for (let i = 0; i < 18; i++) {
    const d = (((i * 37) % 100) / 100) ** 1.8;
    const y = horizon + 4 + d * (H - horizon) * 0.8;
    const scale = 0.4 + d * 1.8;
    const x = ((i * 113 + time * 0.012 * (1 + (i % 3)) * scale) % (W + 80)) - 40;
    ctx.lineWidth = Math.max(0.8, scale * 0.9);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (14 + (i % 4) * 8) * scale, y);
    ctx.stroke();
  }
  // lamps for the harbour
  if (spot.id === "harbor") {
    for (let i = 0; i < 4; i++) {
      const lx = W * (0.55 + i * 0.12);
      ctx.fillStyle = "#3a3a36";
      ctx.fillRect(lx - 1, horizon - H * 0.12, 2, H * 0.12);
      ctx.fillStyle = rgba("#ffd27a", 0.9 - day * 0.6);
      ctx.beginPath();
      ctx.arc(lx, horizon - H * 0.12, 3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba("#ffd27a", 0.18 * (1 - day));
      ctx.fillRect(lx - 3, horizon, 6, H * 0.3);
    }
  }

  // near bank (bottom-left) with reeds
  const near = mix(spot.near, NIGHT_SKY, (1 - day) * 0.75);
  paintSpotProps(ctx, W, H, spot, horizon, day, time, near);
  const bankShadow = ctx.createRadialGradient(W * 0.14, H, H * 0.1, W * 0.14, H, W * 0.42);
  bankShadow.addColorStop(0, "rgba(0,0,0,0.22)");
  bankShadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bankShadow;
  ctx.fillRect(0, H * 0.55, W * 0.6, H * 0.45);
  const bankFill = ctx.createLinearGradient(0, H * 0.7, 0, H);
  bankFill.addColorStop(0, mix(near, "#ffffff", 0.12 * day));
  bankFill.addColorStop(1, mix(near, "#000000", 0.25));
  ctx.fillStyle = bankFill;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H * 0.72);
  ctx.quadraticCurveTo(W * 0.16, H * 0.7, W * 0.3, H * 0.86);
  ctx.quadraticCurveTo(W * 0.36, H * 0.95, W * 0.42, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = mix(near, "#000000", 0.2);
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const x = W * (0.02 + i * 0.022);
    const top = H * (0.58 + ((i * 7) % 10) / 100);
    ctx.beginPath();
    ctx.moveTo(x, H * 0.76);
    ctx.quadraticCurveTo(x + Math.sin(time * 0.001 + i) * 3, (top + H * 0.76) / 2, x + Math.sin(time * 0.0012 + i) * 5, top);
    ctx.stroke();
  }

  // weather
  if (weather === "rain") {
    ctx.strokeStyle = rgba("#dfe8ea", 0.45);
    ctx.lineWidth = 1;
    const rr = rng(7);
    for (let i = 0; i < 90; i++) {
      const x = (rr() * W + time * 0.05) % W;
      const y = (rr() * H + time * 0.6) % H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 10);
      ctx.stroke();
    }
  } else if (weather === "snow") {
    ctx.fillStyle = rgba("#ffffff", 0.85);
    const rr = rng(11);
    for (let i = 0; i < 70; i++) {
      const x = (rr() * W + Math.sin(time * 0.001 + i) * 8) % W;
      const y = (rr() * H + time * 0.04) % H;
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, TAU);
      ctx.fill();
    }
  } else if (weather === "fog") {
    ctx.fillStyle = rgba("#e8ecea", 0.35);
    ctx.fillRect(0, 0, W, H);
  }
  const vignette = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.4, W / 2, H * 0.5, Math.hypot(W, H) * 0.62);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

// Spot-specific scenery so each place reads at a glance. depth 0 = horizon, 1 = foreground.
function paintSpotProps(ctx, W, H, spot, horizon, day, time, near) {
  const id = spot.id;
  const r = rng(hashString(id + "props"));
  const waterH = H - horizon;
  const yAt = (depth) => horizon + waterH * depth;
  const night = 1 - day;
  const dim = (c, k = 0.7) => mix(c, NIGHT_SKY, night * k);
  const sway = (i) => Math.sin(time * 0.0009 + i) * 1.5;
  if (id === "pond") {
    // lily pads on the water, smaller toward the horizon, a few cream water lilies
    for (let i = 0; i < 26; i++) {
      const d = 0.08 + r() * 0.85;
      const x = W * (0.32 + r() * 0.66);
      const y = yAt(d) + sway(i) * 0.3;
      const s = W * (0.008 + d * 0.035);
      ctx.fillStyle = dim(i % 3 ? "#5f8f4a" : "#6f9f52");
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * 0.32, 0, 0.25, TAU - 0.05);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba("#ffffff", 0.12);
      ctx.lineWidth = 1;
      ctx.stroke();
      if (i % 5 === 0) {
        ctx.fillStyle = dim("#f4efe2", 0.5);
        for (let k = 0; k < 5; k++) {
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(k * 1.25) * s * 0.18, y - s * 0.12 + Math.sin(k * 1.25) * s * 0.06, s * 0.16, s * 0.07, k * 1.25, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = dim("#e8c04a", 0.5);
        ctx.beginPath();
        ctx.arc(x, y - s * 0.12, s * 0.06, 0, TAU);
        ctx.fill();
      }
    }
  } else if (id === "sawah") {
    // terraced paddy: bunds receding to the horizon with rows of rice tufts, a field hut far off
    for (let b = 0; b < 6; b++) {
      const d = (b + 1) / 7;
      const y = yAt(d * d);
      ctx.strokeStyle = dim(mix(near, "#8a7a52", 0.4));
      ctx.lineWidth = 1 + d * 5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(W * 0.5, y - waterH * 0.02, W, y + waterH * 0.01);
      ctx.stroke();
      const tufts = 26;
      ctx.strokeStyle = dim(b % 2 ? "#7ea64c" : "#8cb85a");
      ctx.lineWidth = Math.max(1, d * 2.2);
      for (let k = 0; k < tufts; k++) {
        const x = W * (k / tufts) + (b % 2) * W * 0.02;
        const ty = y - waterH * 0.02;
        const th = 3 + d * 18;
        ctx.beginPath();
        ctx.moveTo(x, ty + 2);
        ctx.lineTo(x - th * 0.3 + sway(k) * d, ty - th);
        ctx.moveTo(x, ty + 2);
        ctx.lineTo(x + th * 0.3 + sway(k) * d, ty - th * 0.9);
        ctx.stroke();
      }
    }
    const hx = W * 0.72;
    const hy = horizon - 2;
    ctx.fillStyle = dim("#6b5a3e");
    ctx.fillRect(hx - 9, hy - 10, 18, 10);
    ctx.fillStyle = dim("#8a6a3a");
    ctx.beginPath();
    ctx.moveTo(hx - 14, hy - 9);
    ctx.lineTo(hx, hy - 20);
    ctx.lineTo(hx + 14, hy - 9);
    ctx.closePath();
    ctx.fill();
  } else if (id === "stream") {
    // boulders with white riffles breaking around them
    for (let i = 0; i < 9; i++) {
      const d = 0.15 + r() * 0.75;
      const x = W * (0.35 + r() * 0.62);
      const y = yAt(d);
      const s = W * (0.012 + d * 0.04);
      ctx.fillStyle = dim(i % 2 ? "#7b8580" : "#8d968f");
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * 0.5, 0, Math.PI, TAU);
      ctx.fill();
      ctx.fillStyle = rgba("#ffffff", 0.18);
      ctx.beginPath();
      ctx.ellipse(x - s * 0.3, y - s * 0.32, s * 0.4, s * 0.12, -0.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba("#ffffff", 0.55);
      ctx.lineWidth = 1 + d;
      for (let k = 0; k < 3; k++) {
        const off = ((time * 0.04 + k * 9) % 26) * d;
        ctx.beginPath();
        ctx.moveTo(x - s * 1.1 - off, y + k * 2);
        ctx.lineTo(x - s * 1.8 - off, y + k * 2 + 1);
        ctx.stroke();
      }
    }
  } else if (id === "mangrove") {
    // mangroves on the right: arching prop roots into the water, dark canopy
    for (let i = 0; i < 4; i++) {
      const d = 0.15 + i * 0.22;
      const x = W * (0.7 + i * 0.08);
      const base = yAt(d);
      const tall = waterH * (0.6 + d * 0.9);
      ctx.strokeStyle = dim("#4a3f2e");
      ctx.lineWidth = 1 + d * 3;
      for (let k = -3; k <= 3; k++) {
        ctx.beginPath();
        ctx.moveTo(x, base - tall * 0.35);
        ctx.quadraticCurveTo(x + k * W * 0.012 * (1 + d), base - tall * 0.3, x + k * W * 0.02 * (1 + d), base);
        ctx.stroke();
      }
      ctx.lineWidth = 2 + d * 5;
      ctx.beginPath();
      ctx.moveTo(x, base - tall * 0.33);
      ctx.lineTo(x - W * 0.005, base - tall);
      ctx.stroke();
      ctx.fillStyle = dim(i % 2 ? "#3f5f3a" : "#4b6b42");
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(x + (k - 1.5) * W * 0.025 * (1 + d), base - tall - k % 2 * 8, W * 0.04 * (1 + d), tall * 0.16, 0, 0, TAU);
        ctx.fill();
      }
    }
  } else if (id === "blackwater") {
    // a branch reaching over the tea-coloured water, leaves floating on the surface
    ctx.strokeStyle = dim("#3a2e22");
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(W * 1.02, H * 0.08);
    ctx.quadraticCurveTo(W * 0.8, H * 0.12, W * 0.58, H * 0.26);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W * 0.74, H * 0.15);
    ctx.quadraticCurveTo(W * 0.7, H * 0.28, W * 0.66, H * 0.36);
    ctx.stroke();
    for (let i = 0; i < 26; i++) {
      const t = r();
      const x = W * (0.58 + t * 0.42) + (r() - 0.5) * 30;
      const y = H * (0.26 - t * 0.17) + r() * 34 + sway(i);
      ctx.fillStyle = dim(i % 3 ? "#3f5a30" : "#56703a");
      ctx.beginPath();
      ctx.ellipse(x, y, 9, 3.5, 0.6 + r(), 0, TAU);
      ctx.fill();
    }
    for (let i = 0; i < 14; i++) {
      const d = 0.1 + r() * 0.85;
      ctx.fillStyle = dim(i % 2 ? "#8a5a2a" : "#a8743a");
      ctx.beginPath();
      ctx.ellipse(W * (0.3 + r() * 0.68), yAt(d), 2 + d * 7, 1 + d * 2.4, r(), 0, TAU);
      ctx.fill();
    }
  } else if (id === "lagoon") {
    // a palm leaning in from the right and an outrigger on the horizon
    const px = W * 0.9;
    const py = H * 0.98;
    const tx = W * 0.76;
    const ty = H * 0.22;
    ctx.strokeStyle = dim("#7a6040");
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(W * 0.9, H * 0.5, tx, ty);
    ctx.stroke();
    ctx.strokeStyle = dim("#4f7a3a");
    ctx.lineWidth = 4;
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI + (k / 6) * Math.PI * 1.1 + Math.sin(time * 0.0008 + k) * 0.04;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + Math.cos(a) * W * 0.07, ty + Math.sin(a) * H * 0.08 - 10, tx + Math.cos(a) * W * 0.12, ty + Math.sin(a) * H * 0.06 + 22);
      ctx.stroke();
    }
    const bx = W * 0.42;
    const by = horizon + 4;
    ctx.fillStyle = dim("#5a4632");
    ctx.beginPath();
    ctx.moveTo(bx - 16, by);
    ctx.lineTo(bx + 16, by);
    ctx.lineTo(bx + 12, by + 3);
    ctx.lineTo(bx - 12, by + 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = dim("#5a4632");
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx - 10, by + 1);
    ctx.lineTo(bx - 8, by + 7);
    ctx.lineTo(bx + 8, by + 7);
    ctx.lineTo(bx + 10, by + 1);
    ctx.stroke();
  } else if (id === "glacier") {
    // a glacier face on the horizon and floes drifting nearer
    ctx.fillStyle = dim("#e8f0f2", 0.5);
    ctx.beginPath();
    ctx.moveTo(W * 0.45, horizon);
    for (let i = 0; i <= 12; i++) ctx.lineTo(W * (0.45 + i * 0.045), horizon - H * (0.05 + r() * 0.05));
    ctx.lineTo(W, horizon);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba("#9fbfcf", 0.6);
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const x = W * (0.47 + i * 0.05);
      ctx.beginPath();
      ctx.moveTo(x, horizon - H * 0.05);
      ctx.lineTo(x + 2, horizon);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const d = 0.1 + r() * 0.8;
      const x = W * (0.3 + r() * 0.65);
      const y = yAt(d) + sway(i) * 0.4;
      const s = W * (0.01 + d * 0.035);
      ctx.fillStyle = dim("#f2f6f6", 0.5);
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.lineTo(x - s * 0.6, y - s * 0.35);
      ctx.lineTo(x + s * 0.5, y - s * 0.3);
      ctx.lineTo(x + s, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgba("#9fc6d2", 0.35);
      ctx.fillRect(x - s, y, s * 2, s * 0.12);
    }
  } else if (id === "ocean") {
    // a sail on the horizon, gulls, long swells
    const sx = W * 0.62;
    const sy = horizon;
    ctx.fillStyle = dim("#f2efe6", 0.5);
    ctx.beginPath();
    ctx.moveTo(sx, sy - 2);
    ctx.lineTo(sx, sy - 22);
    ctx.lineTo(sx + 11, sy - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = dim("#3a3a36");
    ctx.fillRect(sx - 8, sy - 2, 20, 3);
    ctx.strokeStyle = rgba(dim("#2f3a3a"), 0.8);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      const gx = W * (0.3 + i * 0.12) + Math.sin(time * 0.0004 + i) * 20;
      const gy = H * (0.12 + (i % 2) * 0.06);
      const flap = Math.sin(time * 0.006 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(gx - 7, gy - flap);
      ctx.quadraticCurveTo(gx - 3, gy - 4, gx, gy);
      ctx.quadraticCurveTo(gx + 3, gy - 4, gx + 7, gy - flap);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba("#ffffff", 0.2);
    for (let i = 0; i < 6; i++) {
      const d = (i + 1) / 7;
      const y = yAt(d * d);
      ctx.lineWidth = 1 + d * 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.01 + time * 0.001 + i) * d * 4);
      ctx.stroke();
    }
  } else if (id === "harbor") {
    // pilings and moored boats
    for (let i = 0; i < 7; i++) {
      const d = 0.2 + i * 0.1;
      const x = W * (0.45 + i * 0.075);
      const y = yAt(d);
      ctx.fillStyle = dim("#4a3e30");
      ctx.fillRect(x - 1 - d * 3, y - waterH * (0.25 + d * 0.3), 2 + d * 6, waterH * (0.25 + d * 0.3));
    }
    for (let i = 0; i < 3; i++) {
      const d = 0.12 + i * 0.1;
      const x = W * (0.5 + i * 0.16);
      const y = yAt(d);
      const s = 14 + d * 40;
      ctx.fillStyle = dim(["#c4552f", "#2f6f66", "#e8e2d2"][i]);
      ctx.beginPath();
      ctx.moveTo(x - s, y - s * 0.25);
      ctx.lineTo(x + s, y - s * 0.25);
      ctx.lineTo(x + s * 0.7, y);
      ctx.lineTo(x - s * 0.8, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = dim("#f2efe6");
      ctx.fillRect(x - s * 0.2, y - s * 0.55, s * 0.45, s * 0.3);
    }
  }
}

// "sunny" reads oddly at night, so clear skies after dark are called clear.
export function weatherLabel(spotId, ts) {
  const w = weatherAt(spotId, ts);
  const phase = phaseOf(ts);
  if (w === "sun" && (phase === "night" || phase === "dusk")) return t("weather.clear");
  return t("weather." + w);
}

export class FishingPanel {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.spot = null;
    this.bait = "worm";
    this.stateName = "idle";
    this.raf = 0;
    this.visible = false;
    this.tourney = null;
    this.dist = 0;
    this.crank = { acc: 0, angle: 0, rate: 0, drag: false, last: 0, clickAcc: 0 };
    this.reelHold = false;
    this.reelInput = 0;
    this.sideS = 0;
    this.mPeak = 0;
    this.mPeakAt = 0;
    this.mCooldown = 0;
    this.onKey = (e) => this.key(e);
  }

  get a() {
    return core.angler();
  }
  get flick() {
    return this.a.controls !== "classic";
  }

  init() {
    this.renderList();
  }
  show() {
    this.visible = true;
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
    if (this.spot) {
      this.startMotion();
      this.loop();
    } else this.renderList();
  }
  hide() {
    this.visible = false;
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
    cancelAnimationFrame(this.raf);
    this.stopMotion();
    this.reelHold = false;
    if (this.stateName !== "idle" && this.stateName !== "result") this.resetCast();
  }
  refresh() {
    if (!this.spot) this.renderList();
    else this.renderSide();
  }

  vibrate(pattern) {
    if (this.a.haptics === false || !navigator.vibrate) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // some browsers refuse vibration without a recent tap
    }
  }

  // ---------- spot list ----------
  renderList() {
    cancelAnimationFrame(this.raf);
    this.stopMotion();
    clearTimeout(this.resetTimer);
    this.spot = null;
    this.tourney = null;
    this.fight = null;
    this.bobber = null;
    this.stateName = "idle";
    const s = core.S();
    const a = this.a;
    const root = this.root;
    root.innerHTML = "";
    const totalFound = Object.values(s.journal.fish).filter((j) => j.count > 0).length;
    root.append(el("div", { class: "panel-head" }, [
      el("div", {}, [el("h2", { text: t("fishing.title") }), el("p", { text: t("fishing.lead") })]),
      el("span", { class: "chip" }, [icon("book", 16), el("span", { text: t("fishing.found", { a: totalFound, b: FISH.length }) })]),
    ]));
    const ready = questsReady();
    root.append(el("div", { class: "angler-bar" }, [
      button(t("tourney.title"), { icon: "timer", kind: "quiet", onclick: () => openTournamentSetup(this) }),
      button(ready ? t("quest.titleReady", { n: ready }) : t("quest.title"), { icon: "check", kind: ready ? "primary" : "quiet", onclick: () => openQuests(() => this.renderList()) }),
      button(t("album.title") + " (" + a.album.length + ")", { icon: "camera", kind: "quiet", onclick: () => openAlbum() }),
      el("span", { class: "angler-stats muted", text: t("angler.stats", { cast: a.maxCast, kg: kgText(a.bestKg), n: a.landed }) }),
    ]));
    if (a.duel) {
      const duel = a.duel;
      const spot = spotById[duel.spot];
      const open = s.unlockedSpots.includes(duel.spot);
      const target = t("duel.target", { fish: speciesName(duel.sp), size: duel.size, kg: kgText(duel.kg), spot: t("spot." + duel.spot) });
      root.append(el("div", { class: "duel-banner" + (duel.beaten ? " beaten" : ""), role: "status" }, [
        el("div", {}, [
          el("b", { text: duel.beaten ? t("duel.won") : t("duel.title", { name: duel.from || t("duel.friend") }) }),
          el("div", { class: "muted", text: target }),
        ]),
        el("div", { class: "row" }, [
          !duel.beaten && open ? button(t("duel.go"), { kind: "primary small", onclick: () => this.enter(duel.spot) }) : null,
          !open ? el("span", { class: "tag muted" }, [icon("lock", 12), t("common.unlockAt", { n: spot.level })]) : null,
          button(duel.beaten ? t("common.close") : t("duel.dismiss"), { kind: "quiet small", onclick: () => {
            core.setDuel(null);
            this.renderList();
          } }),
        ]),
      ]));
    }
    const grid = el("div", { class: "spot-grid" });
    const now = Date.now();
    for (const spot of SPOTS) {
      const unlocked = s.unlockedSpots.includes(spot.id);
      const fishHere = FISH.filter((f) => f.spots.includes(spot.id));
      const found = fishHere.filter((f) => s.journal.fish[f.id]?.count > 0).length;
      const cv = el("canvas", { "aria-hidden": "true" });
      const card = el("button", { type: "button", class: "spot" + (unlocked ? "" : " locked"), disabled: !unlocked, "aria-label": t("spot." + spot.id) + (unlocked ? "" : ". " + t("common.unlockAt", { n: spot.level })) }, [
        cv,
        el("div", { class: "spot-body" }, [
          el("div", { class: "spot-title" }, [el("span", { text: t("spot." + spot.id) }), unlocked ? el("small", { class: "muted", text: t("journal.progress", { a: found, b: fishHere.length }) }) : el("span", { class: "tag muted" }, [icon("lock", 12), t("common.unlockAt", { n: spot.level })])]),
          el("div", { class: "muted", style: { fontSize: "14px" }, text: t("spot." + spot.id + ".d") }),
          el("div", { class: "spot-meta" }, [el("span", { text: t("phase." + phaseOf(now)) }), el("span", { text: weatherLabel(spot.id, now) }), el("span", { text: t("water." + spot.water) })]),
        ]),
      ]);
      card.addEventListener("click", () => this.enter(spot.id));
      grid.append(card);
      requestAnimationFrame(() => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const W = cv.clientWidth || 260;
        const H = cv.clientHeight || 96;
        cv.width = W * dpr;
        cv.height = H * dpr;
        const ctx = cv.getContext("2d");
        ctx.scale(dpr, dpr);
        paintScene(ctx, W, H, spot, now, 0);
      });
    }
    root.append(grid);
  }

  // ---------- tournament flow ----------
  startTournament(cfg) {
    this.enter(cfg.spotId);
    this.tourney = new Tournament(cfg);
    this.renderTourney();
    this.renderSide();
    this.readyTurn();
  }

  readyTurn() {
    const tr = this.tourney;
    const body = el("div", {}, [
      el("p", { text: t("tourney.readyText", { name: tr.player.name, time: clock(tr.seconds), mode: t("tourney." + tr.mode) }) }),
      el("p", { class: "explain", text: t("tourney." + tr.mode + "Hint") }),
    ]);
    const sheet = openSheet({
      title: tr.humans.length > 1 ? t("tourney.passTo", { name: tr.player.name }) : t("tourney.title"),
      body,
      actions: [button(t("tourney.go"), { kind: "primary", onclick: () => sheet.close() })],
      // closing the sheet any other way also starts the clock; Leave ends a tournament
      onClose: () => {
        if (!this.tourney) return;
        tr.running = true;
        this.resetCast();
      },
    });
  }

  renderTourney() {
    const tr = this.tourney;
    if (!this.tourneyBar) return;
    this.tourneyBar.hidden = !tr;
    if (!tr) return;
    const rows = tr.standings();
    const myRank = rows.findIndex((r) => r.me) + 1;
    const mine = rows.find((r) => r.me);
    this.tourneyBar.innerHTML = "";
    this.tourneyBar.append(
      el("b", { text: tr.player.name }),
      el("span", { class: "tourney-clock" + (tr.left < 20 ? " low" : ""), text: clock(tr.left) }),
      el("span", { text: t("tourney." + tr.mode) + ": " + kgText(mine ? mine.score : 0) }),
      el("span", { class: "muted", text: t("tourney.rank", { n: myRank, of: rows.length }) }),
    );
    if (this.boardEl) {
      this.boardEl.innerHTML = "";
      this.boardEl.append(boardList(rows));
    }
  }

  endTurn() {
    const tr = this.tourney;
    tr.running = false;
    this.fight = null;
    this.reelBox.hidden = true;
    this.resetCast();
    const score = tournamentScore(tr.player.catches, tr.mode);
    if (tr.current < tr.humans.length - 1) {
      const done = tr.player;
      const sheet = openSheet({
        title: t("tourney.timeUp"),
        body: el("p", { text: t("tourney.turnDone", { name: done.name, kg: kgText(score), n: done.catches.length }) }),
        actions: [button(t("common.next"), { kind: "primary", onclick: () => sheet.close() })],
        onClose: () => {
          if (!this.tourney) return;
          tr.current++;
          tr.elapsed = 0;
          this.renderTourney();
          this.readyTurn();
        },
      });
      return;
    }
    const rows = tr.standings(true);
    const place = rows.findIndex((r) => r.human);
    const best = rows[place];
    const reward = core.finishTournament({ won: place === 0, place, score: best.score, mode: tr.mode });
    const body = el("div", {}, [
      el("p", { class: "lead-line", text: place === 0 ? t("tourney.won", { name: best.name }) : t("tourney.result", { name: best.name, n: place + 1 }) }),
      boardList(rows),
      el("p", { class: "explain", text: t("tourney.reward", { n: reward }) }),
    ]);
    this.tourney = null;
    this.renderTourney();
    this.renderSide();
    this.app.audio.chime();
    openSheet({ title: t("tourney.results"), body, actions: [] });
  }

  leave() {
    if (this.tourney) {
      confirmSheet(t("tourney.quit"), () => this.renderList());
      return;
    }
    this.renderList();
  }

  // ---------- scene ----------
  enter(spotId) {
    this.spot = spotById[spotId];
    this.tourney = null;
    const s = core.S();
    if (this.bait !== "worm" && !(s.inv.bait[this.bait] > 0)) this.bait = "worm";
    const root = this.root;
    root.innerHTML = "";
    this.canvas = el("canvas", { role: "img", "aria-label": t("spot." + spotId) + ". " + t("flick.canvasLabel") });
    this.status = el("div", { class: "scene-status", role: "status", "aria-live": "assertive" });
    this.tourneyBar = el("div", { class: "tourney-bar", hidden: true, "aria-live": "off" });
    const wrap = el("div", { class: "scene-wrap" }, [this.canvas, this.status]);
    this.actionBtn = el("button", { type: "button", class: "btn primary big-btn" });
    this.reelBox = el("div", { class: "reel", hidden: true });
    this.rig = this.buildRig();
    this.side = el("aside", { class: "notes" });
    root.append(el("div", { class: "panel-head" }, [
      el("div", {}, [el("h2", { text: t("spot." + spotId) }), el("p", { text: t("spot." + spotId + ".d") })]),
      button(t("fishing.leave"), { icon: "back", kind: "quiet", onclick: () => this.leave() }),
    ]));
    root.append(el("div", { class: "scene" }, [el("div", {}, [this.tourneyBar, wrap, this.rig, this.reelBox, el("div", { style: { marginTop: "12px" } }, [this.actionBtn])]), this.side]));
    this.bindAction();
    this.bindCanvas();
    this.resetCast();
    this.renderSide();
    this.startMotion();
    this.loop();
  }

  // the reel, the drag and the two gauges from the old phone game
  buildRig() {
    this.tensionMeter = el("div", { class: "gauge-bar", role: "meter", "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": t("flick.tension") }, [el("i")]);
    this.fishMeter = el("div", { class: "gauge-bar fish", role: "meter", "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": t("flick.strength") }, [el("i")]);
    this.lineOut = el("b", { text: "0 m" });
    this.gauges = el("div", { class: "gauges" }, [
      el("div", { class: "gauge" }, [el("span", { text: t("flick.tension") }), this.tensionMeter]),
      el("div", { class: "gauge" }, [el("span", { text: t("flick.strength") }), this.fishMeter]),
    ]);
    this.crankCanvas = el("canvas", { "aria-hidden": "true" });
    this.crankEl = el("div", { class: "crank", tabindex: "0", role: "button", "aria-label": t("flick.crankLabel") }, [this.crankCanvas]);
    this.bindCrank();
    this.dragSeg = segmented([0, 1, 2].map((d) => ({ id: String(d), label: t("flick.drag" + d) })), String(this.a.drag), (id) => {
      this.a.drag = +id;
      core.changed();
    }, t("flick.drag"));
    return el("div", { class: "rig", hidden: true }, [
      el("div", { class: "crank-wrap" }, [this.crankEl, el("span", { class: "crank-cap", "aria-hidden": "true" }, [icon("flip", 14), el("span", { text: t("flick.crankCap") })])]),
      el("div", { class: "rig-main" }, [
        el("div", { class: "rig-top" }, [this.gauges, el("div", { class: "line-out" }, [el("span", { class: "muted", text: t("flick.lineOut") }), this.lineOut])]),
        el("div", { class: "rig-drag" }, [el("span", { class: "rig-label", text: t("flick.drag") }), this.dragSeg]),
      ]),
    ]);
  }

  bindCrank() {
    const c = this.crankEl;
    const angleOf = (e) => {
      const r = c.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    };
    c.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      c.setPointerCapture?.(e.pointerId);
      this.crank.drag = true;
      this.crank.last = angleOf(e);
    });
    c.addEventListener("pointermove", (e) => {
      if (!this.crank.drag) return;
      const ang = angleOf(e);
      let d = ang - this.crank.last;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      this.crank.last = ang;
      this.turnCrank(d);
    });
    const up = () => (this.crank.drag = false);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    c.addEventListener("keydown", (e) => {
      if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        this.turnCrank(Math.PI / 3);
      }
    });
  }

  turnCrank(d) {
    this.crank.acc += Math.abs(d);
    this.crank.angle += d;
    this.crank.clickAcc += Math.abs(d);
    if (this.crank.clickAcc > Math.PI / 3) {
      this.crank.clickAcc = 0;
      this.app.audio.click();
    }
  }

  renderSide() {
    if (!this.side) return;
    const s = core.S();
    const a = this.a;
    const now = Date.now();
    const spot = this.spot;
    const side = this.side;
    side.innerHTML = "";
    if (this.tourney) {
      this.boardEl = el("div");
      side.append(el("section", {}, [el("h3", { text: t("tourney.board") }), this.boardEl]));
      this.renderTourney();
    } else this.boardEl = null;
    side.append(el("section", {}, [
      el("h3", { text: t("fishing.now", { phase: t("phase." + phaseOf(now)), weather: weatherLabel(spot.id, now) }) }),
      el("p", { class: "explain", text: t("fishing.timeHint") }),
    ]));
    // controls
    const controls = el("section", {}, [
      el("h3", { text: t("flick.controls") }),
      segmented([{ id: "flick", label: t("flick.modeFlick") }, { id: "classic", label: t("flick.modeClassic") }], a.controls === "classic" ? "classic" : "flick", (id) => {
        a.controls = id;
        core.changed();
        this.resetCast();
      }, t("flick.controls")),
      el("p", { class: "explain", text: t(a.controls === "classic" ? "flick.classicHint" : "flick.flickHint") }),
      el("div", { class: "row toggles" }, [
        button(t("flick.motion"), { kind: "quiet small", pressed: !!a.motion, onclick: () => this.enableMotion(!a.motion) }),
        button(t("flick.haptics"), { kind: "quiet small", pressed: a.haptics !== false, onclick: () => {
          a.haptics = a.haptics === false;
          core.changed();
          this.renderSide();
        } }),
      ]),
      el("p", { class: "explain", text: t("flick.lineNow", { line: t("line." + lineOf(a.line).id), m: castMetres(1, a.line) }) }),
    ]);
    side.append(controls);
    // tackle box
    const baits = el("div", { class: "bait-list", role: "radiogroup", "aria-label": t("fishing.bait") });
    for (const b of core.BAITS) {
      const lure = isLure(b.id);
      const have = s.inv.bait[b.id] || 0;
      const count = b.id === "worm" ? t("food.unlimited") : lure ? (have ? t("tackle.inBox", { n: have }) : t("tackle.none")) : t("food.left", { n: have });
      const locked = core.level() < (b.level || 1);
      const disabled = locked || (b.id !== "worm" && !(have > 0));
      const btn = el("button", { type: "button", class: "bait" + (lure ? " lure" : ""), role: "radio", "aria-checked": String(this.bait === b.id), "aria-pressed": String(this.bait === b.id), disabled }, [
        el("b", { text: t("bait." + b.id) }),
        el("span", { class: "muted", text: locked ? t("common.unlockAt", { n: b.level }) : count }),
        el("small", { text: (lure ? t("tackle.lure") + ". " : "") + t("bait." + b.id + ".d") }),
      ]);
      btn.addEventListener("click", () => {
        if (this.stateName !== "idle") return toast(t("tackle.reelFirst"));
        this.bait = b.id;
        this.renderSide();
      });
      baits.append(btn);
    }
    side.append(el("section", {}, [el("h3", { text: t("fishing.bait") }), baits, el("p", { class: "explain", text: t("fishing.buyBait") })]));
    // biting now, for a middle-distance cast with this tackle
    const list = spotCandidates(spot.id, now, this.bait, 0.5).sort((x, y) => y.w - x.w);
    const total = list.reduce((acc, c) => acc + c.w, 0);
    const chips = el("div", { class: "bite-list" });
    let unknownCount = 0;
    let unknownShare = 0;
    for (const c of list.filter((x) => x.w / total >= 0.01)) {
      const share = c.w / total;
      if (s.journal.fish[c.sp.id]?.count > 0) {
        if (chips.children.length < 6) chips.append(el("span", { class: "tag", text: speciesName(c.sp.id) + " " + Math.round(share * 100) + "%" }));
      } else {
        unknownCount++;
        unknownShare += share;
      }
    }
    const biteSection = el("section", {}, [el("h3", { text: t("fishing.bites") })]);
    if (chips.children.length) biteSection.append(chips);
    if (unknownCount) biteSection.append(el("p", { class: "explain", text: t("fishing.unknownSum", { n: unknownCount, p: Math.round(unknownShare * 100) }) }));
    biteSection.append(el("p", { class: "explain", text: t("flick.distanceHint") }));
    side.append(biteSection);
  }

  // ---------- phone motion ----------
  async enableMotion(on) {
    if (on && typeof DeviceMotionEvent === "undefined") {
      toast(t("flick.motionNone"), "warn");
      on = false;
    }
    if (on && typeof DeviceMotionEvent.requestPermission === "function") {
      try {
        if ((await DeviceMotionEvent.requestPermission()) !== "granted") {
          toast(t("flick.motionDenied"), "warn");
          on = false;
        }
      } catch {
        on = false;
      }
    }
    this.a.motion = on;
    core.changed();
    if (on) {
      this.startMotion();
      toast(t("flick.motionOn"));
    } else this.stopMotion();
    this.renderSide();
  }

  startMotion() {
    if (this.motionHandler || !this.a.motion || typeof window.DeviceMotionEvent === "undefined") return;
    this.motionHandler = (e) => {
      const rr = e.rotationRate || {};
      const rot = Math.max(Math.abs(rr.alpha || 0), Math.abs(rr.beta || 0), Math.abs(rr.gamma || 0));
      const g = e.accelerationIncludingGravity || e.acceleration || {};
      const acc = Math.hypot(g.x || 0, g.y || 0, g.z || 0);
      const p = motionPower(rot, acc);
      const now = performance.now();
      if (p > this.mPeak) {
        this.mPeak = p;
        this.mPeakAt = now;
      }
      // act once the swing has peaked and eased off
      if (this.mPeak > 0.12 && now - this.mPeakAt > 140) {
        const power = this.mPeak;
        this.mPeak = 0;
        if (now < this.mCooldown) return;
        this.mCooldown = now + 900;
        if (this.stateName === "idle") this.cast(power, 0);
        else if (this.stateName === "bite") this.hook();
      }
    };
    window.addEventListener("devicemotion", this.motionHandler);
  }

  stopMotion() {
    if (!this.motionHandler) return;
    window.removeEventListener("devicemotion", this.motionHandler);
    this.motionHandler = null;
  }

  // ---------- input ----------
  bindAction() {
    const btn = this.actionBtn;
    const down = (e) => {
      e.preventDefault();
      this.press(true);
    };
    const up = (e) => {
      e.preventDefault();
      this.press(false);
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointerleave", (e) => {
      if (this.holding) up(e);
    });
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("keydown", (e) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) down(e);
    });
    btn.addEventListener("keyup", (e) => {
      if (e.key === " " || e.key === "Enter") up(e);
    });
  }

  // Space anywhere in the scene works like the big button (unless another control has focus).
  key(e) {
    if (!this.visible || !this.spot || e.code !== "Space") return;
    const tag = document.activeElement?.tagName;
    if (tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "A") return;
    if (document.querySelector(".sheet-backdrop")) return;
    e.preventDefault();
    if (e.type === "keydown" && !e.repeat) this.press(true);
    else if (e.type === "keyup") this.press(false);
  }

  bindCanvas() {
    const cv = this.canvas;
    let samples = [];
    cv.addEventListener("pointerdown", (e) => {
      samples = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }];
      cv.setPointerCapture?.(e.pointerId);
    });
    cv.addEventListener("pointermove", (e) => {
      if (!samples.length) return;
      samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      while (samples.length > 2 && samples[0].t < e.timeStamp - 200) samples.shift();
    });
    cv.addEventListener("pointerup", (e) => {
      if (!samples.length) return;
      samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      this.swipe(samples);
      samples = [];
    });
    cv.addEventListener("pointercancel", () => (samples = []));
  }

  // A flick: speed over the last ~120 ms of the swipe. Crooked flicks lose distance.
  swipe(samples) {
    const end = samples[samples.length - 1];
    let start = samples[0];
    for (const p of samples) {
      if (end.t - p.t <= 120) {
        start = p;
        break;
      }
    }
    const dt = Math.max(16, end.t - start.t);
    const vy = (start.y - end.y) / dt;
    const vx = (end.x - start.x) / dt;
    const st = this.stateName;
    if (vy < 0.25) {
      if (st === "idle") this.setStatus(t("flick.swipeHint"));
      return;
    }
    const straight = vy / Math.hypot(vx, vy);
    if (st === "idle") this.cast(flickPower(vy) * (0.7 + 0.3 * straight), clamp(vx / vy, -0.6, 0.6));
    else if (st === "bite") this.hook();
    else if (st === "waiting" || st === "nibble") this.tooEarly();
  }

  press(isDown) {
    this.holding = isDown;
    const st = this.stateName;
    const now = performance.now();
    if (st === "idle" && isDown) {
      this.stateName = "charging";
      this.chargeStart = now;
    } else if (st === "charging" && !isDown) {
      this.cast(clamp((now - this.chargeStart) / 1200, 0.15, 1), 0);
    } else if (st === "waiting" || st === "nibble") {
      if (this.flick) this.reelHold = isDown;
      else if (isDown) this.tooEarly();
    } else if (st === "bite" && isDown) {
      this.hook();
    } else if (st === "fight") {
      this.reelHold = isDown;
    } else if ((st === "missed" || st === "lost") && isDown) {
      this.resetCast();
    }
    this.renderAction();
  }

  tooEarly() {
    this.setStatus(t("fishing.tooEarly"));
    this.resetCast(900);
  }

  setStatus(text) {
    if (this.status.textContent !== text) this.status.textContent = text;
    this.status.hidden = !text;
  }

  renderAction() {
    const st = this.stateName;
    const label = {
      idle: t("fishing.cast"),
      charging: t("fishing.release"),
      flying: t("fishing.wait"),
      waiting: this.flick ? t("flick.retrieve") : t("fishing.wait"),
      nibble: this.flick ? t("flick.retrieve") : t("fishing.wait"),
      bite: t("fishing.hook"),
      fight: t("flick.holdReel"),
      reel: t("fishing.reelBtn"),
      lost: t("fishing.again"),
      missed: t("fishing.again"),
      result: t("fishing.again"),
    }[st];
    if (this.actionBtn.textContent !== label) this.actionBtn.textContent = label;
    this.actionBtn.disabled = st === "flying" || st === "result";
    this.actionBtn.classList.toggle("danger", st === "bite");
    const showRig = this.flick && ["flying", "waiting", "nibble", "bite", "fight"].includes(st);
    this.rig.hidden = !showRig;
    this.gauges.classList.toggle("idle", st !== "fight");
  }

  resetCast(delay = 0) {
    clearTimeout(this.resetTimer);
    const go = () => {
      this.stateName = "idle";
      this.bobber = null;
      this.reel = null;
      this.fight = null;
      this.reelHold = false;
      this.dist = 0;
      this.reelBox.hidden = true;
      this.setStatus(this.flick ? t("flick.idle") : t("fishing.hold"));
      this.renderAction();
    };
    if (delay) {
      this.stateName = "missed";
      this.renderAction();
      this.resetTimer = setTimeout(go, delay);
    } else go();
  }

  cast(power, aim = 0) {
    if (!core.useBait(this.bait)) this.bait = "worm";
    this.castBait = this.bait;
    const metres = castMetres(power, this.a.line);
    core.recordCast(metres);
    this.castM = metres;
    this.dist = metres;
    this.aim = aim;
    this.stateName = "flying";
    const now = performance.now();
    this.flight = { start: now, dur: 450 + (metres / MAX_CAST) * 550 };
    this.bobber = { dip: 0 };
    const weather = weatherAt(this.spot.id, Date.now());
    let wait = 2.6 + Math.random() * 4.8;
    if (this.castBait === "shrimpbait" || this.castBait === "minnow") wait *= 0.85;
    if (this.castBait === "glowlure") wait *= 0.9;
    if (weather === "rain") wait *= 0.8;
    wait *= 0.9 + 0.3 * (metres / MAX_CAST);
    this.biteNeed = wait;
    this.biteProgress = 0;
    this.nibbles = [wait - 1.5, wait - 0.8].filter((x) => x > 0.9 && Math.random() < 0.8);
    this.app.audio.zip();
    this.vibrate(10);
    this.setStatus(t("flick.castDone", { m: metres }));
    this.renderAction();
    this.renderSide();
  }

  hook() {
    const d01 = clamp(this.dist / MAX_CAST, 0, 1);
    this.pending = rollCatch(this.spot.id, Date.now(), this.castBait, Math.random, d01);
    this.app.audio.bubble(1.6);
    this.vibrate(40);
    if (!this.flick) {
      this.startReel();
      this.renderAction();
      return;
    }
    const sp = fishById[this.pending.sp];
    this.fight = newFight(sp, this.pending.size, this.pending.golden, Math.max(3, this.dist), this.a.line);
    this.lastLineOut = 0;
    this.lastBuzz = 0;
    this.stateName = "fight";
    this.setStatus(t("flick.hooked"));
    this.renderAction();
  }

  // classic controls: keep the fish inside the band
  startReel() {
    const sp = fishById[this.pending.sp];
    this.stateName = "reel";
    this.reel = {
      zone: 0.35,
      zoneV: 0,
      zoneW: clamp(0.36 - sp.rar * 0.035 - (this.pending.golden ? 0.03 : 0), 0.16, 0.36),
      fish: 0.5,
      fishT: 0.5,
      speed: 0.25 + sp.rar * 0.12,
      progress: 0.3,
      last: performance.now(),
    };
    this.reelBox.hidden = false;
    this.reelBox.innerHTML = "";
    this.zoneEl = el("div", { class: "reel-zone" });
    this.fishEl = el("div", { class: "reel-fish" });
    this.progressEl = meter(30, 100, t("fishing.reel"));
    this.progressEl.classList.add("reel-progress");
    const legend = el("div", { class: "reel-legend", "aria-hidden": "true" }, [
      el("span", {}, [el("i", { class: "k-fish" }), t("fishing.keyFish")]),
      el("span", {}, [el("i", { class: "k-zone" }), t("fishing.keyZone")]),
      el("span", {}, [el("i", { class: "k-prog" }), t("fishing.keyProgress")]),
    ]);
    this.reelBox.append(el("div", { class: "reel-track", "aria-hidden": "true" }, [this.zoneEl, this.fishEl]), legend, this.progressEl, el("p", { class: "explain", text: t("fishing.reel") }));
    this.setStatus(t("fishing.reelStatus"));
  }

  updateReel(now) {
    const r = this.reel;
    const dt = Math.min(0.05, (now - r.last) / 1000);
    r.last = now;
    if (Math.abs(r.fish - r.fishT) < 0.02 || Math.random() < dt * r.speed * 0.8) r.fishT = clamp(Math.random(), 0.04, 0.96);
    r.fish += (r.fishT - r.fish) * clamp(dt * (1.2 + r.speed * 2.2), 0, 1);
    r.zoneV += (this.holding ? 2.2 : -1.9) * dt;
    r.zoneV = clamp(r.zoneV, -1.1, 1.1);
    r.zone += r.zoneV * dt;
    if (r.zone < 0) {
      r.zone = 0;
      r.zoneV = Math.max(0, r.zoneV) * 0.3;
    }
    if (r.zone > 1 - r.zoneW) {
      r.zone = 1 - r.zoneW;
      r.zoneV = Math.min(0, r.zoneV) * 0.3;
    }
    const inside = r.fish >= r.zone && r.fish <= r.zone + r.zoneW;
    r.progress = clamp(r.progress + (inside ? 0.3 : -0.2) * dt, 0, 1);
    this.zoneEl.style.left = r.zone * 100 + "%";
    this.zoneEl.style.width = r.zoneW * 100 + "%";
    this.fishEl.style.left = r.fish * 100 + "%";
    this.progressEl.firstChild.style.width = r.progress * 100 + "%";
    this.progressEl.setAttribute("aria-valuenow", String(Math.round(r.progress * 100)));
    if (this.bobber) this.bobber.dip = inside ? 0.6 : 1;
    if (r.progress >= 1) this.landed(0.95);
    else if (r.progress <= 0) {
      this.stateName = "lost";
      this.reelBox.hidden = true;
      this.setStatus(t("fishing.lost"));
      this.renderAction();
    }
  }

  // flick controls: tension against fish strength
  updateFight(now, dt) {
    const f = this.fight;
    fightStep(f, { reel: this.reelInput, drag: this.a.drag }, dt);
    this.dist = f.dist;
    const tension = clamp(f.tension, 0, 1);
    this.tensionMeter.firstChild.style.width = tension * 100 + "%";
    this.tensionMeter.classList.toggle("warn", f.tension > 0.85);
    this.tensionMeter.setAttribute("aria-valuenow", String(Math.round(tension * 100)));
    this.fishMeter.firstChild.style.width = f.stamina * 100 + "%";
    this.fishMeter.setAttribute("aria-valuenow", String(Math.round(f.stamina * 100)));
    if (f.run > 0 && f.lineOut > this.lastLineOut + 0.6) {
      this.lastLineOut = f.lineOut;
      this.app.audio.zip();
    }
    if (f.tension > 0.95 && now - this.lastBuzz > 220) {
      this.lastBuzz = now;
      this.vibrate(15);
    }
    if (f.tension > 0.95) this.setStatus(t("flick.tooTight"));
    else if (f.run > 0) this.setStatus(t("flick.running"));
    else if (f.tension < 0.12) this.setStatus(t("flick.slack"));
    else this.setStatus(t("flick.reelNow"));
    if (f.outcome) this.endFight(f.outcome);
  }

  endFight(outcome) {
    const f = this.fight;
    if (outcome === "landed") return this.landed(f.peak);
    let msg;
    if (outcome === "snap") {
      const lostLure = core.recordSnap(this.castBait);
      msg = t("flick.snap") + (lostLure ? " " + t("flick.lureLost", { lure: t("bait." + this.castBait) }) : "");
      this.vibrate(200);
      if (lostLure && !(core.S().inv.bait[this.castBait] > 0)) this.bait = "worm";
    } else if (outcome === "spooled") msg = t("flick.spooled");
    else msg = t("flick.unhooked");
    this.fight = null;
    this.bobber = null;
    this.reelHold = false;
    this.stateName = "lost";
    this.setStatus(msg);
    this.renderAction();
    this.renderSide();
  }

  landed(peak) {
    this.stateName = "result";
    this.reelBox.hidden = true;
    this.fight = null;
    this.reelHold = false;
    this.renderAction();
    const pending = this.pending;
    const res = core.catchFish(pending, this.spot.id);
    const info = core.recordLanded({ sp: pending.sp, size: pending.size, bait: this.castBait, spotId: this.spot.id, phase: phaseOf(Date.now()), peak, water: this.spot.water });
    info.cast = this.castM;
    this.app.audio.chime();
    this.vibrate([30, 40, 30]);
    if (info.duelBeaten) toast(t("duel.beatenToast", { fish: speciesName(pending.sp) }), "big");
    if (this.tourney) {
      const kg = this.tourney.weighIn(pending);
      toast(t("tourney.weighed", { fish: speciesName(pending.sp), kg: kgText(kg) }));
      this.renderTourney();
      this.resetCast();
      return;
    }
    this.openCatch(res, info);
  }

  openCatch(res, info) {
    const fish = res.fish;
    const sp = fishById[fish.sp];
    const s = core.S();
    let decided = false;
    const entry = { sp: fish.sp, size: fish.size, kg: info.kg, colors: fish.colors, golden: !!fish.golden, ts: Date.now(), spot: this.spot.id, cast: info.cast };
    const cv = el("canvas", { "aria-hidden": "true" });
    const tags = el("div", { class: "row" }, [
      el("span", { class: "tag rar-" + sp.rar, text: t("rar." + sp.rar) }),
      res.isNew ? el("span", { class: "tag", text: t("fishing.newSpecies") }) : null,
      res.isRecord ? el("span", { class: "tag", text: t("fishing.record") }) : null,
      fish.golden ? el("span", { class: "tag gold", text: t("fishing.golden") }) : null,
      info.duelBeaten ? el("span", { class: "tag gold", text: t("duel.won") }) : null,
    ]);
    const photoBtn = button(t("album.take"), { icon: "camera", kind: "quiet small", onclick: () => {
      core.addPhoto(fish, { spot: this.spot.id, cast: info.cast });
      photoBtn.disabled = true;
      toast(t("album.added"));
    } });
    const body = el("div", {}, [
      el("div", { class: "fish-hero" }, [cv, el("div", {}, [
        el("h3", { text: speciesName(fish.sp) }),
        el("div", { class: "muted", text: sp.sci + " · " + fish.size + " cm" }),
        el("div", { class: "catch-stats" }, [el("b", { text: kgText(info.kg) }), el("span", { class: "muted", text: t("flick.kgEst") + (info.cast ? " · " + t("flick.castM", { m: info.cast }) : "") })]),
        tags,
      ])]),
      el("p", { class: "muted", text: t("fishd." + fish.sp) }),
      el("p", { class: "explain", text: t("fish.card.temp", { min: sp.temp[0], max: sp.temp[1] }) + (sp.school ? " · " + t("fish.card.school", { n: sp.school }) : "") + " · " + t("journal.water") + ": " + t("water." + sp.water) }),
      res.frag ? el("p", { class: "tag", text: t("fishing.wildFrag") + (res.frag.pending ? " " + t("fishing.fragPending") : "") }) : null,
      el("div", { class: "row catch-share" }, [
        photoBtn,
        button(t("album.share"), { icon: "share", kind: "quiet small", onclick: () => shareTrophy(entry) }),
        button(t("duel.send"), { icon: "hook", kind: "quiet small", onclick: () => shareDuel(entry) }),
      ]),
    ]);
    requestAnimationFrame(() => fishThumb(cv, fish));
    const homes = s.tanks.filter((tk) => core.canHouse(fish, tk));
    const decide = (fn) => {
      decided = true;
      fn();
      sheet.close();
    };
    const actions = [];
    for (const tk of homes.slice(0, 2)) actions.push(button(t("fishing.putIn", { tank: tk.name }), { kind: "primary", onclick: () => decide(() => core.placeFish(fish, tk.id)) }));
    actions.push(
      button(t("fishing.toBucket") + " (" + core.bucket().length + "/" + core.BUCKET_CAP + ")", { kind: "quiet", disabled: core.bucket().length >= core.BUCKET_CAP, onclick: () => decide(() => core.placeFish(fish, "bucket")) }),
      button(t("fish.card.sell", { n: fishValue(fish) }), { kind: "quiet", onclick: () => decide(() => core.sellFish(fish)) }),
      button(t("fish.card.release"), { kind: "ghost", onclick: () => decide(() => core.releaseFish(fish)) }),
    );
    const sheet = openSheet({
      title: t("fishing.caught") + ": " + speciesName(fish.sp),
      body,
      actions,
      onClose: () => {
        if (!decided) {
          if (core.bucket().length < core.BUCKET_CAP) core.placeFish(fish, "bucket");
          else core.releaseFish(fish);
        }
        this.resetCast();
        this.renderSide();
      },
    });
  }

  // ---------- animation ----------
  loop() {
    cancelAnimationFrame(this.raf);
    this.lastT = performance.now();
    const frame = (time) => {
      if (!this.visible || !this.spot) return;
      this.step(time);
      this.draw(time);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  step(now) {
    const dt = clamp((now - (this.lastT || now)) / 1000, 0, 0.1);
    this.lastT = now;
    // crank speed from how far the handle travelled this frame, smoothed
    const inst = crankSpeed(this.crank.acc, Math.max(dt, 0.008));
    this.crank.acc = 0;
    this.crank.rate += (inst - this.crank.rate) * clamp(dt * 10, 0, 1);
    this.reelInput = Math.max(this.crank.rate, this.reelHold ? 0.8 : 0);
    const st = this.stateName;
    const b = this.bobber;
    if (this.tourney?.running) {
      this.tourney.elapsed += dt;
      this.hudT = (this.hudT || 0) + dt;
      if (this.hudT > 0.25) {
        this.hudT = 0;
        this.renderTourney();
      }
      if (this.tourney.left <= 0) {
        this.endTurn();
        return;
      }
    }
    if (st === "flying" && b) {
      if (now - this.flight.start >= this.flight.dur) {
        this.stateName = "waiting";
        const p = this.lurePos(now);
        this.splash = { x: p.x, y: p.y, s: p.scale, t: now };
        this.app.audio.splash();
        this.renderAction();
      }
    } else if (st === "waiting" || st === "nibble") {
      const lure = isLure(this.castBait);
      const reel = this.flick ? this.reelInput : 0;
      if (reel > 0.02) this.dist = Math.max(0, this.dist - reel * 4.2 * dt);
      // a lure only works while it moves; bait prefers to sit still
      const rate = !this.flick ? 1 : lure ? 0.25 + 1.5 * Math.min(1, reel * 1.6) : reel > 0.5 ? 0.6 : 1;
      this.biteProgress += dt * rate;
      if (this.flick) this.lineOut.textContent = this.dist.toFixed(1) + " m";
      if (this.dist < 2) {
        this.setStatus(t("flick.lureBack"));
        this.stateName = "idle";
        this.bobber = null;
        this.reelHold = false;
        this.renderAction();
        return;
      }
      if (this.nibbles.length && this.biteProgress >= this.nibbles[0]) {
        this.nibbles.shift();
        this.stateName = "nibble";
        b.dip = 0.35;
        this.vibrate(8);
        setTimeout(() => {
          if (this.bobber) this.bobber.dip = 0;
        }, 220);
      }
      if (this.biteProgress >= this.biteNeed) {
        this.stateName = "bite";
        b.dip = 1;
        this.biteEnd = now + (this.flick ? 1300 : 1100);
        this.setStatus(this.flick ? t("flick.bite") : t("fishing.bite"));
        this.app.audio.bubble(1.8);
        this.vibrate(80);
        this.renderAction();
        if (!this.flick) this.actionBtn.focus();
      }
    } else if (st === "bite") {
      if (now > this.biteEnd) {
        this.setStatus(t("fishing.missed"));
        this.stateName = "missed";
        this.bobber = null;
        this.renderAction();
      }
    } else if (st === "reel") {
      this.updateReel(now);
    } else if (st === "fight" && this.fight) {
      this.updateFight(now, dt);
      if (this.fight) this.lineOut.textContent = this.dist.toFixed(1) + " m";
    }
    const targetSide = this.fight ? this.fight.side * (this.fight.run > 0 ? 1 : 0.4) : 0;
    this.sideS += (targetSide - this.sideS) * clamp(dt * 2, 0, 1);
  }

  // where the bobber or lure sits on screen: far casts sit smaller and closer to the horizon
  lurePos(now) {
    const d01 = clamp(this.dist / MAX_CAST, 0, 1);
    const x = 0.3 + 0.56 * d01 + (this.aim || 0) * 0.25 * d01 + this.sideS * 0.08;
    const y = 0.94 - 0.42 * d01;
    const scale = 1 - 0.55 * d01;
    if (this.stateName === "flying" && this.flight) {
      const k = clamp((now - this.flight.start) / this.flight.dur, 0, 1);
      return { x: lerp(0.24, x, k), y: lerp(0.44, y, k) - Math.sin(k * Math.PI) * 0.22, scale: lerp(1, scale, k), flying: true };
    }
    return { x, y, scale };
  }

  drawCrank() {
    const cv = this.crankCanvas;
    if (!cv || this.rig.hidden) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const S = cv.clientWidth;
    if (!S) return;
    if (cv.width !== Math.round(S * dpr)) {
      cv.width = Math.round(S * dpr);
      cv.height = Math.round(S * dpr);
    }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, S, S);
    const c = S / 2;
    const R = S * 0.42;
    const css = getComputedStyle(this.crankEl);
    const ink = css.getPropertyValue("--ink").trim() || "#1d2a27";
    const rule = css.getPropertyValue("--rule").trim() || "#d8d1c2";
    const accent = css.getPropertyValue("--accent").trim() || "#1f5f4a";
    ctx.lineWidth = 2;
    ctx.strokeStyle = rule;
    ctx.beginPath();
    ctx.arc(c, c, R, 0, TAU);
    ctx.stroke();
    // tick marks turn with the spool
    ctx.strokeStyle = rgba(ink.startsWith("#") ? ink : "#1d2a27", 0.35);
    for (let i = 0; i < 12; i++) {
      const ang = this.crank.angle + (i / 12) * TAU;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(ang) * R * 0.78, c + Math.sin(ang) * R * 0.78);
      ctx.lineTo(c + Math.cos(ang) * R * 0.9, c + Math.sin(ang) * R * 0.9);
      ctx.stroke();
    }
    const hx = c + Math.cos(this.crank.angle) * R * 0.62;
    const hy = c + Math.sin(this.crank.angle) * R * 0.62;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(c, c, 5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx, hy, S * 0.09, 0, TAU);
    ctx.fill();
    // speed arc
    ctx.strokeStyle = rgba(accent.startsWith("#") ? accent : "#1f5f4a", 0.5);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c, c, R + 3, -Math.PI / 2, -Math.PI / 2 + this.reelInput * TAU);
    ctx.stroke();
  }

  // A tapered rod with cork grip, reel and line guides, bending toward the tip.
  drawRod(ctx, W, H, bend, tipX, tipY) {
    const x0 = W * 0.06;
    const y0 = H * 0.98;
    const cx = W * (0.14 + bend * 0.2);
    const cy = H * 0.66;
    const at = (t) => [
      (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * tipX,
      (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * tipY,
    ];
    const unit = Math.max(1, Math.min(W, H) / 300);
    ctx.lineCap = "round";
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const [ax, ay] = at(t0);
      const [bx, by] = at(t1);
      ctx.strokeStyle = t0 < 0.2 ? "#b08a5a" : "#2c3a36";
      ctx.lineWidth = (t0 < 0.2 ? 6.5 : 4.2 - t0 * 3.2) * unit;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    // cork rings and a highlight along the blank
    ctx.strokeStyle = "rgba(60,40,20,0.35)";
    ctx.lineWidth = 1;
    for (let t = 0.03; t < 0.2; t += 0.035) {
      const [ax, ay] = at(t);
      ctx.beginPath();
      ctx.arc(ax, ay, 3.2 * unit, 0, TAU);
      ctx.stroke();
    }
    // reel under the rod
    const [rx, ry] = at(0.22);
    ctx.fillStyle = "#3a4642";
    ctx.beginPath();
    ctx.arc(rx + 6 * unit, ry + 7 * unit, 7 * unit, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#c9c4b6";
    ctx.beginPath();
    ctx.arc(rx + 6 * unit, ry + 7 * unit, 3 * unit, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#3a4642";
    ctx.lineWidth = 2 * unit;
    ctx.beginPath();
    ctx.moveTo(rx + 6 * unit, ry + 7 * unit);
    ctx.lineTo(rx + 13 * unit, ry + 11 * unit);
    ctx.stroke();
    // line guides
    ctx.strokeStyle = "#c9c4b6";
    ctx.lineWidth = 1;
    for (const t of [0.42, 0.6, 0.76, 0.9]) {
      const [gx, gy] = at(t);
      ctx.beginPath();
      ctx.arc(gx + 2 * unit, gy + 2 * unit, (2.6 - t * 1.4) * unit, 0, TAU);
      ctx.stroke();
    }
  }

  draw(time) {
    const cv = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth;
    const H = cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const reduce = this.app.reduceMotion();
    paintScene(ctx, W, H, this.spot, Date.now(), reduce ? 0 : time);
    const st = this.stateName;
    const tension = this.fight ? clamp(this.fight.tension, 0, 1.2) : 0;
    // rod, bending with line tension
    const bend = st === "reel" ? 0.04 : st === "charging" ? -0.03 : tension * 0.11;
    const tipX = W * (0.24 + bend * 0.4);
    const tipY = H * (0.44 + bend);
    this.drawRod(ctx, W, H, bend, tipX, tipY);
    const b = this.bobber;
    if (b) {
      const p = this.lurePos(performance.now());
      const bob = p.flying ? 0 : Math.sin(time * 0.004) * 0.004;
      const bx = p.x * W;
      const by = (p.y + bob + b.dip * 0.02 * p.scale) * H;
      const r = Math.max(2.5, 5 * p.scale);
      ctx.strokeStyle = tension > 0.85 ? "rgba(224,116,90,0.95)" : "rgba(240,240,235,0.75)";
      ctx.lineWidth = tension > 0.85 ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      const sag = st === "fight" ? (1 - Math.min(1, tension)) * 26 : 20;
      ctx.quadraticCurveTo((tipX + bx) / 2, Math.max(tipY, by) + sag, bx, by);
      ctx.stroke();
      if (isLure(this.castBait)) {
        const colour = { spinner: "#d9c27a", fly: "#9a7a4a", crankbait: "#c4552f", popper: "#f2efe6", jig: "#3d6f63" }[this.castBait] || "#d9c27a";
        if (!p.flying && this.reelInput > 0.05 && st !== "fight") {
          ctx.strokeStyle = "rgba(255,255,255,0.45)";
          ctx.beginPath();
          ctx.moveTo(bx - 14 * p.scale, by - 3 * p.scale);
          ctx.lineTo(bx, by);
          ctx.lineTo(bx - 14 * p.scale, by + 3 * p.scale);
          ctx.stroke();
        }
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.ellipse(bx, by, r * 1.3, r * 0.7, 0, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = "#f2efe6";
        ctx.beginPath();
        ctx.arc(bx, by - r * 0.8, r, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = this.castBait === "glowlure" ? "#e8c04a" : "#c4552f";
        ctx.beginPath();
        ctx.arc(bx, by - r * 0.8, r, 0, Math.PI);
        ctx.fill();
      }
      if (st === "bite" || st === "reel" || (st === "fight" && this.fight?.run > 0)) {
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 1;
        const k = (time % 700) / 700;
        ctx.beginPath();
        ctx.ellipse(bx, by, (8 + k * 22) * p.scale, (3 + k * 7) * p.scale, 0, 0, TAU);
        ctx.stroke();
      }
    }
    if (this.splash) {
      const k = (time - this.splash.t) / 900;
      if (k < 1 && k >= 0) {
        ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(this.splash.x * W, this.splash.y * H, (6 + k * 30) * this.splash.s, (2 + k * 9) * this.splash.s, 0, 0, TAU);
        ctx.stroke();
      } else if (k >= 1) this.splash = null;
    }
    if (st === "charging") {
      const k = clamp((performance.now() - this.chargeStart) / 1200, 0, 1);
      ctx.fillStyle = "rgba(16,28,26,0.55)";
      ctx.fillRect(W * 0.3, H - 22, W * 0.4, 10);
      ctx.fillStyle = "#e8c04a";
      ctx.fillRect(W * 0.3, H - 22, W * 0.4 * k, 10);
    }
    this.drawCrank();
  }
}
