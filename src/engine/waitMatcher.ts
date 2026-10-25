/**
 * Wait mode: the cursor stops at the next group and advances only when every
 * note of the group has been pressed within one window. Wrong notes are
 * counted and the cursor stays put.
 */
import type { NoteGroup } from './groups'

export type WaitResult =
  | { kind: 'hit'; noteId: string; pitch: number }
  | { kind: 'advance'; fromGroup: number; toGroup: number | null }
  | { kind: 'wrong'; pitch: number }
  | { kind: 'ignored'; pitch: number }

export interface WaitStats {
  hits: number
  wrong: number
}

export class WaitMatcher {
  private index = 0
  private pressed = new Map<number, number>() // pitch -> time of press within the current group
  private firstPressT: number | null = null
  readonly stats: WaitStats = { hits: 0, wrong: 0 }

  constructor(
    private readonly groups: readonly NoteGroup[],
    private readonly windowMs: number,
  ) {}

  /** Index of the group the cursor is waiting on; `groups.length` when done. */
  get cursor(): number {
    return this.index
  }

  get current(): NoteGroup | null {
    return this.groups[this.index] ?? null
  }

  get done(): boolean {
    return this.index >= this.groups.length
  }

  /** Jump to a group (restart, loop). */
  reset(index = 0): void {
    this.index = Math.max(0, Math.min(index, this.groups.length))
    this.pressed.clear()
    this.firstPressT = null
    this.stats.hits = 0
    this.stats.wrong = 0
  }

  /**
   * Feed a note-on. Returns what happened; an `advance` means the group was
   * completed (its last `hit` is reported first, then the advance).
   */
  onNoteOn(pitch: number, t: number): WaitResult[] {
    const group = this.current
    if (!group) return [{ kind: 'ignored', pitch }]

    const note = group.notes.find((n) => n.pitch === pitch)
    if (!note) {
      this.stats.wrong++
      return [{ kind: 'wrong', pitch }]
    }

    // The chord window: presses older than windowMs no longer count.
    if (this.firstPressT !== null && t - this.firstPressT > this.windowMs) {
      this.pressed.clear()
      this.firstPressT = null
    }
    if (this.firstPressT === null) this.firstPressT = t
    this.pressed.set(pitch, t)

    const results: WaitResult[] = [{ kind: 'hit', noteId: note.id, pitch }]
    this.stats.hits++
    const complete = group.notes.every((n) => this.pressed.has(n.pitch))
    if (complete) {
      const from = this.index
      this.index++
      this.pressed.clear()
      this.firstPressT = null
      results.push({ kind: 'advance', fromGroup: from, toGroup: this.done ? null : this.index })
    }
    return results
  }
}
