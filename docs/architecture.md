# Architecture

All practice logic runs on the tablet so that nothing on the network can add latency while you
play. The server (from stage 4) only handles identity, the shared song library and syncing
aggregated progress.

## Layers

```
┌───────────────────────────────────────────────────────────────────────┐
│ Piano (Casio, USB-B)                                                  │
│   plays your notes · plays demonstrations and the auto-hand (MIDI in) │
└──────────────▲────────────────────────────────────────────┬───────────┘
               │ USB-MIDI (note-on/off, CC64)               │ MIDI out, timestamped
┌──────────────┴────────────────────────────────────────────▼───────────┐
│ Tablet – Chrome PWA                                                   │
│                                                                       │
│  src/midi    Web MIDI: ports, hot-plug, timestamps, scheduled output  │
│      │ PlayedNote {pitch, velocity, t}                                │
│      ▼                                                                │
│  src/engine  pure TS: matching · scoring · stage machine · tempo ·    │
│              hotspots/drills · SRS · session builder                  │
│      │ feedback events, stage/tempo/fade decisions, aggregates        │
│      ▼                                                                │
│  src/render  Canvas 2D: falling notes, virtual keyboard, fade levels  │
│  src/ui      React: screens, controls                                 │
│  src/store   Dexie (IndexedDB): songs, progress, attempts, raw events,│
│              sync queue                                               │
│  src/content MIDI / MusicXML → ExpectedNote[] → segments, hands       │
└──────────────────────────────┬────────────────────────────────────────┘
                               │ aggregates only (attempts, note_stats, progress)
┌──────────────────────────────▼────────────────────────────────────────┐
│ Supabase (stage 4): Auth · Postgres + RLS · Storage (song files)      │
└───────────────────────────────────────────────────────────────────────┘
```

The engine is the only component with logic. `render` and `ui` are views over engine state;
`midi` and `store` are adapters. The same engine will drive the ear-training module (stage 5),
where exercises are generated instead of loaded from files.

### Dependency rules (enforced)

| Rule                                                                         | Enforced by                                                                                                             |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `engine` imports nothing from `ui`, `render`, `store`, `sync` or the browser | `tsconfig.engine.json` (compiles without the DOM lib), ESLint `no-restricted-imports`, `test/engine-boundaries.test.ts` |
| No `Date.now()` for timing                                                   | ESLint `no-restricted-properties`                                                                                       |
| MIDI out via the `timestamp` argument of `MIDIOutput.send`                   | Only `src/midi/out.ts` touches `send`; code review                                                                      |
| Every threshold in `src/config.ts`                                           | Code review; `config.ts` is the only file with magic numbers                                                            |

## A MIDI event, end to end

What happens between a key going down and the screen reacting (target: under 30 ms).

1. **Piano → USB.** The piano sends `90 3C 64` (note-on, C4, velocity 100). Casio pianos
   send note-off as note-on with velocity 0; `parseMidiMessage` normalises that.
2. **Browser.** Chrome's MIDI service stamps the message with a `DOMHighResTimeStamp` on the
   `performance.now()` timeline and dispatches `MIDIMessageEvent` to the selected input's
   `onmidimessage`. This runs on the main thread, outside any React render.
3. **`src/midi/access.ts`.** `MidiManager` parses the bytes, computes
   `t = event.timeStamp − latencyOffsetMs` (`clock.eventTime`) and the handling latency
   `performance.now() − event.timeStamp`, and emits a `MidiInputEvent` to its listeners
   synchronously.
4. **Engine (stage 1+).** The matcher receives `{pitch, velocity, t}` and classifies it
   against the expected notes (precise / good-early / good-late / wrong / extra), updating
   the cursor in wait mode. Pure function calls, no allocation beyond the result.
5. **Render.** Listeners that draw (the keyboard, the falling notes) mutate a `pressed` map and
   request one animation frame. The next frame draws every change at once. React state is
   only touched for things that can wait a frame (the event log, summaries).
6. **Store.** The raw event is appended to the current attempt's buffer and written to
   IndexedDB when the attempt ends, not per note.

Output goes the other way: `scheduleNotes(output, notes, startAt)` calls `output.send(bytes,
startAt + offset)` for every note-on and note-off up front; Chrome's MIDI thread fires them on
time whatever the main thread is doing.

### Why `event.timeStamp` rather than `performance.now()` in the handler

Both are on the same clock. `timeStamp` is set when the message is received, before the event
is queued on the main thread, so it is immune to a frame that is already in progress. The
spec's rule 3 ("all timestamps are `performance.now()` minus the offset") is satisfied: it is
the same timeline, read a little earlier. ADR 0004 has the details.

## Internal event format

Defined in `src/engine/types.ts`. Everything the content layer produces and everything the
piano sends is reduced to these two shapes:

```ts
interface ExpectedNote {
  id: string
  pitch: number // MIDI 0..127
  onsetBeat: number // beats from the start of the song
  durBeats: number
  hand: 'RH' | 'LH'
  segmentId: string
}

interface PlayedNote {
  pitch: number
  velocity: number
  t: number // ms, performance.now() − latencyOffsetMs
  tOff?: number
}
```

