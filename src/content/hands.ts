/**
 * Hand assignment (pure).
 *
 * If the file has two or more tracks with notes, the track with the higher
 * average pitch is the right hand (track names like "right"/"left", "RH"/"LH"
 * or "treble"/"bass" win when present). With a single track, notes split at
 * a pitch: `>= splitPitch` is RH.
 */
import type { HandAssignment, TrackInfo } from '../engine/types'

const RH_WORDS = /right|rh\b|treble|upper|melody/i
const LH_WORDS = /left|lh\b|bass|lower|accomp/i

/**
 * Decide how to assign hands for a set of tracks.
 *
 * @example
 * chooseHandAssignment([{index:0,name:'',noteCount:50,avgPitch:70},{index:1,name:'',noteCount:40,avgPitch:48}])
 * // { method: 'track', rhTracks: [0], lhTracks: [1] }
 */
export function chooseHandAssignment(
  tracks: readonly TrackInfo[],
  defaultSplit = 60,
): HandAssignment {
  const withNotes = tracks.filter((t) => t.noteCount > 0)
  if (withNotes.length < 2) return { method: 'split', splitPitch: defaultSplit }

  const named = {
    rh: withNotes.filter((t) => RH_WORDS.test(t.name) && !LH_WORDS.test(t.name)),
    lh: withNotes.filter((t) => LH_WORDS.test(t.name) && !RH_WORDS.test(t.name)),
  }
  if (named.rh.length && named.lh.length) {
    return {
      method: 'track',
      rhTracks: named.rh.map((t) => t.index),
      lhTracks: named.lh.map((t) => t.index),
    }
  }

  // Highest average pitch is RH; everything else LH. With exactly two tracks
  // that is the whole story; with more, the top one is RH and the rest LH.
  const sorted = [...withNotes].sort((a, b) => b.avgPitch - a.avgPitch)
  const rh = sorted[0] as TrackInfo
  return { method: 'track', rhTracks: [rh.index], lhTracks: sorted.slice(1).map((t) => t.index) }
}

/** Hand of a note under an assignment. */
export function handOf(assignment: HandAssignment, trackIndex: number, pitch: number): 'RH' | 'LH' {
  if (assignment.method === 'split') return pitch >= assignment.splitPitch ? 'RH' : 'LH'
  if (assignment.rhTracks.includes(trackIndex)) return 'RH'
  if (assignment.lhTracks.includes(trackIndex)) return 'LH'
  return pitch >= 60 ? 'RH' : 'LH'
}
