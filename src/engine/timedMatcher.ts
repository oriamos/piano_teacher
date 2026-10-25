/**
 * Timed mode: each played note is matched to the nearest unmatched expected
 * note of the same pitch inside the window W, and classified by its timing
 * deviation Δ (actual − expected).
 */
import { config } from '../config'

export interface TimedExpected {
  id: string
  pitch: number
  /** Absolute expected onset, ms. */
  onsetMs: number
}

export type NoteClass = 'precise' | 'early' | 'late'

export type TimedResult =
  | { kind: 'hit'; noteId: string; pitch: number; deltaMs: number; cls: NoteClass }
  | { kind: 'extra'; pitch: number }

export interface TimedStats {
  expected: number
  hits: number
  extra: number
  missed: number
  /** Δ of every hit, ms. */
  deltas: number[]
}

export class TimedMatcher {
  private matched = new Set<string>()
  private missed = new Set<string>()
  readonly stats: TimedStats

  constructor(
    private readonly expected: readonly TimedExpected[],
    readonly windowMs: number,
    private readonly preciseMs = config.matching.preciseMs,
  ) {
    this.stats = { expected: expected.length, hits: 0, extra: 0, missed: 0, deltas: [] }
  }

  /** Feed a note-on at corrected time `t`. */
  onNoteOn(pitch: number, t: number): TimedResult {
    let best: TimedExpected | null = null
    let bestDelta = Infinity
    for (const e of this.expected) {
      if (e.pitch !== pitch || this.matched.has(e.id) || this.missed.has(e.id)) continue
      const d = t - e.onsetMs
      if (Math.abs(d) <= this.windowMs && Math.abs(d) < Math.abs(bestDelta)) {
        best = e
        bestDelta = d
      }
    }
    if (!best) {
      this.stats.extra++
      return { kind: 'extra', pitch }
    }
    this.matched.add(best.id)
    this.stats.hits++
    this.stats.deltas.push(bestDelta)
    const cls: NoteClass =
      Math.abs(bestDelta) <= this.preciseMs ? 'precise' : bestDelta < 0 ? 'early' : 'late'
    return { kind: 'hit', noteId: best.id, pitch, deltaMs: bestDelta, cls }
  }

  /**
   * Advance the clock: every unmatched expected note whose window has closed
   * becomes a miss. Returns the ids that were missed by this call.
   */
  tick(t: number): string[] {
    const out: string[] = []
    for (const e of this.expected) {
      if (this.matched.has(e.id) || this.missed.has(e.id)) continue
      if (t > e.onsetMs + this.windowMs) {
        this.missed.add(e.id)
        this.stats.missed++
        out.push(e.id)
      }
    }
    return out
  }

  /** Mark everything still open as missed (end of run). */
  finish(): string[] {
    return this.tick(Infinity)
  }
}
