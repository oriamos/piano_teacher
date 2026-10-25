# 0003 – The piano is the only sound source

Date: 2026-10-24 · Status: accepted

## Context

The app needs to play things: demonstrations ("play it for me"), the other hand while one
hand is practised, the metronome and the calibration click. The tablet could synthesise these
(Web Audio / Tone.js) or send them to the piano over MIDI out.

## Decision

Everything audible comes from the piano over MIDI out. The tablet makes no sound in normal
operation. An on-screen keyboard exists for development without hardware; a Tone.js fallback,
if ever added, is for that purpose only.

## Consequences

- No Android audio latency to compensate; the player's own notes are heard with the piano's
  zero-latency sound engine, and demonstrations use the same timbre the player hears from
  their own hands.
- All MIDI out is scheduled ahead of time through the `timestamp` argument of
  `MIDIOutput.send` (see ADR 0004), so main-thread work cannot make a demonstration stutter.
- The metronome click is a short high piano note (`config.calibration.metronomePitch`,
  channel 0) rather than a GM percussion sound, because not every Casio model exposes a drum
  kit on channel 10. If the model does, change the two config values.
- A piano with MIDI in but no USB-B needs a USB-MIDI interface; a piano with MIDI out only
  (no MIDI in) would lose the demonstrations. The pass condition for stage 0 checks both
  directions for exactly this reason.
