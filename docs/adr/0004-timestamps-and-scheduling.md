# 0004 – Timestamps from `performance.now()` / Web MIDI; scheduling through `MIDIOutput.send`

Date: 2026-10-24 · Status: accepted

## Context

Scoring is about milliseconds. `Date.now()` has millisecond resolution at best, is not
monotonic (NTP adjustments, timezone changes) and is on a different timeline from Web MIDI's
event timestamps. `setTimeout` on the main thread is delayed by whatever frame is running and
by Android's background throttling.

## Decision

1. All timestamps in the system are on the `performance.now()` timeline minus the calibrated
   latency offset. `src/midi/clock.ts` is the only module that reads the clock. `Date.now()` is
   forbidden by an ESLint rule in all runtime code.
2. For incoming MIDI the source is `MIDIMessageEvent.timeStamp`, which is a
   `DOMHighResTimeStamp` on the same timeline, set when the message was received rather than
   when the handler ran. The difference between the two is shown on the device-test screen as
   "handling latency".
3. Everything sent to the piano is scheduled with the `timestamp` argument of
   `MIDIOutput.send`. `src/midi/out.ts` is the only module that calls `send`. `setTimeout` is
   never used for musical timing (it is fine for UI state such as "hide this overlay in 3 s").

## Consequences

- Input and output share one clock, so a demonstration scheduled for time T and a key pressed
  at T are directly comparable.
- The calibration pass measures and removes the fixed part of the input delay; the variable
  part (handling latency) is visible per event and is expected to be well under 1 ms when the
  main thread is idle and a few ms during rendering.
- `MIDIOutput.clear()` is used to cancel pending scheduled messages when the user stops a
  demonstration; it is not yet in TypeScript's DOM typings, hence the cast in `out.ts`.
- Spec rule 3 says "`performance.now()` minus the offset"; using the event's `timeStamp` is
  the same timeline read earlier, so the rule is satisfied in substance.
