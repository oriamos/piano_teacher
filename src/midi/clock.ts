/**
 * The one place that reads the clock (spec rule 3).
 *
 * All timestamps in the system are `performance.now()` minus the calibrated
 * latency offset. `Date.now()` is never used for timing (lint-enforced).
 *
 * Web MIDI's `MIDIMessageEvent.timeStamp` is on the same timeline as
 * `performance.now()` (a DOMHighResTimeStamp relative to `timeOrigin`), and
 * marks when the message was *received* rather than when our handler ran, so
 * it is the preferred source for input events. See docs/adr/0004.
 */

let latencyOffsetMs = 0

/** Set the calibrated offset. Positive = input arrives late; it is subtracted. */
export function setLatencyOffset(ms: number): void {
  latencyOffsetMs = Number.isFinite(ms) ? ms : 0
}

export function getLatencyOffset(): number {
  return latencyOffsetMs
}

/** Current corrected time, ms. */
export function now(): number {
  return performance.now() - latencyOffsetMs
}

/** Raw clock, for scheduling MIDI out (the piano does not need our correction). */
export function rawNow(): number {
  return performance.now()
}

/** Uncorrected time of a received MIDI event (used while calibrating). */
export function rawEventTime(e: { timeStamp: number }): number {
  return e.timeStamp > 0 ? e.timeStamp : performance.now()
}

/** Corrected time of a received MIDI event. */
export function eventTime(e: { timeStamp: number }): number {
  return rawEventTime(e) - latencyOffsetMs
}

/**
 * How long after the message was received our handler is running, ms.
 * This is the "JS handling latency" shown on the device test screen.
 */
export function handlingLatency(e: { timeStamp: number }): number {
  return e.timeStamp > 0 ? performance.now() - e.timeStamp : 0
}
