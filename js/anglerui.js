// Angler extras around the fishing scene: tournaments, quests, the photo album, trophy cards and challenge links.
import * as core from "./core.js";
import { t } from "./i18n.js";
import { el } from "./util.js";
import { button, openSheet, toast, segmented } from "./ui.js";
import { SPOTS } from "./data.js";
import { spotById, fishById, rollCatch } from "./sim.js";
import { fishThumb } from "./draw.js";
import { speciesName } from "./tankpanel.js";
import { paintScene } from "./fishing.js";
import { cpuCatches, tournamentScore, questProgress, packDuel, fishKg } from "./angler.js";

export const kgText = (kg) => (kg < 0.1 ? kg.toFixed(3) : kg.toFixed(2)) + " kg";

// ---------- tournament ----------
// One device, one to four people taking turns, against three CPU anglers on a seeded schedule.
export class Tournament {
  constructor({ spotId, mode, seconds, humans }) {
    this.spotId = spotId;
    this.mode = mode;
    this.seconds = seconds;
    this.seed = Date.now() % 2147483647;
    this.humans = Array.from({ length: humans }, (_, i) => ({ name: t("tourney.player", { n: i + 1 }), catches: [] }));
    const pick = (r) => {
      const c = rollCatch(spotId, Date.now(), "worm", r, 0.25 + r() * 0.6);
      return { sp: c.sp, size: c.size };
    };
    this.cpus = cpuCatches(this.seed, spotId, seconds, pick, 3);
    this.current = 0;
    this.elapsed = 0;
    this.running = false;
  }
  get player() {
    return this.humans[this.current];
  }
  get left() {
    return Math.max(0, this.seconds - this.elapsed);
  }
  weighIn(result) {
    const kg = fishKg(result.size);
    this.player.catches.push({ at: this.elapsed, sp: result.sp, size: result.size, kg });
    return kg;
  }
  // CPU scores grow with the clock of the current turn; finished players keep their totals.
  standings(final = false) {
    const until = final ? this.seconds : this.elapsed;
    const rows = [
      ...this.humans.map((h, i) => ({ name: h.name, human: true, me: i === this.current && !final, score: tournamentScore(h.catches, this.mode) })),
      ...this.cpus.map((c) => ({ name: c.name, human: false, score: tournamentScore(c.catches, this.mode, until) })),
    ];
    return rows.sort((a, b) => b.score - a.score);
  }
}

export function clock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

export function boardList(rows) {
  const list = el("ol", { class: "board" });
  rows.forEach((r, i) => {
    list.append(el("li", { class: (r.human ? "human" : "") + (r.me ? " me" : "") }, [
      el("span", { class: "board-rank", text: String(i + 1) }),
      el("span", { class: "board-name", text: r.name }),
      el("span", { class: "board-score", text: kgText(r.score) }),
    ]));
  });
  return list;
}

export function openTournamentSetup(panel) {
  const s = core.S();
  const spots = SPOTS.filter((sp) => s.unlockedSpots.includes(sp.id));
  const cfg = { spotId: panel.spot?.id || spots[0].id, mode: "bigcatch", seconds: 180, humans: 1 };
  const body = el("div", { class: "form-stack" }, [
    el("p", { class: "muted", text: t("tourney.lead") }),
    el("h3", { text: t("tourney.spot") }),
    segmented(spots.map((sp) => ({ id: sp.id, label: t("spot." + sp.id) })), cfg.spotId, (id) => (cfg.spotId = id), t("tourney.spot")),
    el("h3", { text: t("tourney.mode") }),
    segmented([{ id: "bigcatch", label: t("tourney.bigcatch") }, { id: "bigfish", label: t("tourney.bigfish") }], cfg.mode, (id) => (cfg.mode = id), t("tourney.mode")),
    el("p", { class: "explain", text: t("tourney.modeHint") }),
    el("h3", { text: t("tourney.length") }),
    segmented([120, 180, 300].map((n) => ({ id: String(n), label: t("tourney.minutes", { n: n / 60 }) })), String(cfg.seconds), (id) => (cfg.seconds = +id), t("tourney.length")),
    el("h3", { text: t("tourney.players") }),
    segmented([1, 2, 3, 4].map((n) => ({ id: String(n), label: String(n) })), "1", (id) => (cfg.humans = +id), t("tourney.players")),
    el("p", { class: "explain", text: t("tourney.playersHint") }),
  ]);
  const sheet = openSheet({
    title: t("tourney.title"),
    body,
    actions: [button(t("tourney.start"), { kind: "primary", onclick: () => {
      sheet.close();
      panel.startTournament(cfg);
    } })],
  });
}

// ---------- quests ----------
function questHint(q, a) {
  return {
    cast25: Math.min(a.maxCast, 25) + " / 25 m",
    cast40: Math.min(a.maxCast, 40) + " / 40 m",
    land5: Math.min(a.landed, 5) + " / 5",
    kg1: Math.min(a.bestKg, 1).toFixed(2) + " / 1 kg",
    kg5: Math.min(a.bestKg, 5).toFixed(2) + " / 5 kg",
    win: Math.min(a.wins, 1) + " / 1",
    album10: Math.min(a.photos, 10) + " / 10",
  }[q.id];
}

export function questsReady() {
  return questProgress(core.angler()).filter((q) => q.done && !q.claimed).length;
}

