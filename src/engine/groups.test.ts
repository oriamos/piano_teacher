import { describe, expect, it } from 'vitest'
import { groupNotes } from './groups'
import { note } from './testUtils'

describe('groupNotes', () => {
  it('groups notes with onsets inside the window', () => {
    const g = groupNotes([note(60, 0), note(64, 0.01), note(67, 0.02), note(72, 1)], 0.05)
    expect(g.map((x) => x.notes.length)).toEqual([3, 1])
    expect(g[1]!.onsetBeat).toBe(1)
    expect(g.map((x) => x.index)).toEqual([0, 1])
  })
  it('measures the window from the first note of the group', () => {
    const g = groupNotes([note(60, 0), note(62, 0.04), note(64, 0.08)], 0.05)
    expect(g.map((x) => x.notes.length)).toEqual([2, 1])
  })
  it('handles empty input', () => {
    expect(groupNotes([], 0.05)).toEqual([])
  })
})
