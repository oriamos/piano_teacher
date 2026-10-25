/**
 * Pure MIDI byte parsing. No browser APIs, so it is testable in Node and
 * usable by the engine's test tooling.
 */

export type MidiMessage =
  | { type: 'noteOn'; channel: number; pitch: number; velocity: number }
  | { type: 'noteOff'; channel: number; pitch: number; velocity: number }
  | { type: 'controlChange'; channel: number; controller: number; value: number }
  | { type: 'other'; status: number; data: number[] }

/**
 * Parse one MIDI message (status byte + data bytes).
 *
 * A note-on with velocity 0 is reported as a note-off, as the MIDI spec
 * allows and as most keyboards (Casio included) send it.
 *
 * @example
 * parseMidiMessage([0x90, 60, 100]) // { type: 'noteOn', channel: 0, pitch: 60, velocity: 100 }
 * parseMidiMessage([0x90, 60, 0])   // { type: 'noteOff', channel: 0, pitch: 60, velocity: 0 }
 */
export function parseMidiMessage(bytes: ArrayLike<number>): MidiMessage {
  const status = bytes[0] ?? 0
  const kind = status & 0xf0
  const channel = status & 0x0f
  const d1 = bytes[1] ?? 0
  const d2 = bytes[2] ?? 0

  switch (kind) {
    case 0x90:
      return d2 === 0
        ? { type: 'noteOff', channel, pitch: d1, velocity: 0 }
        : { type: 'noteOn', channel, pitch: d1, velocity: d2 }
    case 0x80:
      return { type: 'noteOff', channel, pitch: d1, velocity: d2 }
    case 0xb0:
      return { type: 'controlChange', channel, controller: d1, value: d2 }
    default:
      return { type: 'other', status, data: Array.from(bytes).slice(1) }
  }
}

/** Build a note-on message. */
export function noteOn(pitch: number, velocity: number, channel = 0): [number, number, number] {
  return [0x90 | (channel & 0x0f), clamp7(pitch), clamp7(velocity)]
}

/** Build a note-off message. */
export function noteOff(pitch: number, channel = 0): [number, number, number] {
  return [0x80 | (channel & 0x0f), clamp7(pitch), 0]
}

/** Build a control-change message. */
export function controlChange(
  controller: number,
  value: number,
  channel = 0,
): [number, number, number] {
  return [0xb0 | (channel & 0x0f), clamp7(controller), clamp7(value)]
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

/**
 * Scientific pitch name for a MIDI pitch (middle C = 60 = "C4").
 *
 * @example noteName(21) // "A0"
 * @example noteName(108) // "C8"
 */
export function noteName(pitch: number): string {
  const name = NOTE_NAMES[((pitch % 12) + 12) % 12]
  const octave = Math.floor(pitch / 12) - 1
  return `${name}${octave}`
}

/** True for C#, D#, F#, G#, A#. */
export function isBlackKey(pitch: number): boolean {
  const pc = ((pitch % 12) + 12) % 12
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10
}

function clamp7(n: number): number {
  return Math.max(0, Math.min(127, Math.round(n)))
}
