# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

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

- Stage 0 pass condition has **not** been verified on real hardware yet (waiting for a run on
  the tablet + Casio).
