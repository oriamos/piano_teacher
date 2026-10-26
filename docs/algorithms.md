# Algorithms

Every number below is a **starting value** and lives in `src/config.ts`. Nothing in the engine
has a literal threshold. The plan is to run with these for two weeks, look at the data, and
tune. When you change a value, change it here too and say why.

Notation: Δ is the actual note time minus the expected note time, in ms (positive = late).

## 1. Note matching

The song is normalised to a list of expected notes `{id, pitch, onsetBeat, durBeats, hand,
segmentId}` (`src/engine/types.ts`). Expected notes whose onsets differ by at most
`midi.chordGroupWindowMs` (30 ms at the current tempo) form one **group** (a chord).

Every note-on from the piano gets `t = event.timeStamp − latencyOffsetMs` (see
[architecture.md](architecture.md) for why `timeStamp`).

**Wait mode.** The cursor stops at the next group and advances when every note of the group
has been pressed within `matching.waitModeChordWindowMs` (200 ms) of each other. A note that is
not in the group counts as wrong and the cursor stays put. There is no timing score in wait
mode; it is about finding the keys.

**Timed mode.** Each played note is matched to the nearest unmatched expected note of the same
pitch within a window W:

```
W = min(matching.maxWindowMs, matching.windowBeatFraction · 60000 / BPM)
  = min(150 ms, 0.25 · beat)
```

A played note with no match inside W is **extra**. An expected note whose window passes
without a match is **missed**.

| Class        | Condition                              | Config               |
| ------------ | -------------------------------------- | -------------------- |
| precise      | \|Δ\| ≤ 50 ms                          | `matching.preciseMs` |
| good         | 50 ms < \|Δ\| ≤ W                      |                      |
| early / late | "good" with the sign of Δ              |                      |
| wrong        | a pitch that is not expected (= extra) |                      |
| missed       | no match within W                      |                      |

Why these: 150 ms is roughly where a note stops sounding "with" the beat to a listener at
moderate tempos; at fast tempos a quarter of a beat is tighter than that, so W shrinks. 50 ms
is about the limit of what a player can hear as a timing error on their own playing.

## 2. Run score

```
acc    = hits / (expected + extra)
timing = 1 − median|Δ| / W
```

| Verdict | Condition                                 | Config                                    |
| ------- | ----------------------------------------- | ----------------------------------------- |
| clean   | acc ≥ 0.95 **and** timing ≥ 0.6           | `scoring.cleanAcc`, `scoring.cleanTiming` |
| failed  | acc < 0.80                                | `scoring.failAcc`                         |
| neither | everything in between: counts for nothing |                                           |

The median rather than the mean keeps one badly late note from sinking an otherwise good run;
`extra` in the denominator stops "play every key and some will match" from scoring. 0.95 on a
4-bar segment of ~40 notes allows two slips. The gap between 0.80 and 0.95 is deliberate: an
in-between run should neither promote nor demote.

## 3. Adaptive tempo and stages

Each segment moves through a state machine:

```
LISTEN → RH → LH → BOTH_SLOW → BOTH_TARGET → MEMORY → MASTERED
```

- **LISTEN**: the piano plays the segment `tempo.listenRepeats` (2) times at the original tempo,
  then wait mode once.
- After wait mode the practice tempo starts at `tempo.startPct` (60 %) of the original.
- After `tempo.cleanRunsToStepUp` (3) consecutive clean runs: +`tempo.stepUpPct` (5 %), capped
  at `tempo.maxPct` (100 %).
- After `tempo.failedRunsToStepDown` (2) consecutive failed runs: −`tempo.stepDownPct` (10 %),
  floored at `tempo.minPct` (40 %).
- **Stage advance**: `tempo.cleanRunsToAdvance` (3) clean runs at the stage's target tempo
  (`tempo.stageTargetPct`): BOTH_SLOW is examined at 70 %, BOTH_TARGET at 100 %, MEMORY at
  100 % on fade level 4 with no hint used.

Steps up are small and steps down are big on purpose: tempo should creep up and drop fast when
things fall apart. 40 % is the floor because below that the segment stops being music and the
motor pattern changes.

**Stitching.** When segments n and n+1 are both mastered a stitched segment (n ∪ n+1) is
created with `parent_ids = [n, n+1]` and starts at BOTH_SLOW (hands-separately is skipped: the
parts are already known). The song is mastered when the stitched segment covering the whole
song passes MEMORY.

## 4. Hotspots and drills

For every expected note i the engine keeps an error rate with exponential decay:

```
err_i ← (1 − α) · err_i + α · [note i was wrong or missed in this run]      α = hotspots.alpha = 0.3
```

Recent runs weigh more, so a hotspot that has been fixed disappears within a handful of runs.

For every transition i → i+1 it keeps the variance of the inter-onset interval. High variance
with correct pitches means hesitation: the fingers do not know the next key yet.

A **hotspot** is a run of notes with `err > hotspots.errRateThreshold` (0.3). The window is
padded by `hotspots.padNotes` (1) note on each side and rounded outwards to
`hotspots.roundToBarFraction` (half a bar) so the drill starts and ends on a musical boundary.

