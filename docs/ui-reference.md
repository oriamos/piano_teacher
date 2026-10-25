# UI reference

> **Status: draft from public knowledge, not yet from a REA study.** The spec asks for a
> behavioural black-box study of the reference apps with
> [REA](https://github.com/morluto/rea) (install only from the official sources:
> github.com/morluto/rea, rea.tools, or the `rea-agents` npm package; fake copies carrying a
> trojan have been reported). That study has not been run yet. The patterns below are what is
> observable from ordinary use of the apps and from their public material; items marked
> **verify** need measuring on the real apps before stage 1 commits to them.

The interface does not copy any one app. Each screen takes the patterns from the app that does
that screen best, re-implemented in original code and design.

## Boundaries (binding)

- No decompiling of Synthesia, Flowkey, Melodics, Simply Piano or Duolingo. No extraction of
  code, assets (icons, sounds, fonts, illustrations) or song content. Their licences forbid it
  and it is not needed: the patterns are visible in normal use.
- All code and assets in this repository are original. Dependencies are MIT / Apache / BSD only.
- Neothesia (GPLv3) is read for ideas only. Copying code from it would put this whole project
  under the GPL.

## Pattern map

| Screen                       | Reference              | What we take                                                                    |
| ---------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| Practice (falling notes)     | Synthesia              | Keyboard at the bottom, colour blocks per hand, uncluttered screen              |
| Practice controls            | Flowkey                | Hand select, loop and wait mode in one minimal bar                              |
| Timing feedback, run summary | Melodics               | Early/late marks per note, a score after every run, practice vs perform modes   |
| Home and daily session       | Duolingo               | One big "start" button, streak, visible daily progress                          |
| Song map                     | Melodics, Simply Piano | Song split into parts with a status per part                                    |
| MEMORY (blank screen)        | none                   | Original: dark keyboard, a colour flash only on played notes, thin progress bar |

## Per app

### Synthesia – falling notes

Observed from use:

- Keyboard across the bottom, notes fall from the top; the note reaches the key at the moment
  it should be played. Note length = block height.
- Separate colours per hand (and a lighter shade for black keys) — **adopt**, with our own
  colours (`config.render.rightHandColor` / `leftHandColor`).
- Finger numbers inside blocks — **reject** for now: no fingering data in most MIDI files.
- "Melody practice" waits for the right key (wait mode) — **adopt**; it is the first stage of
  every segment.
- Lookahead of roughly two bars at moderate tempo (**verify** — measure seconds of lookahead
  vs tempo).
- Staff notation overlay — **reject** by design.

Decision: our practice screen is ~70 % falling notes, keyboard below, nothing else on screen
while playing except the small stage/hand/tempo readout in a corner.

### Flowkey – practice controls

- One strip with: hand (L / R / both), loop (A–B), wait mode toggle, tempo. Everything else is
  hidden while playing — **adopt** the strip; our tempo is adaptive so it is a readout, not a
  slider, except in free practice.
- Video of a real pianist above the notes — **reject**; adds nothing for memorisation.
- Section selection by dragging on a bar overview — **modify**: our sections are the engine's
  segments; A–B loop snaps to segment boundaries by default.

### Melodics – feedback and summaries

- Each hit is marked early / late / perfect relative to a timing lane; the colour appears on
  the note itself at the moment of the hit (**verify** the exact delay and colours).
- After each run: accuracy percentage, a breakdown, and a "try again / next" choice — **modify**:
  our summary is a 3-second overlay (accuracy, mean Δ, top hotspot) that continues by itself;
  hands stay on the keys.
- Practice mode (slowed, looped, no score) vs Perform mode (full tempo, scored) — **adopt** as
  practice vs performance modes.
- Lessons arranged as short progressive steps — **adopt** in spirit: our steps are stages per
  segment.

### Duolingo – home and session

- One primary action per visit, a streak counter, a daily goal that fills visibly — **adopt**:
  the home screen is a big "Start session (25 min)" button, the streak and the number of
  reviews due today.
- Gems, leagues, hearts — **reject**; gamification is out of scope.
- Session end screen with what was gained — **adopt** as the session summary (tempo gains,
  stage advances, next review dates).

### Simply Piano / Melodics – song map

- A song shown as a row of parts, each with a state (locked / in progress / done) — **adopt**
  as the segment map: colours by stage, with fade level and tempo per segment; tap a segment
  for free practice.
- Chord / accompaniment simplifications per level — **reject**; we play the actual notes.

### MEMORY screen (original)

No reference app has a "play from memory on a blank screen" mode; this is the project's own
contribution:

- Same dark background and virtual keyboard as the practice screen, so the eye has the same
  anchor.
- Nothing is shown ahead of time. A played note flashes its key in the feedback colour (green
  on time, blue early, orange late, red wrong). A missed note blinks the key it should have
  been.
- A thin progress bar for the segment, so you know where you are without being told what to
  play.
- Hint on demand (tap, or the piano gesture): the next 4 notes appear for one second. Logged.

## Display principles

- Dark, high contrast: the tablet is ~60 cm from the eyes.
- Touch targets ≥ 56 dp.
- Right-hand colour ≠ left-hand colour in both the notes and the keyboard.
- The practice screen works almost without touching: the session advances by itself and the
  basic actions are piano gestures (two lowest keys = restart segment, two highest = next
  item, 5 s of silence in timed mode = pause).

## To do before stage 1

- [ ] Run the REA study on each reference app and replace the **verify** items with measured
      values (lookahead seconds, feedback delay, colours, summary contents).
- [ ] Decide the exact lookahead for falling notes at 60 % vs 100 % tempo.
