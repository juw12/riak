# Riak whole-app /hone run (2026-11-09, "hone this project till 10/10")

## Run queue
- [ ] Baseline w0 = v1.5.1 (rubric v1, 9 shots: the 8 v1.4 shots + pond-1440)
- [ ] Loop rounds from best until done (>= 8.5), plateau (2 stalls) or 5 rounds
- [ ] Ship the best as a release (version bump, tests, push, Pages live check)
- [ ] Sync: README, landing page shot/copy, portfolio card check, Obsidian note + Update Log, lessons, precedent log

## Assumptions
- Assumed: "this project" = the whole Riak app; rubric v1 (frozen 2026-11-08) is reused unchanged, and the judged
  set gains the pond shot because the pond is now a main tab. The baseline is re-scored on that set.
- Assumed: 10/10 is the target, but the stop rules stay (done >= 8.5, plateau after 2 rounds without +0.3 and a
  pair win); the final score is reported as measured, never rounded up.
- Assumed: the biggest lever is hero art (lessons: polish plateaus at ~8.25, pond C1 capped at 7.5 by stylised
  koi), so round 1 is a texture/sprite approach for the fish, not more UI polish.

## Rounds
| round | change | gates | judge score | pairwise | kept? | note |
|---|---|---|---|---|---|---|
| 2026-11-09 22:00 | council score | 8.8 | split: - | Pega-Vision=8.95, Pega-Thinking=9.1, GLM-5.3-Flash=8.25 |
| w0 | baseline v1.5.1 | G1-G4 pass | 8.80 (C1 9, C2 8, C3 10, C4 8; judges 8.95 / 9.10 / 8.25) | - | base | asks: fishing scene depth (2 judges), fish detail, side-column density, de-dup Test water |
| 2026-11-09 22:11 | council score | 9.25 | split: - | Pega-Vision=9.25, Pega-Thinking=8.25, GLM-5.3-Flash=9.25 |
| 2026-11-09 22:12 | council pair | B wins: False | votes A/B/tie 1/0/2 | council-judged (3 judges) |
| w1 | tank caustic net (floor + under surface), substrate carpet, moss, pebbles, cross-section stones; fishing clouds, treeline, hill reflections, wave texture, glitter (all 9 spots); koi keep room while feeding | G1-G4 pass | 9.25 (C1 9, C2 9, C3 10, C4 9) | A 1, B 0, tie 2 | no (pair not won); ideas carried into w2 | asks: Garden hierarchy, Care grid lone tile, tank hero size vs side column, fish detail |

## Handoff (written mid-run, 2026-11-09 15:25)
- Done: w0 baseline 8.80; w1 (scene richness) 9.25 but blind pair A1/B0/tie2 -> not kept (stall 1).
- In progress: w2 = w1 + CSS (tank side column 312px/24px gap, lone Care reading spans the row on phones).
  First smoke run timed out (desktop locked, headless timing); detached retry `run_w2.py` writes `run_w2.done`
  and, if smoke passes, runs `judge_whole.py w0 w2`.
- Left: decide keep (score >= best + 0.3 AND pair win) -> ship as v1.5.2 (VERSION in js/app.js + sw.js, README),
  push riak main, check Pages; landing shot refresh if the tank changed; Obsidian riak.md + Update Log; lessons.md.
- Next command: `python judge_whole.py w0 w2` (if not yet run), then read `riak/docs/hone/whole/w2.json` and `pair_w0_w2.json`.
| 2026-11-09 22:32 | council pair | B wins: False | votes A/B/tie 0/0/3 | council-judged (3 judges) |
| 2026-11-09 22:32 | council score | 8.95 | split: - | Pega-Vision=9.25, Pega-Thinking=8.95, GLM-5.3-Flash=8.55 |

| w2 | w1 + tank side column 312px / 24px gap, lone Care reading spans the row on phones | G1-G4 pass (smoke passed on retry; first run timed out while the desktop was locked) | 8.95 (C1 8, C2 9, C3 10, C4 9) | tie 3 | no | stop: plateau (2 rounds without a kept gain) |

Result: best stays w0 = v1.5.1 at 8.80 (council-judged, 3 judges). w1 reached 9.25 but neither candidate won the blind pair (A1/B0/tie2, then 0/0/3), so nothing new ships to main. The w1+w2 work is kept on branch `hone/whole-w2` for reference.
| 2026-11-09 22:42 | council pair | B wins: True | votes A/B/tie 0/2/1 | council-judged (3 judges) |
| 2026-11-09 22:43 | council pair | B wins: False | votes A/B/tie 0/0/3 | council-judged (3 judges) |

