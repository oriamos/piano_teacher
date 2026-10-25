/** Helpers for engine tests (not shipped). */
import type { ExpectedNote, Song } from './types'
import { segmentByBars } from '../content/segments'

let counter = 0

export function note(
  pitch: number,
  onsetBeat: number,
  durBeats = 1,
  hand: 'RH' | 'LH' = 'RH',
): ExpectedNote {
  return { id: `t${counter++}`, pitch, onsetBeat, durBeats, hand, segmentId: 'seg-0', velocity: 80 }
}

/** A song from note lists; 4/4, totalBeats rounded up to a bar. */
export function makeSong(notes: ExpectedNote[], bpm = 120): Song {
  const sorted = [...notes].sort((a, b) => a.onsetBeat - b.onsetBeat || a.pitch - b.pitch)
  const last = sorted.reduce((m, n) => Math.max(m, n.onsetBeat + n.durBeats), 0)
  const totalBeats = Math.max(4, Math.ceil(last / 4) * 4)
  return {
    id: 'test',
    title: 'test',
    bpm,
    beatsPerBar: 4,
    totalBeats,
    notes: sorted,
    segments: segmentByBars(totalBeats, 4),
    hands: { method: 'split', splitPitch: 60 },
    tracks: [],
  }
}
