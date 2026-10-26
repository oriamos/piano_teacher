/** Song library operations on top of the Dexie store. */
import { importSongFile } from '../content/importFile'
import { reassignHands } from '../content/midiImport'
import { importMidi } from '../content/midiImport'
import type { Song } from '../engine/types'
import { db, estimateDifficulty, getSetting, LOCAL_USER, setSetting, type SongRow } from './db'

export async function listSongs(): Promise<SongRow[]> {
  return db.songs.orderBy('createdAt').reverse().toArray()
}

export async function getSong(id: string): Promise<SongRow | undefined> {
  return db.songs.get(id)
}

export async function removeSong(id: string): Promise<void> {
  await db.songs.delete(id)
}

/**
 * Import a file picked by the user: .mid / .midi, .musicxml / .xml, or .mxl.
 * Throws a readable message for PDFs and images (see content/importFile.ts).
 */
export async function importSongFileFromDisk(file: File): Promise<SongRow> {
  const buf = await file.arrayBuffer()
  const { song, sourceType } = importSongFile(file.name, buf)
  return storeSong(buf, song, sourceType)
}

async function storeSong(
  file: ArrayBuffer,
  song: Song,
  sourceType: SongRow['sourceType'],
): Promise<SongRow> {
  const row: SongRow = {
    id: song.id,
    title: song.title,
    sourceType,
    file,
    song,
    difficulty: estimateDifficulty(song),
    uploadedBy: LOCAL_USER,
    // eslint-disable-next-line no-restricted-properties -- wall-clock date for sorting, not timing
    createdAt: Date.now(),
  }
  if (song.composer) row.composer = song.composer
  await db.songs.put(row)
  return row
}

/** Change the hand split of a stored song. */
export async function setSplitPitch(id: string, splitPitch: number): Promise<SongRow | undefined> {
  const row = await db.songs.get(id)
  if (!row) return undefined
  const song = reassignHands(row.song, splitPitch)
  const next = { ...row, song }
  await db.songs.put(next)
  return next
}

interface BuiltinIndexEntry {
  file: string
  title: string
  bpm: number
}

/** Add the starter songs shipped in public/songs. Skips ones already present. */
export async function addBuiltinSongs(): Promise<number> {
  const res = await fetch('songs/index.json')
  if (!res.ok) throw new Error(`songs/index.json: ${res.status}`)
  const index = (await res.json()) as BuiltinIndexEntry[]
  let added = 0
  for (const entry of index) {
    const r = await fetch(`songs/${entry.file}`)
    if (!r.ok) continue
    const buf = await r.arrayBuffer()
    const song = importMidi(buf, { title: entry.title })
    if (await db.songs.get(song.id)) continue
    await storeSong(buf, song, 'builtin')
    added++
  }
  return added
}

const LAST_SONG_KEY = 'lastSongId'

/** Remember the song that was opened last, for the home screen's continue card. */
export async function setLastSong(id: string): Promise<void> {
  await setSetting(LAST_SONG_KEY, id)
}

export async function getLastSong(): Promise<SongRow | undefined> {
  const id = await getSetting<string | null>(LAST_SONG_KEY, null)
  return id ? db.songs.get(id) : undefined
}
