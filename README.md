# Riak: Cozy Aquarium

A calm aquarium you look after a few minutes a day. Catch fish in nine places, settle them into a planted
tank, keep the water clean, grow plants in a greenhouse, breed corals, and fill a field journal.
Riak means "ripple" in Indonesian.

**Play:** https://juw12.github.io/riak/ (works offline after the first visit, installs as an app)

Inspired by cozy aquarium games such as *Fin & Fern: Cozy Aquarium* (iOS). Riak is a separate,
free, open-source web app: no account, no ads, no purchases, and it runs on any phone or computer with a
modern browser.

## What you can do

- **Tank** - a living vector aquarium. Fish swim, school, sleep at night and wake for food. Tap a fish to
  meet it (name, personality, mood and size). Tap the glass and the curious ones come to look.
- **Real water care** - waste becomes ammonia, then nitrite, then nitrate. Plants pull nitrate down, algae
  grows on the glass, the heater sets the temperature. Test the water, do a water change, wipe the glass,
  trim plants (trimmings become cuttings).
- **Fishing** - 9 spots (pond, rice paddy, stream, mangrove, blackwater, lagoon, glacier lake, open ocean,
  harbour) with their own weather, day and night, and catch lists. 47 species across 5 rarities, golden
  variants, a bucket for fish you are not ready to place.
- **Flick fishing** - the controls of the 2008 iPhone game *Flick Fishing*, rebuilt for the web: swipe up on
  the water to cast (speed and a straight flick set the distance), flick again to strike, then turn the
  on-screen reel. Watch line tension against fish strength, set the drag, and let the fish run when the line
  goes red or it snaps. Long casts reach deeper water and bigger fish. Optional phone-motion casting and
  vibration. The old hold-the-button controls stay available as *Classic*.
- **Tackle** - 5 baits (used up per cast) and 5 lures (kept until a line snaps, and they only work while you
  reel) that each favour different fish, plus 12 lb and 20 lb line upgrades.
- **Tournaments** - 2, 3 or 5 minute rounds scored as *Big catch* or *Big fish*, against three CPU anglers,
  with up to four people taking turns on one device. Fish are weighed in and released.
- **Quests, album and challenges** - 12 angler quests, a photo album with shareable trophy cards, and
  challenge links: send a friend your catch and their Riak asks them to beat it. No server involved.
- **Breeding** - happy adult pairs in a roomy tank have fry; colours mix from both parents.
- **Aquascaping** - 16 aquatic plants, 8 hardscape pieces, 3 substrates, 3 tank sizes, a second tank and a
  reef room for saltwater.
- **Greenhouse** - grow plants from cuttings in trays, harvest them for the tank or sell houseplants.
  Rare variegated sports appear now and then.
- **Reef lab** - frag and cross corals. Each strain has a form, two colours and a pattern, and gets a name.
- **Orders and daily care** - a short care list each day (feed, test, wipe) with a streak, plus daily
  orders that pay shells.
- **Journal** - fish dex with silhouettes until caught, best size, spots and hints; plants, coral strains and
  18 milestones.
- **Focus** - a calm tank timer for 15 to 60 minutes with weekly totals and box breathing.
- **Watch mode** - a full-screen tank with a clock that keeps the screen awake, for a desk or a spare tablet.
- **Share** - a link that opens your tank read-only for a friend, and a photo export.
- **Offline time** - when you come back, Riak plays the hours you were away (up to a cap) and tells you what
  changed.
- English and Bahasa Indonesia, light and dark themes, reduced motion, sound and music settings,
  export and import of your save.

## Run it locally

No build step and no dependencies. Serve the folder with any static server:

```
python -m http.server 8000
```

then open http://localhost:8000/.

## Tests

Needs Python 3 with Playwright (`pip install playwright` and `playwright install chromium`).

- `python tests/unit.py` - 26 simulation tests in a real browser (deterministic world, nitrogen cycle,
  plant uptake, breeding, offline catch-up, share link round trip, coral genetics, levels, catch rolls,
  save migration, the reel fight (careful reeling lands, cranking flat out snaps, idle loses the fish),
  tackle and distance odds, CPU anglers, challenge links, quests, no purple colours, English and Indonesian key parity) plus a static scan of the source
  for purple hex colours and emoji.
- `python tests/smoke.py` - full end-to-end play at 390 px and 1440 px: onboarding, feeding, care, shop,
  scaping, fishing to a catch, garden, reef, journal, focus, settings, share link, visit mode and save
  persistence, with screenshots and an overflow check.

## Privacy

Everything stays in your browser (localStorage). Nothing is sent anywhere. A share link carries only the
tank layout and fish you chose to share, inside the link itself.

## Design

Design notes, colour tokens and contrast ratios are in `design.md`. Fonts (Fraunces, Source Sans 3) are
vendored under the SIL Open Font License.

## Licence

MIT, see `LICENSE`.
