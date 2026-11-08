# Riak design system

Direction: **Field guide** (won the 4-direction bracket 3-0 and 2-0-1, council judged; see `design-run/bracket/bracket.md`).
The app reads like a naturalist's notebook with a living plate in it: warm paper, deep green ink, serif headings, a framed tank.

## Palette

| token | light | dark | use |
|---|---|---|---|
| `--paper` | `#f5f0e7` | `#141a18` | page background |
| `--card` | `#ffffff` | `#1b2320` | floating cards, plates, sheets |
| `--surface-2` | `#f1ece2` | `#222c28` | tool tiles, inset tracks, inputs |
| `--ink` | `#1d2a27` | `#ece6d8` | body text |
| `--muted` | `#56625e` | `#a9b3ad` | secondary text |
| `--rule` | `#e5ddcf` | `#2f3a36` | hairlines |
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
- Radius (v1.2 depth pass, after Jeda): 18 px cards (`--r`), 26 px plate and sheets (`--r-lg`), 12 to 16 px tiles, full pill for buttons, chips, nav and segmented controls.
- Elevation: warm layered shadows `--shadow-1` (chips, rows), `--shadow-2` (cards), `--shadow-3` (plate, sheets, floating nav); hover lifts 1 to 3 px; press sinks 1 px. Inset tracks (`--surface-2` plus an inner shadow) for meters, segmented controls and inputs.
- Background: warm radial glow at the top of the page over `--paper`.
- Every tap target at least 44 x 44 px.
- Motion: 160 to 220 ms ease-out for sheets and toasts. The tank is the only continuous motion; it slows and dims in focus mode and respects `prefers-reduced-motion` and the in-app setting.

## Layout

- Desktop (> 900 px): top bar, floating pill nav centred under it, left plate (tank) with a caption row and tile tool row, right column of floating note cards (status, to do, water test, today's care).
- Phone: tank on top, tile tool row, note cards below; nav is a floating rounded bar inset 12 px from the edges that reserves its own height (`padding-bottom` on main) so nothing hides behind it. Sheets rise from the bottom with a grab handle.

## Voice

Plain, warm, specific. Tell the keeper what is happening and what to do: "Nitrate is high. A water change lowers it." No exclamation marks, no gamer slang.

## Signature element

The living vector tank: procedurally drawn fish with personalities, a real nitrogen cycle, light schedule and day/night that follows the clock. Since v1.2 it is drawn as a glass box: side panes in one-point perspective, a receding substrate floor, depth haze over far fish and back plants, soft floor shadows under each fish (deeper fish cast theirs further back), a dark lid rim, lit pane edges, a front-glass streak and a stand under the frame. The fishing scenes use atmospheric perspective: a nearer ridge, horizon haze and mist, perspective shimmer, a sun or moon glint column and a lit bank shading the water.

## Banned defaults

Purple or violet, emoji, gradient hero blobs, glassmorphism cards (blur is limited to the sheet backdrop and the phone nav, never over the animated canvases), Inter-only type, centred marketing hero inside the app, hard or coloured drop shadows, neon glows.
