/**
 * Every numeric threshold in the system lives here (spec rule 2).
 *
 * These are STARTING values taken from the "Algorithms" chapter of SPEC.md.
 * They are meant to be tuned after a couple of weeks of real practice data,
 * which is why none of them is hard-coded inside the engine.
 *
 * See docs/algorithms.md for the rationale behind each number.
 */
export const config = {
  midi: {
    /** Substring (case-insensitive) used to auto-select the piano among MIDI ports. */
    preferredDeviceName: 'CASIO',
    /** Note-ons closer than this are grouped into one chord. */
    chordGroupWindowMs: 30,
    /** Sustain pedal controller number. Received, not evaluated in the MVP. */
    sustainCC: 64,
    /** First and last key of an 88-key piano (A0..C8). */
    lowestPitch: 21,
    highestPitch: 108,
  },

  matching: {
    /** Wait mode: all notes of a chord must arrive within this window. */
    waitModeChordWindowMs: 200,
    /** Timed mode: W = min(maxWindowMs, windowBeatFraction * beatMs). */
    maxWindowMs: 150,
    windowBeatFraction: 0.25,
    /** |Δ| <= preciseMs counts as "precise". preciseMs < |Δ| <= W is "good" (early/late). */
    preciseMs: 50,
  },

  scoring: {
    /** A run is clean when acc >= cleanAcc AND timing >= cleanTiming. */
    cleanAcc: 0.95,
    cleanTiming: 0.6,
    /** A run is failed when acc < failAcc. */
    failAcc: 0.8,
  },

  tempo: {
    /** LISTEN: the piano plays the segment this many times at the original tempo. */
    listenRepeats: 2,
    /** Tempo after wait mode, as a percentage of the original. */
    startPct: 60,
    stepUpPct: 5,
    stepDownPct: 10,
    minPct: 40,
    maxPct: 100,
    cleanRunsToStepUp: 3,
    failedRunsToStepDown: 2,
    /** Clean runs at the stage's target tempo needed to advance a stage. */
    cleanRunsToAdvance: 3,
    /** Target tempo (percent of original) that each stage is examined at. */
    stageTargetPct: {
      RH: 100,
      LH: 100,
      BOTH_SLOW: 70,
      BOTH_TARGET: 100,
      MEMORY: 100,
    },
  },

  hotspots: {
    /** Exponential decay for per-note error rate. Higher = recent history weighs more. */
    alpha: 0.3,
    /** A run of notes with error rate above this is a hotspot. */
    errRateThreshold: 0.3,
    /** The hotspot window is padded by this many notes on each side... */
    padNotes: 1,
    /** ...and then rounded outwards to this fraction of a bar. */
    roundToBarFraction: 0.5,
    /** A drill ends after this many consecutive clean runs. */
    drillCleanRuns: 5,
    /** Drill tempo after its wait-mode pass. */
    drillTempoPct: 70,
  },

  srs: {
    /** SM-2-like intervals, in days. */
    firstIntervalDays: 1,
    secondIntervalDays: 3,
    initialEf: 2.5,
    minEf: 1.3,
    /** q below this resets the interval and sends the segment back to BOTH_SLOW. */
    relearnBelowQ: 3,
    quality: {
      cleanAtFullTempo: 5,
      cleanAtSlowerTempo: 3,
      failed: 1,
    },
  },

  fading: {
    /** Levels 0..4, see docs/algorithms.md §6. Level 4 is the blank screen. */
    maxLevel: 4,
    cleanRunsToAdvance: 3,
    failedRunsToRegress: 2,
    /** Spaced reviews always start at this level. */
    reviewLevel: 4,
    /** On-demand hint: how many upcoming notes to flash, and for how long. */
    hintNotes: 4,
    hintDurationMs: 1000,
  },

  session: {
    budgetMinutes: 25,
    minMinutes: 20,
    maxMinutes: 30,
    /** Share of the budget for due reviews (upper bound), new/in-progress segments, drills. */
    reviewShare: 0.4,
    newShare: 0.4,
    drillShare: 0.2,
    /** Hotspots from the last N days are eligible for drills. */
    drillLookbackDays: 3,
  },

  calibration: {
    /** Number of metronome beats the user plays along to. */
    taps: 8,
    /** Count-in beats before the measured beats start. */
    countInBeats: 4,
    bpm: 80,
    /** The click is sent to the piano over MIDI out (the tablet stays silent). */
    metronomeChannel: 0,
    metronomePitch: 96,
    metronomeVelocity: 72,
    metronomeAccentVelocity: 100,
    metronomeDurationMs: 60,
    /** Taps further than this from the nearest beat are ignored as outliers. */
    maxTapDeviationMs: 250,
  },

  gestures: {
    /** Two lowest keys (A0 + B0) pressed together: restart the segment. */
    restartKeys: [21, 23],
    /** Two highest keys (B7 + C8) pressed together: skip to the next session item. */
    nextKeys: [107, 108],
    /** Both keys of a gesture must arrive within this window. */
    windowMs: 150,
    /** Timed mode pauses after this long without input. */
    pauseAfterIdleMs: 5000,
  },

  storage: {
    /** Raw note events are kept locally for this long; only aggregates sync. */
    rawEventRetentionDays: 30,
    /** localStorage key for the latency offset until the Dexie store lands (stage 1). */
    latencyOffsetKey: 'piano-teacher.latencyOffsetMs',
  },

  render: {
    /** Hand colours (DESIGN.md): brass for the right hand, violet for the left. */
    rightHandColor: '#f5c40d',
    leftHandColor: '#c28efb',
    /** Virtual keyboard: black key height as a fraction of white key height. */
    blackKeyHeightRatio: 0.62,
    blackKeyWidthRatio: 0.58,
  },
} as const

export type Config = typeof config
