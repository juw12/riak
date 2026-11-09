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
