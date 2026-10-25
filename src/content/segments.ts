/**
 * Segmentation (pure). Stage 1: fixed-length segments of `barsPerSegment`
 * bars. Stage 2 replaces this with density-based 2–4 bar splitting and
 * manual editing; the Segment shape stays the same.
 */
import type { Segment } from '../engine/types'

/**
 * @example segmentByBars(16, 4, 4).length // 1 (16 beats = 4 bars of 4)
 */
export function segmentByBars(
  totalBeats: number,
  beatsPerBar: number,
  barsPerSegment = 4,
): Segment[] {
  const segBeats = beatsPerBar * barsPerSegment
  const segments: Segment[] = []
  for (let start = 0, i = 0; start < totalBeats; start += segBeats, i++) {
    segments.push({
      id: `seg-${i}`,
      index: i,
      startBeat: start,
      endBeat: Math.min(totalBeats, start + segBeats),
    })
  }
  return segments
}

/** Id of the segment containing `beat`, or null. */
export function segmentAt(segments: readonly Segment[], beat: number): Segment | null {
  return segments.find((s) => beat >= s.startBeat && beat < s.endBeat) ?? null
}
