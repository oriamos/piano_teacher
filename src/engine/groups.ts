/**
 * Chord grouping: expected notes whose onsets are within a small window are
 * one group. Wait mode advances per group; timed mode matches per note.
 */
import type { ExpectedNote } from './types'

export interface NoteGroup {
  index: number
  onsetBeat: number
  notes: ExpectedNote[]
}

/**
 * Group notes by onset. `notes` must be sorted by onsetBeat. A note starts a
 * new group when it is more than `windowBeats` after the group's first note.
 *
 * @example
 * groupNotes([c(0), e(0.01), g(1)], 0.05).map(g => g.notes.length) // [2, 1]
 */
export function groupNotes(notes: readonly ExpectedNote[], windowBeats: number): NoteGroup[] {
  const groups: NoteGroup[] = []
  for (const n of notes) {
    const last = groups[groups.length - 1]
    if (last && n.onsetBeat - last.onsetBeat <= windowBeats) last.notes.push(n)
    else groups.push({ index: groups.length, onsetBeat: n.onsetBeat, notes: [n] })
  }
  return groups
}
