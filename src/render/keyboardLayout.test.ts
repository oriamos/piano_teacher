import { describe, expect, it } from 'vitest'
import { hitTest, keyboardLayout } from './keyboardLayout'

describe('keyboardLayout', () => {
  const layout = keyboardLayout(1040, 100)

  it('has 88 keys: 52 white and 36 black', () => {
    expect(layout.keys).toHaveLength(88)
    expect(layout.keys.filter((k) => !k.black)).toHaveLength(52)
    expect(layout.keys.filter((k) => k.black)).toHaveLength(36)
    expect(layout.whiteKeyWidth).toBe(20)
  })

  it('tiles white keys edge to edge without overlap', () => {
    const whites = layout.keys.filter((k) => !k.black)
    for (let i = 1; i < whites.length; i++) {
      expect(whites[i]!.x).toBeCloseTo(whites[i - 1]!.x + whites[i - 1]!.w)
    }
    expect(whites[0]!.x).toBe(0)
    expect(whites[51]!.x + whites[51]!.w).toBeCloseTo(1040)
  })

  it('puts each black key on the boundary between its white neighbours', () => {
    const cSharp = layout.byPitch.get(61)!
    const c = layout.byPitch.get(60)!
    expect(cSharp.x + cSharp.w / 2).toBeCloseTo(c.x + c.w)
    expect(cSharp.h).toBeLessThan(c.h)
  })

  it('hit-tests black keys before white keys', () => {
    const cSharp = layout.byPitch.get(61)!
    expect(hitTest(layout, cSharp.x + cSharp.w / 2, 10)).toBe(61)
    // Below the black key, the same x belongs to a white key.
    expect([60, 62]).toContain(hitTest(layout, cSharp.x + cSharp.w / 2, 95))
    expect(hitTest(layout, 5, 50)).toBe(21)
    expect(hitTest(layout, -1, 50)).toBeNull()
  })
})