Expected notes whose onsets are within `config.midi.chordGroupWindowMs` (30 ms) of each other
are grouped into a chord; wait mode advances per group.

Recordings (`test/fixtures/*.json`) use a third shape, `RecordedEvent {t, type, n, v}`, which is
just the raw MIDI stream with relative times. Tests replay those into `PlayedNote`s.

## Data model

Tables as they will exist in Supabase (stage 4). Until then the same shapes live in Dexie, with
`user_id` present from day one.

| Table              | Key fields                                                                                   | Owner  |
| ------------------ | -------------------------------------------------------------------------------------------- | ------ |
| `profiles`         | id, name, latency_offset_ms, settings                                                        | user   |
| `invites`          | code, created_by, used_by, expires_at                                                        | admin  |
| `songs`            | id, title, composer, source_type, file_path, difficulty, uploaded_by                         | shared |
| `segments`         | id, song_id, index, start_beat, end_beat, difficulty, parent_ids (for stitched segments)     | shared |
| `curriculum_items` | order, song_id, level                                                                        | admin  |
| `segment_progress` | user_id, segment_id, stage, tempo_pct, fade_level, srs_interval, srs_ef, due_at, mastered_at | user   |
| `attempts`         | id, user_id, segment_id, mode, hand, tempo_pct, acc, timing, started_at, duration_ms         | user   |
| `note_stats`       | user_id, segment_id, note_id, err_rate, mean_delta_ms, n                                     | user   |
| `sessions`         | id, user_id, started_at, planned_items, completed_items, minutes                             | user   |

Raw note-on/off events of every attempt are stored **locally only**, for
`config.storage.rawEventRetentionDays` (30) days. Only `attempts` and `note_stats` aggregates
sync to the server. RLS on every user-owned table means a user never sees another's progress.

## Stack

| Layer         | Choice                                    | Why                                                                              |
| ------------- | ----------------------------------------- | -------------------------------------------------------------------------------- |
| Frontend      | Vite, React, TypeScript, vite-plugin-pwa  | Installable PWA on the tablet, fullscreen landscape                              |
| MIDI in/out   | Web MIDI API                              | Native in Chrome on Android, needs HTTPS. Out drives listening, demos, auto-hand |
| Falling notes | Canvas 2D + requestAnimationFrame         | Enough for 60 fps with 300 notes; WebGL not needed (ADR 0001)                    |
| File parsing  | @tonejs/midi, a MusicXML parser (stage 1) | One internal event format                                                        |
| Engine        | Pure TypeScript                           | Unit-tested against recordings; reused by the ear-training module                |
| Local store   | IndexedDB via Dexie (stage 1)             | Offline practice, sync queue (ADR 0002)                                          |
| Backend       | Supabase: Auth, Postgres + RLS, Storage   | Free at this scale; RLS separates users                                          |
| Hosting       | Vercel                                    | Static site                                                                      |

## The practice loop (stage 1)

`PracticeSession` (`src/engine/practice.ts`) is the controller for one run of one bar range in
one mode. It is pure: it receives `now()`, `emit(event)`, `schedule(notes)` and
`cancelScheduled()` from its caller and is driven by `noteOn` / `tick`. The browser adapter
(`src/ui/player/usePractice.ts`) supplies the corrected clock, routes `schedule` to the current
`Instrument`, feeds MIDI input in, and calls `tick` once per animation frame.

```
MIDI / screen / keys ──▶ MidiManager ──▶ PracticeSession.noteOn ──▶ Wait- or TimedMatcher
                                             │                              │
                       rAF ──▶ tick ◀────────┘          feedback / advance / runEnd events
                                                                            │
          Instrument (piano over MIDI out, or Synth) ◀── schedule ◀─────────┤
          FrameState (feedback map, playhead, targets) ◀────────────────────┘
                     │
          PracticeCanvas: drawFallingNotes + drawKeyboard, every frame
```

Per-note feedback never goes through React state: the session writes into a plain
`FrameState` object that the canvas reads on the next frame. React only re-renders for things
that can wait (phase changes, the wrong-note counter, the run summary).

## Two modes

`src/ui/io.ts` decides where input comes from and where sound goes (ADR 0005). The engine
does not know which mode is active. In piano mode `Instrument` is `MidiInstrument` (scheduled
`MIDIOutput.send`); in no-piano mode it is `Synth` (Web Audio, scheduled on the audio clock),
and input notes are echoed to the synth so the on-screen keyboard is audible.

## Current state

Implemented: `src/midi`, `src/audio`, `src/content` (MIDI and MusicXML import, hands,
density segmentation with per-segment difficulty), `src/engine` (types, time, groups, wait/timed matchers, scoring, practice
session), `src/render` (keyboard, falling notes with fade levels), `src/store` (songs,
settings), `src/ui` (library, practice, settings with the device test). Not yet: manual editing of
segment boundaries, repeat expansion in MusicXML, the stage machine / adaptive tempo / hotspots / SRS / session
builder (stage 2–3), progress tables, sync (stage 4). The latency offset still lives in
`localStorage`; it moves to the settings table with the stage 2 store work.
