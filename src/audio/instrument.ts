/**
 * Where sound comes from. Two implementations:
 * - {@link MidiInstrument}: the piano, over MIDI out (the normal case, ADR 0003)
 * - `Synth` in ./synth.ts: a Web Audio synth on the tablet, for practising
 *   without a piano and for development.
 *
 * All times are on the corrected clock (`src/midi/clock.ts`); each instrument
 * converts to its own timeline.
 */
import { getLatencyOffset } from '../midi/clock'
import { controlChange, noteOff, noteOn } from '../midi/messages'

export interface Instrument {
  readonly kind: 'midi' | 'synth' | 'silent'
  /** Schedule a note. `atMs` is corrected time; `durMs` the sounding length. */
  play(pitch: number, velocity: number, atMs: number, durMs: number): void
  /** Sound a note now (user input echo), until `release`. */
  noteOn(pitch: number, velocity: number): void
  release(pitch: number): void
  /** Cancel everything scheduled and silence sounding notes. */
  allOff(): void
}

/** Corrected time → raw performance.now() time. */
function toRaw(atMs: number): number {
  return atMs + getLatencyOffset()
}

export class MidiInstrument implements Instrument {
  readonly kind = 'midi' as const
  constructor(
    private readonly output: MIDIOutput,
    private readonly channel = 0,
  ) {}

  play(pitch: number, velocity: number, atMs: number, durMs: number): void {
    const on = toRaw(atMs)
    this.output.send(noteOn(pitch, velocity, this.channel), on)
    this.output.send(noteOff(pitch, this.channel), on + durMs)
  }
  noteOn(pitch: number, velocity: number): void {
    this.output.send(noteOn(pitch, velocity, this.channel))
  }
  release(pitch: number): void {
    this.output.send(noteOff(pitch, this.channel))
  }
  allOff(): void {
    // `clear()` is in the Web MIDI spec but not yet in TypeScript's DOM typings.
    ;(this.output as MIDIOutput & { clear?: () => void }).clear?.()
    for (let ch = 0; ch < 16; ch++) {
      this.output.send(controlChange(123, 0, ch))
      this.output.send(controlChange(120, 0, ch))
    }
  }
}

export class SilentInstrument implements Instrument {
  readonly kind = 'silent' as const
  play(): void {}
  noteOn(): void {}
  release(): void {}
  allOff(): void {}
}
