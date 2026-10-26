/**
 * Density-based segmentation and per-segment difficulty (spec M2.3, M2.4).
 *
 * A segment is 2–4 bars. Bars are added while the segment is short and not
 * yet dense; a cut is preferred at a bar whose downbeat comes after a rest
 * or a long melody note (a phrase boundary, as far as the notes alone can
 * tell). Every threshold is in `config.segmentation` / `config.difficulty`.
 */
import { config } from '../config'
import type { ExpectedNote, Segment } from '../engine/types'

export interface SegmentWithDifficulty extends Segment {
  difficulty: number
}

/**
 * Split `totalBeats` into segments by note density.
 *
 * @example segmentByDensity(notes, 32, 4).map(s => s.endBeat - s.startBeat) // e.g. [16, 8, 8]
 */
export function segmentByDensity(
  notes: readonly ExpectedNote[],
  totalBeats: number,
  beatsPerBar: number,
): SegmentWithDifficulty[] {
  const { minBars, maxBars, targetNotes, phraseRestBeats } = config.segmentation
  const bars = Math.max(1, Math.ceil(totalBeats / beatsPerBar))
  const perBar: ExpectedNote[][] = Array.from({ length: bars }, () => [])
  for (const n of notes) {
    const b = Math.min(bars - 1, Math.max(0, Math.floor(n.onsetBeat / beatsPerBar)))
    perBar[b]!.push(n)
  }

  // A bar boundary is a phrase boundary if the right hand (or all notes, when
  // there is no RH) has no onset in the last `phraseRestBeats` before it.
  const melody = notes.some((n) => n.hand === 'RH') ? notes.filter((n) => n.hand === 'RH') : notes
  const phraseBefore = (bar: number): boolean => {
    const boundary = bar * beatsPerBar
    return !melody.some((n) => n.onsetBeat >= boundary - phraseRestBeats && n.onsetBeat < boundary)
  }

  const segments: SegmentWithDifficulty[] = []
  let start = 0
  while (start < bars) {
    const remaining = bars - start
    const maxLen = Math.min(maxBars, remaining)
    // Grow until the segment is dense enough to cut, or maxBars.
    let count = 0
    let denseAt = -1
    for (let l = 1; l <= maxLen; l++) {
      count += perBar[start + l - 1]!.length
      if (l >= minBars && count >= targetNotes) {
        denseAt = l
        break
      }
    }
    let len = denseAt === -1 ? maxLen : denseAt
    // When density forced a cut mid-phrase, move it back to the last phrase boundary.
    if (denseAt !== -1 && start + denseAt < bars && !phraseBefore(start + denseAt)) {
      for (let l = denseAt - 1; l >= minBars; l--) {
        if (phraseBefore(start + l)) {
          len = l
          break
        }
      }
    }
    // Never leave a tail shorter than minBars.
    const tail = remaining - len
    if (tail > 0 && tail < minBars && len - (minBars - tail) >= minBars) len -= minBars - tail

    const seg: Segment = {
      id: `seg-${segments.length}`,
      index: segments.length,
      startBeat: start * beatsPerBar,
      endBeat: Math.min(totalBeats, (start + len) * beatsPerBar),
    }
    const inSeg = notes.filter((n) => n.onsetBeat >= seg.startBeat && n.onsetBeat < seg.endBeat)
    segments.push({ ...seg, difficulty: segmentDifficulty(inSeg, seg.endBeat - seg.startBeat) })
    start += len
  }
  return segments
}

/**
 * Difficulty 1–10 from note density, chord count and leaps, per hand.
 *
 * @example segmentDifficulty([], 16) // 1
 */
export function segmentDifficulty(notes: readonly ExpectedNote[], beats: number): number {
  if (notes.length === 0 || beats <= 0) return 1
  const { densityWeight, chordWeight, leapWeight, leapSemitones } = config.difficulty
  const density = notes.length / beats
  let chords = 0
  let leaps = 0
  for (const hand of ['RH', 'LH'] as const) {
    const hn = notes.filter((n) => n.hand === hand)
    if (hn.length === 0) continue
    // Chords: onsets shared by 2+ notes of the same hand.
    const byOnset = new Map<number, number>()
    for (const n of hn) byOnset.set(n.onsetBeat, (byOnset.get(n.onsetBeat) ?? 0) + 1)
    for (const c of byOnset.values()) if (c >= 2) chords++
    // Leaps: pitch distance between consecutive onsets (highest note of each).
    const onsets = [...byOnset.keys()].sort((a, b) => a - b)
    let prev: number | null = null
    for (const o of onsets) {
      const top = Math.max(...hn.filter((n) => n.onsetBeat === o).map((n) => n.pitch))
      if (prev !== null && Math.abs(top - prev) >= leapSemitones) leaps++
      prev = top
    }
  }
  const raw =
    1 +
    density * densityWeight +
    chords * chordWeight +
    (leaps / Math.max(1, beats)) * leapWeight * 10
  return Math.max(1, Math.min(10, Math.round(raw)))
}
