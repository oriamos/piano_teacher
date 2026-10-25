import { describe, expect, it } from 'vitest'
import { TimedMatcher } from './timedMatcher'

const expected = [
  { id: 'a', pitch: 60, onsetMs: 1000 },
  { id: 'b', pitch: 62, onsetMs: 1500 },
  { id: 'c', pitch: 60, onsetMs: 2000 },
]

describe('TimedMatcher', () => {
  it('classifies precise / early / late inside W', () => {
    const m = new TimedMatcher(expected, 150)
    expect(m.onNoteOn(60, 1030)).toMatchObject({
      kind: 'hit',
      noteId: 'a',
      deltaMs: 30,
      cls: 'precise',
    })
    expect(m.onNoteOn(62, 1420)).toMatchObject({
      kind: 'hit',
      noteId: 'b',
      deltaMs: -80,
      cls: 'early',
    })
    expect(m.onNoteOn(60, 2100)).toMatchObject({
      kind: 'hit',
      noteId: 'c',
      deltaMs: 100,
      cls: 'late',
    })
    expect(m.stats).toMatchObject({ hits: 3, extra: 0, missed: 0, deltas: [30, -80, 100] })
  })

  it('matches the nearest unmatched note of the same pitch', () => {
    const m = new TimedMatcher(expected, 150)
    expect(m.onNoteOn(60, 1900)).toMatchObject({ noteId: 'c' })
    // 'a' is still open but its window (850..1150) is long gone → extra
    expect(m.onNoteOn(60, 1950)).toEqual({ kind: 'extra', pitch: 60 })
    expect(m.stats.extra).toBe(1)
  })

  it('reports wrong pitches as extra', () => {
    const m = new TimedMatcher(expected, 150)
    expect(m.onNoteOn(61, 1000)).toEqual({ kind: 'extra', pitch: 61 })
  })

  it('does not match the same expected note twice', () => {
    const m = new TimedMatcher(expected, 150)
    m.onNoteOn(60, 1000)
    expect(m.onNoteOn(60, 1010)).toEqual({ kind: 'extra', pitch: 60 })
  })

  it('tick marks notes whose window closed as missed, once', () => {
    const m = new TimedMatcher(expected, 150)
    expect(m.tick(1100)).toEqual([])
    expect(m.tick(1151)).toEqual(['a'])
    expect(m.tick(1200)).toEqual([])
    m.onNoteOn(62, 1500)
    expect(m.finish()).toEqual(['c'])
    expect(m.stats).toMatchObject({ hits: 1, missed: 2 })
  })
})
