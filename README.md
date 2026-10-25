# Piano Teacher

A web app (PWA) for an Android tablet that sits on the music stand of a MIDI piano and teaches
you to play **whole songs, both hands, at tempo, from memory**. It listens to the piano over
USB-MIDI, shows falling notes, scores every note you play, and then takes the notes away step
by step until you can play the passage on a blank screen. Mastered passages come back on a
spaced-repetition schedule so you build a repertoire instead of forgetting last month's song.

It is built for a small, closed group of friends who had a few piano lessons as kids and want
to actually finish songs now. Reading staff notation is explicitly **not** a goal.

**Status: stage 0 of 5** – hardware validation. The device-test screen is done; it has not
yet been verified on the real tablet and piano. See [Roadmap](#roadmap).

![Device test screen: virtual keyboard with highlighted keys, input/output checks, latency calibration, event log](docs/screenshots/device-test.png)

_The stage 0 device-test screen (mock piano). A GIF of the practice screen will land with
stage 1._

## How it teaches

Every feature exists to shorten the time until a passage is mastered. The method, from
[docs/pedagogy.md](docs/pedagogy.md):

1. **Hear it first.** The piano itself plays every new segment before you practise it.
2. **Chunk.** Songs are split into 2–4 bar segments; you only move on after mastering one.
3. **Slow and correct before fast.** Wait mode, then an adaptive tempo from 60 % up.
4. **Hands separately**, then together slowly, together at tempo, then from memory.
5. **Drill the hard bits.** Hotspots are detected from your error statistics and looped.
6. **Retrieve, don't re-read.** The falling notes fade out over five levels until the screen is
   blank. Mastery means playing with no visual aid.
7. **Spaced repetition** (SM-2 style) keeps mastered segments alive, always from memory.
8. **Immediate, precise feedback.** Every note is coloured by timing (early / late / wrong).

No points, badges or leaderboards. Progress is the feedback: tempo going up, segments
turning "mastered", reviews getting further apart.

## Hardware

| Part   | Requirement                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Piano  | Any class-compliant USB-MIDI piano. Built for a Casio with a **USB-B ("USB to Host")** socket; no driver needed.               |
| Tablet | Android, 10" or larger, recent Chrome. Used in landscape on the music stand.                                                   |
| Cable  | **USB-C OTG → USB-B.** Prefer an OTG hub with power-delivery passthrough, otherwise the tablet battery drains during practice. |
| Pedal  | Sustain (CC 64) is received and logged, not evaluated in the MVP.                                                              |

If the piano only has 5-pin MIDI DIN sockets, any cheap USB-MIDI interface works.

The piano makes all the sound: your own playing and the demonstrations the app sends back
over MIDI out. The tablet stays silent, so there is no Android audio latency to fight.

## Quick start

```bash
git clone https://github.com/oriamos/piano_teacher.git
cd piano_teacher
npm install
npm run dev          # http://localhost:5173  (also reachable on the LAN via --host)
```

Open it in desktop Chrome or Edge to try the device-test screen; if no MIDI device is
attached you can click the on-screen keyboard.

Useful scripts:

| Script              | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `npm run dev`       | Dev server on all interfaces (HTTP)                                 |
| `npm run dev:https` | Same, over HTTPS with a self-signed certificate                     |
| `npm run check`     | Lint + typecheck (incl. the DOM-free engine check) + tests + build  |
| `npm test`          | Vitest unit tests                                                   |
| `npm run build`     | Production build into `dist/` (installable PWA with service worker) |
| `npm run preview`   | Serve `dist/`                                                       |

### Running on the tablet

Web MIDI only works in a **secure context**: `https://…` or `http://localhost`. Pick one:

1. **`adb reverse` (recommended for development).** Enable USB debugging on the tablet,
   connect it to the dev machine and run `adb reverse tcp:5173 tcp:5173`. Then open
   `http://localhost:5173` on the tablet: `localhost` counts as secure, no certificates
   needed. The piano stays plugged into the tablet's OTG hub.
2. **Self-signed HTTPS.** `npm run dev:https`, then open `https://<dev-machine-ip>:5173` on
   the tablet and accept the certificate warning.
3. **A tunnel.** Any HTTPS tunnel to port 5173 (`cloudflared tunnel --url http://localhost:5173`,
   `ngrok http 5173`, …).
4. **A deployment.** The production build is a static site; a Vercel preview URL is HTTPS.

Then, on the tablet: Chrome → open the URL → allow MIDI when prompted → menu → _Install app_
(or _Add to Home screen_). The installed app opens fullscreen in landscape.

### Connecting the piano

1. Plug the OTG hub into the tablet, the USB-B cable into the piano, power on the piano.
2. Open the app. The device-test screen lists MIDI inputs and outputs and auto-selects the
   port whose name contains "CASIO" (configurable in `src/config.ts`).
3. Press a key: it lights up on the virtual keyboard with its velocity.
4. Press **Play on piano**: the piano should play a C major arpeggio.
5. Run the **latency calibration** once and save the offset.

If you unplug the cable mid-session, a banner appears and the app reconnects by itself when
the piano is back.

## Self-hosting (from stage 4)

The practice engine runs entirely on the tablet; a backend is only needed for multi-user
login, the shared song library and progress sync. That backend is a
[Supabase](https://supabase.com) project on the free tier:

1. Create a Supabase project.
2. Apply the migrations in `supabase/migrations/` (arrives with stage 4) – they create the
   tables listed in [docs/architecture.md](docs/architecture.md) with Row Level Security so
   users only ever see their own progress.
3. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`. The anon key is safe in the client; the `service_role` key must
   never appear anywhere in this repo.
4. Deploy `dist/` to any static host (Vercel is what we use).
5. Sign-up is by invite code. The code is open; your server stays closed.

## Project layout

```
src/
  config.ts   every numeric threshold (windows, percentages, α, EF) – nothing is hard-coded
  midi/       Web MIDI: connection, hot-plug, timestamps, scheduled output, calibration
  engine/     pure TypeScript, no DOM: matching, scoring, state machine, tempo, hotspots, SRS
  content/    (stage 1) MIDI / MusicXML parsing, internal event format, segmentation, hands
  render/     Canvas: virtual keyboard, falling notes, fading levels
  ui/         React screens and controls
  store/      (stage 1) Dexie / IndexedDB and the sync queue
  sync/       (stage 4) Supabase
docs/         architecture, algorithms, pedagogy, UI reference, ADRs
test/fixtures real MIDI recordings (JSON) the engine is tested against
```

Three rules are enforced by tooling, not convention: the engine imports nothing from the UI or
the browser (`tsconfig.engine.json` compiles it without the DOM lib, plus an ESLint rule and a
test); timing never uses `Date.now()` (ESLint); MIDI out is scheduled with Web MIDI timestamps,
never `setTimeout`.

## Roadmap

Each stage ends with a pass condition checked **on the piano**, not just in code.

| Stage | Scope                                                                                  | Pass condition                                                         | Status                         |
| ----- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------ |
| 0     | Hardware validation page                                                               | Note-on from the piano shows on screen; note-on from the tablet sounds | built, awaiting hardware check |
| 1     | Basic player: MIDI import, hand split, falling notes, wait mode, hand select, A–B loop | Play a 4-bar segment in wait mode with correct per-note feedback       | next                           |
| 2     | Practice engine: segmentation, LISTEN, state machine, adaptive tempo, fading, drills   | One whole song goes LISTEN → MASTERED, including stitching             |                                |
| 3     | Spaced repetition and the daily session builder, summaries, stats                      | Two weeks of real daily use without choosing what to practise          |                                |
| 4     | Users: Supabase auth, invite codes, shared library, sync, starter curriculum           | Two friends practise in parallel with separate data                    |                                |
| 5     | Ear training module (echo, scale degrees, chords, songs by ear, transposition)         |                                                                        |                                |

Out of scope by design: staff notation, audio recognition from an acoustic piano, iOS,
gamification and rankings, AI, video lessons.

## Documentation

- [SPEC.md](SPEC.md) – the full specification (Hebrew)
- [docs/architecture.md](docs/architecture.md) – layers, the MIDI event path end to end, the
  internal event format, data model
- [docs/algorithms.md](docs/algorithms.md) – matching, scoring, adaptive tempo, hotspots,
  spaced repetition, fading, session builder, with every threshold and its rationale
- [docs/pedagogy.md](docs/pedagogy.md) – the principles and how each one is implemented
- [docs/ui-reference.md](docs/ui-reference.md) – which UI patterns are borrowed from which
  app, and the rules for doing that legally
- [docs/adr/](docs/adr/) – architecture decision records
- [CONTRIBUTING.md](CONTRIBUTING.md) – dev setup, tests, code style, commits, adding fixtures
- [CHANGELOG.md](CHANGELOG.md)

## License

[MIT](LICENSE). All code and assets are original; dependencies are permissively licensed
(MIT / Apache / BSD). No music under copyright is or will be committed to this repository:
fixtures and seed songs are original or public domain.