A **drill** loops that window: wait mode first, then at `hotspots.drillTempoPct` (70 %). It ends
after `hotspots.drillCleanRuns` (5) consecutive clean runs. Drills are also fed into the daily
session from the last `session.drillLookbackDays` (3) days.

## 5. Spaced repetition (SM-2 variant)

Each MASTERED segment is reviewed from memory (fade level 4). A review run yields a quality q:

| Review result          | q   | Config                           |
| ---------------------- | --- | -------------------------------- |
| clean at 100 %         | 5   | `srs.quality.cleanAtFullTempo`   |
| clean at a lower tempo | 3   | `srs.quality.cleanAtSlowerTempo` |
| failed                 | 1   | `srs.quality.failed`             |

Intervals in days, with easiness factor EF (initial `srs.initialEf` = 2.5):

```
I₁ = 1,  I₂ = 3,  Iₙ = Iₙ₋₁ · EF
EF' = max(1.3, EF + 0.1 − (5 − q) · (0.08 + 0.02 · (5 − q)))
```

If q < `srs.relearnBelowQ` (3) the interval resets to I₁ and the segment goes back to
BOTH_SLOW. The EF update is SM-2's formula unchanged; the only domain-specific parts are the
mapping from run results to q and the relearn stage.

## 6. Fading levels

| Level | Display                                                           |
| ----- | ----------------------------------------------------------------- |
| 0     | Falling notes **and** the target key highlighted on the keyboard  |
| 1     | Falling notes only                                                |
| 2     | Falling notes that vanish halfway down: you must remember the key |
| 3     | Only the first note of each phrase is shown                       |
| 4     | Blank screen, playing from memory. Only feedback is drawn         |

Inside stages RH … BOTH_TARGET the level goes up by one after `fading.cleanRunsToAdvance` (3)
clean runs at the current level and down by one after `fading.failedRunsToRegress` (2) failed
runs. Using a hint (`fading.hintNotes` = 4 upcoming notes for `fading.hintDurationMs` = 1 s)
voids the run's "clean" for level counting. Spaced reviews always start at level 4 and drop a
level only when q < 3.

Why five levels: the jump from "notes on screen" to "nothing" is too big to make in one step;
level 2 (vanishing notes) is the one that actually trains recall, levels 1 and 3 are the ramps.

## 7. Session builder

Budget `session.budgetMinutes` (25; the home button offers 20–30).

| Slot    | Share of budget | Source                                                   |
| ------- | --------------- | -------------------------------------------------------- |
| reviews | up to 40 %      | segments with `due_at ≤ today`, oldest first             |
| new     | about 40 %      | the next segment in the curriculum / the one in progress |
| drills  | about 20 %      | hotspots from the last 3 days                            |

Items are interleaved: review, new, drill, review, new, … The time for each item is estimated
from the segment's length in beats, its tempo, and the number of runs it typically takes to
pass a stage (initially a fixed guess, later from the user's own attempt history). If reviews
alone would exceed their share, the oldest due ones go first and the rest wait for tomorrow.

## 8. Segmentation and difficulty (`src/content/segmentation.ts`)

Segments are `segmentation.minBars`–`segmentation.maxBars` (2–4) bars. Starting at each
segment's first bar, bars are added until either `maxBars` is reached or the running note
count (both hands) reaches `segmentation.targetNotes` (28). When density forced the cut and
the cut lands mid-phrase, it moves back to the last bar boundary that follows a rest or a long
melody note (`segmentation.phraseRestBeats` = 1 beat without a right-hand onset before the
bar line). A tail shorter than `minBars` is absorbed into the previous segment.

Difficulty per segment, 1–10:

```
raw = 1 + density · densityWeight + chords · chordWeight + (leaps / beats) · leapWeight · 10
```

with density = notes per beat, chords = onsets with two or more notes in one hand, leaps =
consecutive same-hand onsets whose top notes are ≥ `difficulty.leapSemitones` (7) apart.
Weights in `config.difficulty`. Rounded and clamped. This is a first estimate; after the engine
has real per-segment attempt data (stage 2) the weights get fitted to observed time-to-clean.

## 9. Latency calibration (stage 0, `src/midi/calibration.ts`)

Not in the spec's algorithms chapter but worth recording. The piano clicks a metronome at
`calibration.bpm` (80) over MIDI out: `calibration.countInBeats` (4) count-in beats, then
`calibration.taps` (8) measured beats. Every note-on during the measured window is a tap. Each
tap is paired with its nearest beat; taps further than `calibration.maxTapDeviationMs` (250)
from any beat are ignored. The **mean** of the remaining Δs is saved as `latency_offset_ms` and
subtracted from every subsequent timestamp. The screen also shows the median and the spread so
a noisy run is obvious. A run with fewer than half the taps accepted cannot be saved.

This measures the sum of USB + browser delay **and** the player's own tendency to be early or
late on a click, which is the quantity we want: feedback is relative to how the player hears
the beat.
