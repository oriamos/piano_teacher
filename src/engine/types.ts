/**
 * The internal event format shared by content, engine, render and midi.
 *
 * Everything that comes out of a .mid or MusicXML file is normalised into
 * a flat list of {@link ExpectedNote}s; everything that comes from the piano
 * is a {@link PlayedNote}. The engine only ever sees these two shapes.
 *
 * The engine is pure TypeScript: this file must compile without the DOM lib
 * (enforced by tsconfig.engine.json).
 */

/** Which hand a note belongs to. */
export type Hand = 'RH' | 'LH'

/** Per-segment practice stage. See docs/algorithms.md §3. */
export type Stage = 'LISTEN' | 'RH' | 'LH' | 'BOTH_SLOW' | 'BOTH_TARGET' | 'MEMORY' | 'MASTERED'

/** A note the score expects, in beats relative to the start of the song. */
export interface ExpectedNote {
  id: string
  /** MIDI pitch 0..127. */
  pitch: number
  onsetBeat: number
  durBeats: number
  hand: Hand
  segmentId: string
}

/**
 * A note the user played. `t` is `performance.now()` minus the calibrated
 * latency offset (spec rule 3), in milliseconds.
 */
export interface PlayedNote {
  pitch: number
  velocity: number
  /** Note-on time, ms, on the performance.now() timeline minus latency offset. */
  t: number
  /** Note-off time if known. */
  tOff?: number
}

/**
 * One raw MIDI event as stored in a recording / test fixture.
 * Times are ms relative to the first event of the recording.
 */
export interface RecordedEvent {
  t: number
  type: 'on' | 'off' | 'cc'
  /** Pitch for on/off; controller number for cc. */
  n: number
  /** Velocity for on/off; controller value for cc. */
  v: number
}

/** A recording file in test/fixtures. */
export interface Recording {
  name: string
  /** Free-text description, incl. deliberate mistakes. */
  description: string
  /** Where the events came from (a real piano, or synthesised). */
  source: 'piano' | 'synthetic'
  bpm?: number
  events: RecordedEvent[]
}
