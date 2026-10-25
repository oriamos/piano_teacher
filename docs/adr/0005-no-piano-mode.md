# 0005 – No-piano mode: on-screen and computer keyboard input, a Web Audio synth for sound

Date: 2026-10-25 · Status: accepted

## Context

ADR 0003 makes the piano the only sound source. Until the hardware chain is validated, and
whenever someone wants to try the app on a laptop or a tablet without a piano, there has to be
a way to play and to hear demonstrations. The spec allows an on-screen keyboard and Tone.js
"for development and testing only".

## Decision

Two input paths and three sound sinks, behind one `Instrument` interface
(`src/audio/instrument.ts`):

- **Input**: the piano over Web MIDI when present. The on-screen keyboard (tap) and the
  computer keyboard (`A W S E D F T G Y H U J K O L P ; '`, Z/X for octave) always work and
  inject into the same event stream, marked `fromDevice: false`.
- **Sound**: `auto` (default) picks the piano over MIDI out when an output is selected and the
  tablet synth otherwise; `midi`, `synth` and `silent` can be forced in Settings. When the synth
  is the sink, every input note is echoed to it so the on-screen keyboard is audible.
- The synth is a small hand-written Web Audio instrument (three harmonics, fast attack,
  piano-like decay, one low-pass), not Tone.js. Scheduling converts corrected time →
  `performance.now()` → `AudioContext.currentTime` at schedule time, so demonstrations are
  fired by the audio thread, matching the MIDI-out path's immunity to main-thread jank.

## Consequences

- The practice engine does not know which mode it is in: it schedules `ScheduledOut` items
  and the adapter routes them. Tests of the engine cover both modes by construction.
- No new dependency: Tone.js would add ~300 kB for a synth we would not otherwise use, and
  its sampler would fetch piano samples from a CDN, which breaks offline use. If sound quality
  in no-piano mode matters later, a local sample set behind the same interface is the upgrade
  path.
- The synth's output latency on Android (typically 20–40 ms) applies to the _echo_ of your own
  notes in no-piano mode. It does not affect scoring, which uses input timestamps, and it does
  not exist in piano mode, where the piano makes the sound itself.
- The calibration pass in Settings still works in no-piano mode (the click goes to the synth
  and the visual dot runs), but the offset it measures is meaningless without a real input
  chain; the UI says so.
