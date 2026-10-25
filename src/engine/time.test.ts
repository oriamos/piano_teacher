import { describe, expect, it } from 'vitest'
import { beatMs, beatToMs, matchWindowMs, msToBeat } from './time'

describe('time', () => {
  it('beatMs scales with tempo percent', () => {
    expect(beatMs(120)).toBe(500)
    expect(beatMs(120, 50)).toBe(1000)
  })
  it('W = min(150, 0.25 beat)', () => {
    expect(matchWindowMs(120)).toBe(125)
    expect(matchWindowMs(60)).toBe(150)
    expect(matchWindowMs(120, 60)).toBe(150) // 0.25 * 833 = 208 > 150
  })
  it('beatToMs / msToBeat are inverses', () => {
    expect(beatToMs(6, 4, 1000, 500)).toBe(2000)
    expect(msToBeat(2000, 4, 1000, 500)).toBe(6)
  })
})