## Re-pair with 2x crops (process change approved by Juwen)
| pair | packet | votes A/B/tie | B wins |
|---|---|---|---|
| w0 vs w1 | 9 shots + 4 zoom crops (tank floor, tank surface, fishing water, pond koi) | 0 / 2 / 1 | yes |
| w0 vs w2 | same | 0 / 0 / 3 | no |

Decision: w1 kept (9.25 >= 8.80 + 0.3 and blind pair won). Shipped as v1.5.2 = w1 code only (tank.js, fishing.js, pond.js); w2's CSS is not shipped. Fishing backdrop now cached per spot/size/2-min slot (smoke had missed timed bites from per-frame scenery cost). Gates v152c: unit, smoke (errors []), audit, slop pass.
Final: council 9.25 (C1 9, C2 9, C3 10, C4 9). Not 10/10.
| 2026-11-10 08:38 | council pair | B wins: False | votes A/B/tie 0/1/2 | council-judged (3 judges) |
| 2026-11-10 08:39 | council score | 8.8 | split: - | Pega-Vision=9.25, Pega-Thinking=8.1, GLM-5.3-Flash=8.8 |


## Run 3: "fix whats still standing between" (2026-11-10)
Run queue
- [x] Fix the w1 judge asks: tank fish detail, koi vs tank style, Garden hierarchy, Care sheet grouping and alert, fishing controls diagram
- [x] Gates for the candidate (unit, smoke errors [], audit, slop)
- [x] Council score + blind pair vs best (w1) with 2x zoom crops of the changed regions
- [ ] Ship the result, verify Pages live
- [ ] Sync: README, landing shot, portfolio card check, Obsidian, lessons, precedent log

Assumed: this is a new loop from best = w1 (v1.5.2), so the stall counter restarts; same rubric v1 and 9-shot set.
Assumed: Playwright 1.60 lost its bundled headless shell; tests fall back to the installed Chrome (same engine the audit tool uses).

| round | change | gates | judge score | pairwise vs w1 | kept? | note |
|---|---|---|---|---|---|---|
| w3 | two-tone scales, rim shade, translucent tail tips, rayed pectoral fan that rows (tank fish); koi fins fixed to point outward, wider rayed tail, scale arcs on every koi, lobed markings, tank-weight outline; Garden stock tiles + source tiles, one primary tray action; Care readings grouped (2x2 chemistry, 3-up condition), warnings first, water-change alert on top below quality 70; fishing gesture strip | 4/4 (unit 26/26, smoke errors [], audit, slop) | 8.80 (C1 8, C2 9, C3 10, C4 8; judges 9.25 / 8.10 / 8.80) | A0 / B1 / tie 2 | no | stall 1; asks: fish still read simple (1 judge), pond lanterns read as grey squares, koi control row discoverability |
| 2026-11-10 08:54 | council score | 8.55 | split: - | Pega-Vision=9.25, Pega-Thinking=8.25, GLM-5.3-Flash=8.55 |
| 2026-11-10 09:10 | council pair | B wins: False | votes A/B/tie 0/1/2 | council-judged (3 judges) |
| 2026-11-10 09:11 | council score | 8.9 | split: - | Pega-Vision=9.55, Pega-Thinking=8.25, GLM-5.3-Flash=x |

| w4 | w3 + pond lanterns redrawn (octagonal stone roof, ridges, finial, warm glow, moved to the bank), specular ridge on tank fish, tank fish +8% size | 4/4 (unit, smoke errors [] on retry, audit, slop) | 8.55 (judges 9.25 / 8.25 / 8.55) | A0 / B1 / tie 2 | no | stall 2 -> plateau |

Judge drift check: w1 re-scored in this session at 8.90 (2 judges answered; first run 9.25). Same-session baseline 8.90 vs w3 8.80 / w4 8.55, so no candidate clears best + 0.3 and none won its blind pair.
Judges split on whether the regrouped Care sheet and the fight-state shot are real gains or just different captured states (Pega-Thinking said "different captured states rather than quality differences").

Decision: stop, plateau (2 rounds without a kept gain). Best stays w1 = v1.5.2 (council 9.25 at its own run, 8.90 re-scored). The w3+w4 work (incl. the koi fin direction bug fix) is kept on branch `hone/whole-w4`, not shipped to main.
Not 10/10.

Run queue (final)
- [x] Fix the w1 judge asks
- [x] Gates for the candidates
- [x] Council score + blind pair vs best for w3 and w4, w1 re-scored for drift
- [x] Ship decision: nothing ships to main (keep rule not met); candidates pushed to `hone/whole-w4`
- [x] Sync: README unchanged (no release), landing shot unchanged, portfolio card check, Obsidian, lessons, precedent log
