# Pedagogy

This is what separates the project from a falling-notes player. Synthesia-style apps show you
the notes forever; here the goal is that you stop needing them. Every principle below maps to
at least one feature and to a metric the system uses to decide whether to move you on.

The starting level is "a few lessons as a child": the user can find middle C and play a scale
slowly. There is no absolute-beginner track.

| Principle                    | Feature                                                                                              | Decision metric                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Hear before you play         | The piano plays every new segment (twice, at tempo) before practice, and every drill before its loop | –                                  |
| Chunking                     | Songs split into 2–4 bar segments; advance only after mastering one                                  | Per-segment accuracy and timing    |
| Slow and correct before fast | Wait mode first, then adaptive tempo that rises only after clean runs                                | Percent of original tempo          |
| Hands separately             | Fixed stages per segment: RH → LH → both slow → both at tempo → memory                               | Current stage                      |
| Error-focused practice       | Hotspot detection from per-note / per-transition statistics; automatic drill loops                   | Error rate per note and transition |
| Retrieval practice           | Visual aids fade over five levels to a blank screen; mastery = playing without the screen            | Fade level per segment             |
| Spaced repetition            | SM-2-like scheduling of mastered segments; reviews are always from memory                            | Next due date per segment          |
| Interleaving                 | The daily session mixes reviews, a new segment and drills                                            | Time split in the session          |
| Immediate, precise feedback  | Per-note colour by timing (early / late / wrong), summary after every run                            | Timing deviation in ms, velocity   |

## Why each one

**Hear before you play.** Learning a passage with the ear engaged from the start is what makes
the later "play by ear" module (stage 5) possible at all. It also gives you a target: you know
what the phrase should sound like before you know where the keys are. Implementation: the
`LISTEN` stage; the piano plays over MIDI out so the sound is the real instrument, not a tablet
speaker.

**Chunking.** Whole songs are too big a unit to get feedback on. 2–4 bars is small enough to
repeat ten times in a minute and large enough to be musical. Segments are split automatically
by note density (`content`, stage 1) and can be edited. Once segments n and n+1 are mastered a
stitched segment covering both is unlocked, so the song reassembles bottom-up; the song is
mastered when the stitched segment of the whole song has passed `MEMORY`.

**Slow and correct before fast.** Mistakes practised fast are mistakes learned. Wait mode (the
cursor waits for the right notes) removes time pressure entirely; after that the tempo starts
at 60 % and goes up 5 % after three clean runs, down 10 % after two failed ones. The numbers are
in `config.tempo` and will be tuned after real data.

**Hands separately.** Standard practice, encoded as a state machine so the app, not the user,
decides when to move from RH to LH to both. While one hand is practised the other is either
silent or played by the piano over MIDI out (the "auto-hand"), so you always hear the whole
texture.

**Error-focused practice.** Most of a run is already fine; the time should go to the two notes
that are not. Per-note error rates with exponential decay (α = 0.3) and per-transition timing
variance (hesitation shows up as variance before it shows up as a wrong note) locate hotspots;
the app builds a drill loop around them automatically, wait mode first then 70 %, until five
clean runs.

**Retrieval practice.** Reading the notes off the screen and playing from memory are different
skills, and only the second one is the goal. The five fade levels (full highlight → notes only →
notes that vanish halfway → first note of each phrase → blank) make the transition gradual. A
hint is available on demand on any level and is logged; a run with a hint never counts as
clean for advancing a level. `MEMORY` is passed only at level 4 without hints.

**Spaced repetition.** Mastered segments are scheduled like flashcards: a clean review at full
tempo scores 5 and pushes the next review further out; a failed review resets the interval and
sends the segment back to `BOTH_SLOW`. Reviews start on the blank screen (level 4) so they test
memory, not reading.

**Interleaving.** Blocked practice feels better and works worse. The 25-minute session
alternates review / new / drill / review… so no two consecutive items are alike.

**Immediate, precise feedback.** Within one frame of the note: green on time, blue early,
orange late, red wrong, a blinking missed note. After each run, a 3-second overlay with
accuracy, mean deviation and the top hotspot, then the next item starts by itself. The piano
gestures (two lowest keys = restart, two highest = next) mean hands never leave the keyboard.

## Deliberately absent

Points, badges, streak freezes, friend rankings. Motivation comes from measurable progress:
tempo climbing, segments turning green on the song map, reviews spacing out. A daily streak
counter is shown on the home screen as information, not as a game.

Staff notation is not taught. The user wants to play songs, not read them; falling notes do
the job of telling the hands where to go until memory takes over.
