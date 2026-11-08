# Riak design system

Direction: **Field guide** (won the 4-direction bracket 3-0 and 2-0-1, council judged; see `design-run/bracket/bracket.md`).
The app reads like a naturalist's notebook with a living plate in it: warm paper, deep green ink, serif headings, a framed tank.

## Palette

| token | light | dark | use |
|---|---|---|---|
| `--paper` | `#f5f1e8` | `#141a18` | page background |
| `--card` | `#fffdf8` | `#1b2320` | plates, sheets |
| `--ink` | `#1d2a27` | `#ece6d8` | body text |
| `--muted` | `#56625e` | `#a9b3ad` | secondary text |
| `--rule` | `#d8d1c2` | `#2f3a36` | hairlines |
| `--accent` | `#1f5f4a` | `#6fbf9c` | primary action, active nav |
| `--accent-ink` | `#ffffff` | `#0e1513` | text on accent |
| `--accent-soft` | `#e3ece4` | `#20322b` | selected rows, chips |
| `--warn` | `#8a3b22` | `#e59a7c` | needs, low water quality |
| `--gold` | `#87590c` | `#e2b450` | golden fish, rewards |

AA pairs checked: ink on paper 13.6:1, muted on paper 5.9:1, accent-ink on accent 7.6:1, warn on paper 7.0:1, gold on paper 4.8:1; dark: ink on paper 14.9:1, muted on paper 8.0:1, accent-ink on accent 8.3:1.

No purple anywhere (hues 235 to 335 are banned in data, coral genes and fish colour mutation via `safeHue`). No emoji; icons are inline SVG line icons, 1.6 px stroke.

## Type

- Headings: **Fraunces** 600 (vendored, `fonts/`), sizes 28 / 22 / 18.
- Body and UI: **Source Sans 3** 400 / 600, 16 px base, 1.5 line height, tabular numbers for readings.
- Never Inter-only, never system-only.

## Space, shape, motion

- 4 px base grid; gaps 8 / 12 / 16 / 24.
- Radius 4 px on controls, 2 px on the plate frame, 12 px on bottom sheets (top corners only).
- Every tap target at least 44 x 44 px.
- Motion: 160 to 220 ms ease-out for sheets and toasts. The tank is the only continuous motion; it slows and dims in focus mode and respects `prefers-reduced-motion` and the in-app setting.

## Layout

- Desktop (> 900 px): top bar, left plate (tank) with a caption row and tool row, right notes column (readings, needs, today's care, orders). Nav is a hairline tab row under the brand.
- Phone: tank on top (4:5), tool row, notes stack below; nav moves to a fixed bottom bar that reserves its own height (`padding-bottom` on main) so nothing hides behind it.

## Voice

Plain, warm, specific. Tell the keeper what is happening and what to do: "Nitrate is high. A water change lowers it." No exclamation marks, no gamer slang.

## Signature element

The living vector tank: procedurally drawn fish with personalities, a real nitrogen cycle, light schedule and day/night that follows the clock.

## Banned defaults

Purple or violet, emoji, gradient hero blobs, glassmorphism cards, Inter-only type, centred marketing hero inside the app, pill buttons everywhere, drop shadows heavier than 0 1px 2px.
