# Riak /hone rubric v1 (frozen 2026-11-08)

Artifact: the Riak web app (cozy aquarium PWA), judged from screenshots at 1440 px and 390 px plus
the feature summary. Goal: a clean, neat, professional, user-friendly cozy aquarium that offers more
interaction than Fin & Fern: Cozy Aquarium (iOS). No emoji, no purple.

## Hard gates (code checker, pass/fail; checker overrides the judges)
- G1 `tests/unit.py` exits 0 (16 simulation tests, no purple hex, no emoji in source).
- G2 `tests/smoke.py`: errors [] and overflow {} at 390 and 1440, every check reached.
- G3 app_audit A1-A8 pass at 1280 and 390 (console errors, overflow, viewport, WCAG AA contrast,
  tap targets, 12 px text floor, img alt, one h1 + title).
- G4 slop_check: 0 blockers.

## Soft criteria (council)
- C1 Visual craft (w=0.30): 4 = generic template look, clashing or flat colours; 7 = coherent palette and type, tank looks pleasant; 10 = distinctive calm field-guide look, tank art is the hero, every screen feels designed.
- C2 Clarity and ease of use (w=0.30): 4 = unclear what to do next, crowded controls; 7 = main actions findable, labels clear; 10 = first-time player knows the next step on every screen, controls grouped and labelled, nothing cramped on a phone.
- C3 Depth of play (w=0.25): 4 = only look at fish; 7 = care, fishing and collection loops; 10 = several interlocking loops (care, fishing minigame, breeding, scaping, greenhouse, reef genetics, orders, journal, focus) that clearly exceed a typical cozy aquarium app.
- C4 Polish and consistency (w=0.15): 4 = misaligned spacing, mixed styles, rough edges; 7 = consistent spacing and components; 10 = pixel-tidy, consistent states, feedback messages unobtrusive and well placed.

Done = all gates pass AND council score >= 8.5. Max 5 rounds; stop after 2 rounds without a kept gain.
