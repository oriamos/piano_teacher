/**
 * Scheduled MIDI output (spec rule 4).
 *
 * Everything the piano is asked to play (demonstrations, the auto-hand, the
 * metronome click) is scheduled ahead of time through the `timestamp`
 * argument of `MIDIOutput.send`, never with `setTimeout`. The browser's MIDI
 * thread then fires each message at the right moment regardless of what the
 * main thread is doing.
 */
import { controlChange, noteOff, noteOn } from './messages'

export interface ScheduledNote {
  pitch: number
  velocity: number
  /** Start time, ms, relative to the `startAt` passed to {@link scheduleNotes}. */
  startMs: number
  durationMs: number
  channel?: number
}

/** Send a note-on now (or at `at`, on the performance.now() timeline). */
export function sendNoteOn(
  output: MIDIOutput,
  pitch: number,
  velocity: number,
  channel = 0,
  at?: number,
): void {
  output.send(noteOn(pitch, velocity, channel), at)
}

/** Send a note-off now (or at `at`). */
export function sendNoteOff(output: MIDIOutput, pitch: number, channel = 0, at?: number): void {
  output.send(noteOff(pitch, channel), at)
}

/**
 * Schedule a list of notes to play from `startAt` (performance.now() ms).
 *
 * @returns the absolute time at which the last note ends, so callers can
 * chain phrases or know when the demonstration is over.
 *
 * @example
 * // C major arpeggio, one note every 250ms
 * scheduleNotes(out, [60, 64, 67, 72].map((p, i) => ({ pitch: p, velocity: 90, startMs: i * 250, durationMs: 200 })), performance.now() + 100)
 */
export function scheduleNotes(
  output: MIDIOutput,
  notes: readonly ScheduledNote[],
  startAt: number,
): number {
  let end = startAt
  for (const n of notes) {
    const on = startAt + n.startMs
    const off = on + n.durationMs
    output.send(noteOn(n.pitch, n.velocity, n.channel ?? 0), on)
    output.send(noteOff(n.pitch, n.channel ?? 0), off)
    if (off > end) end = off
  }
  return end
}

/**
 * Silence everything: clear pending scheduled messages and send
 * "all notes off" + "all sound off" on every channel.
 */
export function allNotesOff(output: MIDIOutput): void {
  // `clear()` is in the spec but not yet in TypeScript's lib.dom typings.
  ;(output as MIDIOutput & { clear?: () => void }).clear?.()
  for (let ch = 0; ch < 16; ch++) {
    output.send(controlChange(123, 0, ch))
    output.send(controlChange(120, 0, ch))
  }
}
