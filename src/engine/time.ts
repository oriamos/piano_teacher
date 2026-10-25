/**
 * Beat ↔ millisecond conversions (pure).
 */
import { config } from '../config'

/** Milliseconds per beat at `bpm` scaled by `tempoPct` (100 = original). */
export function beatMs(bpm: number, tempoPct = 100): number {
  return 60000 / (bpm * (tempoPct / 100))
}

/**
 * The matching window W for timed mode:
 * `W = min(matching.maxWindowMs, matching.windowBeatFraction · beat)`.
 *
 * @example matchWindowMs(120) // 125 (a quarter of a 500ms beat)
 * @example matchWindowMs(60)  // 150 (capped)
 */
export function matchWindowMs(bpm: number, tempoPct = 100): number {
  return Math.min(
    config.matching.maxWindowMs,
    config.matching.windowBeatFraction * beatMs(bpm, tempoPct),
  )
}

/** Time of `beat` given the time `startT` of `startBeat`. */
export function beatToMs(
  beat: number,
  startBeat: number,
  startT: number,
  msPerBeat: number,
): number {
  return startT + (beat - startBeat) * msPerBeat
}

/** Inverse of {@link beatToMs}. */
export function msToBeat(t: number, startBeat: number, startT: number, msPerBeat: number): number {
  return startBeat + (t - startT) / msPerBeat
}
