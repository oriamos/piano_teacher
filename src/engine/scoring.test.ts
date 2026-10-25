import { describe, expect, it } from 'vitest'
import { scoreRun, scoreWaitRun } from './scoring'

describe('scoreRun', () => {
  const base = { expected: 20, hits: 20, extra: 0, missed: 0, windowMs: 150 }

  it('is clean with high accuracy and tight timing', () => {
    const s = scoreRun({ ...base, deltas: Array(20).fill(20) })
    expect(s.acc).toBe(1)
    expect(s.timing).toBeCloseTo(1 - 20 / 150)
    expect(s.verdict).toBe('clean')
  })
  it('uses the median so one bad note does not sink the run', () => {
    const deltas = [...Array(19).fill(10), 140]
    expect(scoreRun({ ...base, deltas }).verdict).toBe('clean')
  })
  it('is not clean when timing is loose even if every note hit', () => {
    const s = scoreRun({ ...base, deltas: Array(20).fill(100) })
    expect(s.timing).toBeCloseTo(1 - 100 / 150)
    expect(s.verdict).toBe('neither')
  })
  it('counts extra notes against accuracy', () => {
    const s = scoreRun({ ...base, extra: 5, deltas: Array(20).fill(0) })
    expect(s.acc).toBe(0.8)
    expect(s.verdict).toBe('neither')
    expect(scoreRun({ ...base, extra: 6, deltas: Array(20).fill(0) }).verdict).toBe('failed')
  })
  it('fails below 80 % accuracy', () => {
    const s = scoreRun({ ...base, hits: 15, missed: 5, deltas: Array(15).fill(0) })
    expect(s.acc).toBe(0.75)
    expect(s.verdict).toBe('failed')
  })
  it('reports the mean signed delta', () => {
    expect(scoreRun({ ...base, deltas: [-10, 30] }).meanDeltaMs).toBe(10)
  })
})

describe('scoreWaitRun', () => {
  it('scores by hits vs wrong notes with timing fixed at 1', () => {
    expect(scoreWaitRun(19, 1)).toMatchObject({ acc: 0.95, timing: 1, verdict: 'clean' })
    expect(scoreWaitRun(16, 4)).toMatchObject({ acc: 0.8, verdict: 'neither' })
    expect(scoreWaitRun(10, 10)).toMatchObject({ verdict: 'failed' })
    expect(scoreWaitRun(0, 0).acc).toBe(1)
  })
})
