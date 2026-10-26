import { describe, expect, it } from 'vitest'
import { segmentByDensity, segmentDifficulty } from './segmentation'
import { note } from '../engine/testUtils'

function scale(bars: number, perBar: number, hand: 'RH' | 'LH' = 'RH') {
  const out = []
  for (let b = 0; b < bars; b++)
    for (let i = 0; i < perBar; i++)
      out.push(note(60 + (i % 7), b * 4 + (i * 4) / perBar, 4 / perBar, hand))
  return out
}

describe('segmentByDensity', () => {
  it('uses 4-bar segments for sparse music', () => {
    const s = segmentByDensity(scale(12, 4), 48, 4)
    expect(s.map((x) => [x.startBeat, x.endBeat])).toEqual([
      [0, 16],
      [16, 32],
      [32, 48],
    ])
  })
  it('cuts shorter when the music is dense', () => {
    const s = segmentByDensity(scale(12, 16), 48, 4) // 16 notes per bar → ~2 bars per segment
    expect(s.every((x) => x.endBeat - x.startBeat <= 8)).toBe(true)
    expect(s[0]!.difficulty).toBeGreaterThan(segmentByDensity(scale(12, 4), 48, 4)[0]!.difficulty!)
  })
  it('never leaves a one-bar orphan', () => {
    const s = segmentByDensity(scale(9, 4), 36, 4)
    expect(s.map((x) => (x.endBeat - x.startBeat) / 4)).toEqual([4, 3, 2])
  })
  it('covers the whole piece and gives ids in order', () => {
    const s = segmentByDensity(scale(7, 2), 28, 4)
    expect(s[0]!.startBeat).toBe(0)
    expect(s[s.length - 1]!.endBeat).toBe(28)
    expect(s.map((x) => x.id)).toEqual(s.map((_, i) => `seg-${i}`))
  })
  it('handles an empty piece', () => {
    expect(segmentByDensity([], 16, 4)).toHaveLength(1)
  })
})

describe('segmentDifficulty', () => {
  it('rises with density, chords and leaps', () => {
    const sparse = segmentDifficulty(scale(4, 2), 16)
    const dense = segmentDifficulty(scale(4, 8), 16)
    expect(dense).toBeGreaterThan(sparse)
    const chords = [
      ...scale(4, 4),
      ...scale(4, 4).map((n) => ({ ...n, id: n.id + 'c', pitch: n.pitch + 4 })),
    ]
    expect(segmentDifficulty(chords, 16)).toBeGreaterThan(segmentDifficulty(scale(4, 4), 16))
    const leapy = scale(4, 4).map((n, i) => ({ ...n, pitch: i % 2 ? 72 : 60 }))
    expect(segmentDifficulty(leapy, 16)).toBeGreaterThan(segmentDifficulty(scale(4, 4), 16))
    expect(segmentDifficulty([], 16)).toBe(1)
  })
})
