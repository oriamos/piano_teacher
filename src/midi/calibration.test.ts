import { describe, expect, it } from 'vitest'
import { beatTimes, computeOffset, mean, median, sd } from './calibration'

describe('computeOffset', () => {
  const beats = beatTimes(1000, 80, 8) // every 750ms

  it('finds the mean deviation from the nearest beat', () => {
    const taps = beats.map((b) => b + 12)
    const r = computeOffset(taps, beats)
    expect(r.deltas).toHaveLength(8)
    expect(r.meanMs).toBeCloseTo(12)
    expect(r.medianMs).toBeCloseTo(12)
    expect(r.sdMs).toBeCloseTo(0)
    expect(r.rejected).toBe(0)
  })

  it('handles taps that arrive early (negative offset)', () => {
    const taps = beats.map((b, i) => b - 20 + (i % 2 ? 4 : -4))
    const r = computeOffset(taps, beats)
    expect(r.meanMs).toBeCloseTo(-20)
    expect(r.sdMs).toBeGreaterThan(0)
  })

  it('rejects outliers beyond the max deviation', () => {
    const taps = [...beats.map((b) => b + 10), 1000 + 375] // one tap exactly between beats
    const r = computeOffset(taps, beats, 250)
    expect(r.rejected).toBe(1)
    expect(r.deltas).toHaveLength(8)
    expect(r.meanMs).toBeCloseTo(10)
  })

  it('tolerates a missed beat', () => {
    const taps = beats.filter((_, i) => i !== 3).map((b) => b + 8)
    const r = computeOffset(taps, beats)
    expect(r.deltas).toHaveLength(7)
    expect(r.meanMs).toBeCloseTo(8)
  })

  it('returns zeros for no taps', () => {
    const r = computeOffset([], beats)
    expect(r).toEqual({ deltas: [], rejected: 0, meanMs: 0, medianMs: 0, sdMs: 0 })
  })
})

describe('stats helpers', () => {
  it('mean/median/sd', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5)
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3)
    expect(sd([1])).toBe(0)
  })
  it('beatTimes spaces beats by 60000/bpm', () => {
    expect(beatTimes(0, 120, 3)).toEqual([0, 500, 1000])
  })
})
