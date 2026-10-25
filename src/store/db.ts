/**
 * Local storage: IndexedDB through Dexie. Offline-first (ADR 0002).
 * Stage 1 tables: songs and settings. Progress, attempts, note stats and
 * the sync queue arrive with stages 2–4; `user_id` is on every per-user
 * row from the start.
 */
import Dexie, { type EntityTable } from 'dexie'
import type { Song } from '../engine/types'

export interface SongRow {
  id: string
  title: string
  composer?: string
  sourceType: 'midi' | 'musicxml' | 'builtin'
  /** The original file, so hands/segments can be recomputed later. */
  file: ArrayBuffer
  song: Song
  difficulty: number
  uploadedBy: string
  createdAt: number
}

export interface SettingRow {
  key: string
  value: unknown
}

export const LOCAL_USER = 'local'

class PianoDb extends Dexie {
  songs!: EntityTable<SongRow, 'id'>
  settings!: EntityTable<SettingRow, 'key'>

  constructor() {
    super('piano-teacher')
    this.version(1).stores({
      songs: 'id, title, createdAt',
      settings: 'key',
    })
  }
}

export const db = new PianoDb()

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : fallback
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

/** A rough difficulty: notes per beat, chords and range (stage 2 refines this). */
export function estimateDifficulty(song: Song): number {
  if (song.notes.length === 0) return 1
  const density = song.notes.length / song.totalBeats
  const range =
    Math.max(...song.notes.map((n) => n.pitch)) - Math.min(...song.notes.map((n) => n.pitch))
  return Math.round(Math.min(10, 1 + density * 2 + range / 24))
}
