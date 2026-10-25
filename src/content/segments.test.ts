import { describe, expect, it } from 'vitest'
import { segmentAt, segmentByBars } from './segments'

describe('segmentByBars', () => {
  it('cuts 4-bar segments and keeps the remainder', () => {
    const s = segmentByBars(40, 4, 4)
    expect(s.map((x) => [x.startBeat, x.endBeat])).toEqual([
      [0, 16],
      [16, 32],
      [32, 40],
    ])
    expect(s[1]!.id).toBe('seg-1')
  })
  it('finds the segment of a beat', () => {
    const s = segmentByBars(32, 4)
    expect(segmentAt(s, 15.9)?.id).toBe('seg-0')
    expect(segmentAt(s, 16)?.id).toBe('seg-1')
    expect(segmentAt(s, 32)).toBeNull()
  })
})
