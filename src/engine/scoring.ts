/**
 * Run scoring:
 *   acc    = hits / (expected + extra)
 *   timing = 1 − median|Δ| / W
 * clean when acc ≥ cleanAcc and timing ≥ cleanTiming; failed when acc < failAcc.
 */
import { config } from '../config'

export type Verdict = 'clean' | 'failed' | 'neither'

export interface RunScore {
  acc: number
  timing: number
  verdict: Verdict
  hits: number
  expected: number
  extra: number
  missed: number
  /** Mean signed Δ of the hits, ms (positive = late). */
  meanDeltaMs: number
}

export interface RunInput {
  expected: number
  hits: number
  extra: number
  missed: number
  deltas: readonly number[]
  windowMs: number
}

/**
 * Score a run.
 *
 * @example
 * scoreRun({ expected: 10, hits: 10, extra: 0, missed: 0, deltas: Array(10).fill(10), windowMs: 150 }).verdict // 'clean'
 */
export function scoreRun(r: RunInput): RunScore {
  const denom = r.expected + r.extra
  const acc = denom === 0 ? 1 : r.hits / denom
  const absMedian = median(r.deltas.map(Math.abs))
  const timing = r.deltas.length === 0 ? 0 : Math.max(0, 1 - absMedian / r.windowMs)
  const verdict: Verdict =
    acc >= config.scoring.cleanAcc && timing >= config.scoring.cleanTiming
      ? 'clean'
      : acc < config.scoring.failAcc
        ? 'failed'
        : 'neither'
  const meanDeltaMs =
    r.deltas.length === 0 ? 0 : r.deltas.reduce((a, b) => a + b, 0) / r.deltas.length
  return {
    acc,
    timing,
    verdict,
    hits: r.hits,
    expected: r.expected,
    extra: r.extra,
    missed: r.missed,
    meanDeltaMs,
  }
}

/**
 * Wait mode has no timing component: acc = hits / (hits + wrong), timing = 1.
 */
export function scoreWaitRun(hits: number, wrong: number): RunScore {
  const denom = hits + wrong
  const acc = denom === 0 ? 1 : hits / denom
  const verdict: Verdict =
    acc >= config.scoring.cleanAcc ? 'clean' : acc < config.scoring.failAcc ? 'failed' : 'neither'
  return { acc, timing: 1, verdict, hits, expected: hits, extra: wrong, missed: 0, meanDeltaMs: 0 }
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2
}