export function openQuests(onChange) {
  const render = (b) => {
    b.innerHTML = "";
    const a = core.angler();
    const list = el("div", { class: "quest-list" });
    for (const q of questProgress(a)) {
      const hint = questHint(q, a);
      const right = q.claimed
        ? el("span", { class: "tag", text: t("quest.done") })
        : q.done
          ? button(t("quest.claim", { n: q.reward }), { kind: "primary small", onclick: () => {
            core.claimQuest(q.id);
            render(b);
            onChange?.();
          } })
          : el("span", { class: "tag muted", text: t("quest.reward", { n: q.reward }) });
      list.append(el("div", { class: "list-row quest" + (q.claimed ? " claimed" : "") }, [
        el("div", {}, [el("div", { class: "title", text: t("quest." + q.id) }), hint ? el("div", { class: "sub", text: hint }) : null]),
        right,
      ]));
    }
    b.append(el("p", { class: "muted", text: t("quest.lead") }), list);
  };
  openSheet({ title: t("quest.title"), body: (b) => render(b) });
}

// ---------- trophy card ----------
export function trophyCanvas(entry) {
  const W = 1080;
  const H = 1350;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  const spot = spotById[entry.spot] || SPOTS[0];
  const sceneH = 820;
  paintScene(ctx, W, sceneH, spot, entry.ts || Date.now(), 0);
  const fc = document.createElement("canvas");
  fc.width = 900;
  fc.height = 520;
  fishThumb(fc, entry);
  ctx.drawImage(fc, 90, 250, 900, 520);
  ctx.fillStyle = "#f5f1e8";
  ctx.fillRect(0, sceneH, W, H - sceneH);
  ctx.fillStyle = "#1f5f4a";
  ctx.fillRect(0, sceneH, W, 8);
  const sp = fishById[entry.sp];
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#1d2a27";
  ctx.font = "600 76px Fraunces, Georgia, serif";
  ctx.fillText(speciesName(entry.sp), 72, sceneH + 120);
  ctx.fillStyle = "#56625e";
  ctx.font = "italic 34px 'Source Sans 3', 'Segoe UI', sans-serif";
  ctx.fillText(sp.sci, 72, sceneH + 172);
  ctx.fillStyle = "#1f5f4a";
  ctx.font = "600 60px 'Source Sans 3', 'Segoe UI', sans-serif";
  ctx.fillText(entry.size + " cm  ·  " + kgText(entry.kg), 72, sceneH + 272);
  ctx.fillStyle = "#56625e";
  ctx.font = "32px 'Source Sans 3', 'Segoe UI', sans-serif";
  const when = new Date(entry.ts || Date.now()).toLocaleDateString();
  const castText = entry.cast ? "  ·  " + t("flick.castM", { m: entry.cast }) : "";
  ctx.fillText(t("spot." + spot.id) + "  ·  " + when + castText, 72, sceneH + 336);
  ctx.fillStyle = "#1d2a27";
  ctx.font = "600 34px Fraunces, Georgia, serif";
  ctx.fillText("Riak", 72, H - 56);
  ctx.fillStyle = "#56625e";
  ctx.font = "28px 'Source Sans 3', 'Segoe UI', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("juw12.github.io/riak", W - 72, H - 56);
  ctx.textAlign = "left";
  return cv;
}

async function shareCanvas(cv, filename, text) {
  const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
  if (!blob) return;
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return;
    } catch (e) {
      if (e?.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast(t("album.saved"));
}

export function shareTrophy(entry) {
  const cv = trophyCanvas(entry);
  return shareCanvas(cv, "riak-" + entry.sp + "-" + entry.size + "cm.png", t("album.shareText", { fish: speciesName(entry.sp), size: entry.size }));
}

// ---------- challenge links ----------
export function duelLink(entry) {
  const code = packDuel({ sp: entry.sp, size: entry.size, spot: entry.spot, from: "" });
  return location.href.split("#")[0] + "#duel=" + code;
}

export async function shareDuel(entry) {
  const url = duelLink(entry);
  const text = t("duel.shareText", { fish: speciesName(entry.sp), size: entry.size, spot: t("spot." + entry.spot) });
  if (navigator.share) {
    try {
      await navigator.share({ title: "Riak", text, url });
      return;
    } catch (e) {
      if (e?.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast(t("duel.copied"));
  } catch {
    const input = el("input", { class: "input", value: url, readonly: true, "aria-label": t("duel.link") });
    openSheet({ title: t("duel.link"), body: el("div", {}, [el("p", { class: "muted", text: t("duel.copyHint") }), input]) });
    requestAnimationFrame(() => input.select());
  }
}

// ---------- album ----------
export function openAlbum() {
  const render = (b) => {
    b.innerHTML = "";
    const a = core.angler();
    if (!a.album.length) {
      b.append(el("p", { class: "muted", text: t("album.empty") }));
      return;
    }
    b.append(el("p", { class: "muted", text: t("album.lead", { n: a.album.length }) }));
    const grid = el("div", { class: "album-grid" });
    for (const entry of a.album) {
      const cv = el("canvas", { "aria-hidden": "true" });
      const card = el("div", { class: "album-card" }, [
        cv,
        el("div", { class: "album-meta" }, [
          el("b", { text: speciesName(entry.sp) }),
          el("span", { class: "muted", text: entry.size + " cm · " + kgText(entry.kg) }),
          el("span", { class: "muted", text: (entry.spot ? t("spot." + entry.spot) + " · " : "") + new Date(entry.ts).toLocaleDateString() }),
        ]),
        el("div", { class: "row" }, [
          button(t("album.share"), { icon: "share", kind: "quiet small", onclick: () => shareTrophy(entry) }),
          entry.spot ? button(t("duel.send"), { icon: "hook", kind: "ghost small", onclick: () => shareDuel(entry) }) : null,
        ]),
      ]);
      grid.append(card);
      requestAnimationFrame(() => fishThumb(cv, entry));
    }
    b.append(grid);
  };
  openSheet({ title: t("album.title"), wide: true, body: (b) => render(b) });
}

