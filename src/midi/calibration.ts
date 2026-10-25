/**
 * Latency calibration maths (pure).
 *
 * The user plays along with a metronome that the piano itself clicks (over
 * MIDI out). Each tap is compared with the nearest beat; the average
 * deviation becomes the latency offset that is subtracted from every
 * timestamp afterwards (spec rule 3).
 */

export interface CalibrationResult {
  /** Signed deviation of each accepted tap from its nearest beat, ms. */
  deltas: number[]
  /** Taps that were further than `maxDeviationMs` from any beat. */
  rejected: number
  meanMs: number
  medianMs: number
  /** Sample standard deviation of the deltas (0 for fewer than two taps). */
  sdMs: number
}

/**
 * Compute the latency offset from tap times and beat times.
 *
 * Both arrays are on the same clock (performance.now()). Positive mean means
 * the taps arrived AFTER the beats, i.e. the chain piano → USB → browser adds
 * that much delay (plus whatever the player's own lag is).
 *
 * @example
 * computeOffset([1010, 2012], [1000, 2000]).meanMs // 11
 */
export function computeOffset(
  tapTimes: readonly number[],
  beatTimes: readonly number[],
  maxDeviationMs = Infinity,
): CalibrationResult {
  const deltas: number[] = []
  let rejected = 0
  for (const tap of tapTimes) {
    let best = Infinity
    for (const beat of beatTimes) {
      const d = tap - beat
      if (Math.abs(d) < Math.abs(best)) best = d
    }
    if (!Number.isFinite(best) || Math.abs(best) > maxDeviationMs) {
      rejected++
      continue
    }
    deltas.push(best)
  }
  return { deltas, rejected, meanMs: mean(deltas), medianMs: median(deltas), sdMs: sd(deltas) }
}

/** Beat times for a metronome: `count` beats at `bpm`, starting at `startAt`. */
export function beatTimes(startAt: number, bpm: number, count: number): number[] {
  const beatMs = 60000 / bpm
  return Array.from({ length: count }, (_, i) => startAt + i * beatMs)
}

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2
}

export function sd(xs: readonly number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  const v = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(v)
}
