import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { importMidi, reassignHands } from './midiImport'

const file = readFileSync(
  join(__dirname, '..', '..', 'test', 'fixtures', 'songs', 'evening-study-1.mid'),
)

describe('importMidi', () => {
  const song = importMidi(file)

  it('reads tempo, meter and length', () => {
    expect(song.bpm).toBe(84)
    expect(song.beatsPerBar).toBe(4)
    expect(song.totalBeats).toBe(32)
    expect(song.title).toBe('Evening Study No. 1 (original)')
    expect(song.segments).toHaveLength(2)
  })

  it('assigns hands by track name', () => {
    expect(song.hands).toEqual({ method: 'track', rhTracks: [0], lhTracks: [1] })
    const rh = song.notes.filter((n) => n.hand === 'RH')
    const lh = song.notes.filter((n) => n.hand === 'LH')
    expect(rh).toHaveLength(26)
    expect(lh).toHaveLength(32) // 16 two-note chords
    expect(Math.min(...rh.map((n) => n.pitch))).toBeGreaterThanOrEqual(60)
  })

  it('sorts notes by onset and gives them stable ids and segments', () => {
    for (let i = 1; i < song.notes.length; i++) {
      expect(song.notes[i]!.onsetBeat).toBeGreaterThanOrEqual(song.notes[i - 1]!.onsetBeat)
    }
    expect(song.notes[0]).toMatchObject({ id: 'n0', onsetBeat: 0, segmentId: 'seg-0' })
    expect(song.notes.find((n) => n.onsetBeat >= 16)?.segmentId).toBe('seg-1')
    expect(song.id).toMatch(/^song-[0-9a-f]{8}$/)
    expect(importMidi(file).id).toBe(song.id)
  })

  it('converts ticks to beats', () => {
    const first = song.notes.filter((n) => n.onsetBeat === 0).map((n) => n.pitch)
    expect(first).toEqual([52, 59, 64]) // E3 B3 (LH chord) and E4 (RH)
    const e4 = song.notes.find((n) => n.pitch === 64 && n.onsetBeat === 0)!
    expect(e4.durBeats).toBeCloseTo(0.95, 2)
  })

  it('can be re-split by pitch', () => {
    const re = reassignHands(song, 64)
    expect(re.hands).toEqual({ method: 'split', splitPitch: 64 })
    expect(re.notes.filter((n) => n.pitch < 64).every((n) => n.hand === 'LH')).toBe(true)
  })

  it('honours an explicit split point on import', () => {
    const s = importMidi(file, { splitPitch: 100 })
    expect(s.notes.every((n) => n.hand === 'LH')).toBe(true)
  })
})
