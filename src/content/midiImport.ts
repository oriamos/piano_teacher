/**
 * .mid → Song. Uses @tonejs/midi (MIT) for the byte-level parsing and
 * converts ticks to beats, assigns hands and segments.
 */
import { Midi } from '@tonejs/midi'
import type { ExpectedNote, Song, TrackInfo } from '../engine/types'
import { chooseHandAssignment, handOf } from './hands'
import { segmentAt } from './segments'
import { segmentByDensity } from './segmentation'

export interface ImportOptions {
  id?: string
  title?: string
  /** Override the automatic hand assignment. */
  splitPitch?: number
}

/**
 * Parse a MIDI file.
 *
 * - Tempo: the first tempo event, else 120.
 * - Time signature: the first one, else 4/4. Beats are quarter notes
 *   regardless of the denominator (ppq-based), which is what falling-notes
 *   players expect.
 * - Notes shorter than 1/32 are kept; zero-length notes are dropped.
 */
export function importMidi(data: ArrayLike<number> | ArrayBuffer, opts: ImportOptions = {}): Song {
  const midi = new Midi(
    data instanceof ArrayBuffer ? data : Uint8Array.from(data as ArrayLike<number>),
  )
  const ppq = midi.header.ppq || 480
  const bpm = Math.round((midi.header.tempos[0]?.bpm ?? 120) * 100) / 100
  const ts = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4]
  const beatsPerBar = Math.max(1, Math.round(((ts[0] ?? 4) * 4) / (ts[1] ?? 4)))

  const tracks: TrackInfo[] = midi.tracks.map((t, index) => ({
    index,
    name: t.name ?? '',
    noteCount: t.notes.length,
    avgPitch: t.notes.length ? t.notes.reduce((a, n) => a + n.midi, 0) / t.notes.length : 0,
  }))

  const hands =
    opts.splitPitch !== undefined
      ? ({ method: 'split', splitPitch: opts.splitPitch } as const)
      : chooseHandAssignment(tracks)

  const raw: Omit<ExpectedNote, 'id' | 'segmentId'>[] = []
  midi.tracks.forEach((t, trackIndex) => {
    for (const n of t.notes) {
      const durBeats = n.durationTicks / ppq
      if (durBeats <= 0) continue
      raw.push({
        pitch: n.midi,
        onsetBeat: n.ticks / ppq,
        durBeats,
        velocity: Math.max(1, Math.round(n.velocity * 127)),
        hand: handOf(hands, trackIndex, n.midi),
      })
    }
  })
  raw.sort((a, b) => a.onsetBeat - b.onsetBeat || a.pitch - b.pitch)

  const lastEnd = raw.reduce((m, n) => Math.max(m, n.onsetBeat + n.durBeats), 0)
  const totalBeats = Math.ceil(lastEnd / beatsPerBar) * beatsPerBar || beatsPerBar
  const segments = segmentByDensity(
    raw.map((n, i) => ({ ...n, id: `n${i}`, segmentId: '' })),
    totalBeats,
    beatsPerBar,
  )

  const notes: ExpectedNote[] = raw.map((n, i) => ({
    ...n,
    id: `n${i}`,
    segmentId: segmentAt(segments, n.onsetBeat)?.id ?? segments[segments.length - 1]?.id ?? 'seg-0',
  }))

  const title = opts.title ?? midi.name ?? midi.tracks.find((t) => t.name)?.name ?? 'Untitled'
  return {
    id: opts.id ?? `song-${hash(notes.map((n) => `${n.pitch}@${n.onsetBeat}`).join(','))}`,
    title,
    bpm,
    beatsPerBar,
    totalBeats,
    notes,
    segments,
    hands,
    tracks,
  }
}

/** Re-assign hands on an imported song (e.g. the user moved the split point). */
export function reassignHands(song: Song, splitPitch: number): Song {
  const hands = { method: 'split', splitPitch } as const
  return {
    ...song,
    hands,
    notes: song.notes.map((n) => ({ ...n, hand: n.pitch >= splitPitch ? 'RH' : 'LH' })),
  }
}

/** Stable short id from a string (FNV-1a). */
function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
