import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { importMidi } from './midiImport'
import { importMusicXml } from './musicxml'

const dir = join(__dirname, '..', '..', 'test', 'fixtures', 'songs')
const xml = readFileSync(join(dir, 'evening-study-1.musicxml'), 'utf8')
const mid = readFileSync(join(dir, 'evening-study-1.mid'))

describe('importMusicXml', () => {
  const song = importMusicXml(xml)

  it('reads title, composer, tempo and meter', () => {
    expect(song.title).toBe('Evening Study No. 1 (original)')
    expect(song.composer).toBe('Piano Teacher project')
    expect(song.bpm).toBe(84)
    expect(song.beatsPerBar).toBe(4)
    expect(song.totalBeats).toBe(32)
  })

  it('maps staff 1 to the right hand and staff 2 to the left', () => {
    expect(song.hands).toEqual({ method: 'track', rhTracks: [1], lhTracks: [2] })
    expect(song.tracks.map((t) => t.name)).toEqual(['Piano · right hand', 'Piano · left hand'])
    expect(song.notes.filter((n) => n.hand === 'RH')).toHaveLength(26)
    expect(song.notes.filter((n) => n.hand === 'LH')).toHaveLength(32)
  })

  it('handles backup, chords and ties', () => {
    const atZero = song.notes.filter((n) => n.onsetBeat === 0).map((n) => n.pitch)
    expect(atZero).toEqual([52, 59, 64]) // LH chord E3 B3 under RH E4
    // Bar 4: the two tied E4 quarters are one half note at beat 14.
    const tied = song.notes.filter((n) => n.pitch === 64 && n.onsetBeat === 14)
    expect(tied).toHaveLength(1)
    expect(tied[0]!.durBeats).toBe(2)
    expect(song.notes.filter((n) => n.onsetBeat === 15)).toHaveLength(0)
  })

  it('agrees with the MIDI version of the same piece', () => {
    const fromMidi = importMidi(mid)
    const key = (n: { pitch: number; onsetBeat: number; hand: string }) =>
      `${n.hand}:${n.pitch}@${n.onsetBeat}`
    expect(song.notes.map(key).sort()).toEqual(fromMidi.notes.map(key).sort())
  })

  it('segments by density with a difficulty per segment', () => {
    expect(song.segments.length).toBeGreaterThanOrEqual(2)
    for (const s of song.segments) {
      expect(s.endBeat - s.startBeat).toBeGreaterThanOrEqual(8)
      expect(s.endBeat - s.startBeat).toBeLessThanOrEqual(16)
      expect(s.difficulty).toBeGreaterThanOrEqual(1)
      expect(s.difficulty).toBeLessThanOrEqual(10)
    }
    expect(song.segments[0]!.startBeat).toBe(0)
    expect(song.segments[song.segments.length - 1]!.endBeat).toBe(32)
    expect(song.notes.every((n) => song.segments.some((s) => s.id === n.segmentId))).toBe(true)
  })

  it('rejects timewise scores with a hint', () => {
    expect(() => importMusicXml('<score-timewise/>')).toThrow(/partwise/)
  })

  it('handles a pickup bar, a transposing part and grace notes', () => {
    const s = importMusicXml(`<?xml version="1.0"?><score-partwise>
      <part-list><score-part id="P1"><part-name>Clarinet</part-name></score-part></part-list>
      <part id="P1">
        <measure number="0" implicit="yes">
          <attributes><divisions>1</divisions><time><beats>3</beats><beat-type>4</beat-type></time>
            <transpose><chromatic>-2</chromatic></transpose></attributes>
          <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note>
        </measure>
        <measure number="1">
          <note><grace/><pitch><step>C</step><octave>4</octave></pitch></note>
          <note><pitch><step>E</step><octave>4</octave></pitch><duration>3</duration></note>
        </measure>
      </part></score-partwise>`)
    expect(s.beatsPerBar).toBe(3)
    expect(s.notes.map((n) => [n.pitch, n.onsetBeat, n.durBeats])).toEqual([
      [60, 0, 1], // D4 written, sounds C4 (−2)
      [62, 1, 3],
    ])
    expect(s.hands).toEqual({ method: 'split', splitPitch: 60 })
  })
})
