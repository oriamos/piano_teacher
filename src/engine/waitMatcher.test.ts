import { describe, expect, it } from 'vitest'
import { groupNotes } from './groups'
import { note } from './testUtils'
import { WaitMatcher } from './waitMatcher'

const groups = groupNotes([note(60, 0), note(64, 0), note(67, 1), note(72, 2)], 0.05)

describe('WaitMatcher', () => {
  it('advances when all notes of the group are pressed within the window', () => {
    const m = new WaitMatcher(groups, 200)
    expect(m.onNoteOn(60, 1000)).toEqual([
      { kind: 'hit', noteId: groups[0]!.notes[0]!.id, pitch: 60 },
    ])
    expect(m.cursor).toBe(0)
    const r = m.onNoteOn(64, 1100)
    expect(r[1]).toEqual({ kind: 'advance', fromGroup: 0, toGroup: 1 })
    expect(m.cursor).toBe(1)
  })

  it('does not advance on a wrong note and counts it', () => {
    const m = new WaitMatcher(groups, 200)
    expect(m.onNoteOn(61, 0)).toEqual([{ kind: 'wrong', pitch: 61 }])
    expect(m.cursor).toBe(0)
    expect(m.stats.wrong).toBe(1)
  })

  it('forgets a chord note pressed longer than the window ago', () => {
    const m = new WaitMatcher(groups, 200)
    m.onNoteOn(60, 0)
    m.onNoteOn(64, 500) // too late to pair with the first press
    expect(m.cursor).toBe(0)
    m.onNoteOn(60, 600) // now 64 (t=500) and 60 (t=600) are within 200ms
    expect(m.cursor).toBe(1)
  })

  it('reports done after the last group and ignores further notes', () => {
    const m = new WaitMatcher(groups, 200)
    m.onNoteOn(60, 0)
    m.onNoteOn(64, 0)
    m.onNoteOn(67, 10)
    const last = m.onNoteOn(72, 20)
    expect(last[1]).toEqual({ kind: 'advance', fromGroup: 2, toGroup: null })
    expect(m.done).toBe(true)
    expect(m.onNoteOn(60, 30)).toEqual([{ kind: 'ignored', pitch: 60 }])
    expect(m.stats).toEqual({ hits: 4, wrong: 0 })
  })

  it('reset jumps to a group and clears stats', () => {
    const m = new WaitMatcher(groups, 200)
    m.onNoteOn(99, 0)
    m.reset(2)
    expect(m.cursor).toBe(2)
    expect(m.stats.wrong).toBe(0)
    expect(m.current?.notes[0]?.pitch).toBe(72)
  })
})
