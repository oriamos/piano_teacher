/**
 * Turn a stream of input events into a `Recording` fixture (pure).
 * The device-test screen uses this to capture real playing for the engine's
 * unit tests; see test/fixtures/README.md.
 */
import type { Recording, RecordedEvent } from '../engine/types'
import type { MidiMessage } from './messages'

export interface TimedMessage {
  message: MidiMessage
  /** Any monotonic clock, ms. */
  t: number
}

/**
 * Build a recording. Times are rebased so the first event is at t = 0 and
 * rounded to 0.1 ms. Messages other than note-on/off/CC are dropped.
 *
 * @example
 * toRecording([{ t: 1000.04, message: { type: 'noteOn', channel: 0, pitch: 60, velocity: 90 } }], 'x', 'desc', 'piano').events
 * // [{ t: 0, type: 'on', n: 60, v: 90 }]
 */
export function toRecording(
  items: readonly TimedMessage[],
  name: string,
  description: string,
  source: Recording['source'],
  bpm?: number,
): Recording {
  const t0 = items[0]?.t ?? 0
  const events: RecordedEvent[] = []
  for (const { message: m, t } of items) {
    const rt = Math.round((t - t0) * 10) / 10
    if (m.type === 'noteOn') events.push({ t: rt, type: 'on', n: m.pitch, v: m.velocity })
    else if (m.type === 'noteOff') events.push({ t: rt, type: 'off', n: m.pitch, v: m.velocity })
    else if (m.type === 'controlChange')
      events.push({ t: rt, type: 'cc', n: m.controller, v: m.value })
  }
  const rec: Recording = { name, description, source, events }
  if (bpm !== undefined) rec.bpm = bpm
  return rec
}
