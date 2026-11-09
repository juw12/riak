# Riak koi pond /hone rubric v1 (frozen 2026-11-09)

Artifact: the Pond tab of Riak, a koi "ASMR" relax view (watch koi swim, relax with live sound, light
interactions). Judged from 6 screenshots (day, feeding, night at 1440 px; day, sound mixer, calm dusk at
390 px) plus the feature summary. Sound cannot be heard by judges: judge it from the described design only
inside C3. House style: clean, neat, professional, calm; no emoji, no purple.

## Hard gates (code checker overrides judges)
- G1 tests/unit.py passes (i18n parity en/id, no purple hex, no emoji).
- G2 tests/smoke.py: no errors, no overflow at 390 and 1440, pond step reached (9 koi, food eaten).
- G3 app audit + slop_check pass.
- G4 pond_shots.py: no page errors, no horizontal overflow at 390.

## Soft criteria (council)
- C1 Scene art and beauty (w=0.35): 4 = flat clip-art pond, koi look like blobs; 7 = pleasant coherent
  pond, koi recognisable with varied patterns; 10 = a pond you would leave open on a second screen: depth in
  the water, koi with convincing form and colour, light that changes with time of day, composition balanced.
- C2 Calm and relaxing feel (w=0.25): 4 = busy, cluttered, UI competes with the scene; 7 = calm, UI
  mostly out of the way; 10 = the scene dominates, controls are quiet and minimal, a full-screen calm mode
  looks finished, nothing jarring.
- C3 Interaction and sound design (w=0.20): 4 = watch only; 7 = feeding, ripples and a few sound toggles;
  10 = several gentle, discoverable interactions (tap, hold, drag, name cards) and a rich adjustable
  soundscape with moods, sleep timer and clear feedback.
- C4 Usability and polish on desktop and phone (w=0.20): 4 = controls wrap awkwardly, cramped, misaligned;
  7 = tidy on both sizes; 10 = pixel-tidy, controls perfectly sized and placed at both sizes, mixer sheet
  clear and well grouped.

Done = all gates pass AND council score >= 8.5. Max 5 rounds; stop after 2 rounds without a kept gain.
