# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Stage 1 – basic player.** MIDI (.mid) import with hand assignment by track or by a
  movable pitch split, fixed 4-bar segments, a song library in IndexedDB with three bundled
  public-domain starter songs, and a practice screen with falling notes on a Canvas
  keyboard. Modes: Listen (the piano or the synth plays the range), Wait (the cursor waits for
  each chord; wrong notes are counted), Practice (fixed tempo 40–100 %, per-note
  precise/early/late/wrong/missed feedback, run score). Hand selection with the other hand
  played automatically, A–B loop by bars, metronome and one-bar count-in, fade levels 0–4,
  a 3-second run summary with automatic repeat.
- **No-piano mode.** On-screen and computer-keyboard input, a Web Audio synth as the sound
  sink, and a Sound setting (auto / piano / synth / silent). See ADR 0005.
- Pure engine modules with tests: chord grouping, wait matcher, timed matcher, run scoring,
  beat/ms conversions, and the `PracticeSession` controller driven by a fake clock.
- **Stage 0 – hardware validation.** Device-test screen: Web MIDI enumeration with automatic
  selection of the Casio port, hot-plug with a "piano disconnected" banner, an 88-key virtual
  keyboard that highlights pressed keys by velocity, an event log with per-event handling
  latency, a "play on piano" check that schedules a phrase over MIDI out with Web MIDI
  timestamps, and a latency calibration (metronome clicked by the piano, 8 taps, mean offset
  saved).
- Fixture recorder: capture real piano input as a `test/fixtures/*.json` recording.
- Project skeleton: Vite + React + TypeScript PWA (fullscreen, landscape), `src/config.ts`
  with every threshold from the spec, pure `engine` types, Vitest suite, ESLint rules that
  enforce the engine boundary and the no-`Date.now()` rule, a DOM-free `tsconfig.engine.json`
  typecheck, GitHub Actions CI.
- Documentation: README, SPEC, architecture, algorithms, pedagogy, UI reference (draft), ADRs
  0001–0004, CONTRIBUTING, issue and PR templates.

### Not yet

- Stage 0 and stage 1 pass conditions have **not** been verified on real hardware. Both
  stages were exercised in headless Chromium in no-piano mode and with a mocked MIDI device.
- MusicXML import, density-based segmentation and the piano gestures come with stage 2.
