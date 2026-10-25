/**
 * The practice session controller: one loop range of one song, in one mode.
 *
 * Pure: the clock, the output and the event sink are injected, so the whole
 * thing is driven in tests with a fake clock. The browser adapter
 * (`src/ui/player`) maps `schedule` to MIDI out or the synth and calls
 * `tick` once per animation frame.
 */
import { config } from '../config'
import { groupNotes, type NoteGroup } from './groups'
import { scoreRun, scoreWaitRun, type RunScore } from './scoring'
import { beatMs, beatToMs, matchWindowMs, msToBeat } from './time'
import { TimedMatcher, type NoteClass } from './timedMatcher'
import type { ExpectedNote, Hand, Song } from './types'
import { WaitMatcher } from './waitMatcher'

export type Mode = 'listen' | 'wait' | 'practice'
export type HandSelection = Hand | 'BOTH'

export interface PracticeOptions {
  mode: Mode
  hand: HandSelection
  /** Percent of the original tempo (listen and practice modes). */
  tempoPct: number
  /** Loop range in beats; `[0, song.totalBeats]` for the whole song. */
  loop: { startBeat: number; endBeat: number }
  metronome: boolean
  /** One bar of count-in before timed runs. */
  countIn: boolean
  /** Play the hand that is not being practised on the output. */
  autoHand: boolean
  /** Restart automatically after the summary. */
  autoRepeat: boolean
  /** How long the end-of-run summary is shown before the next run. */
  summaryMs: number
}

export interface ScheduledOut {
  pitch: number
  velocity: number
  /** Corrected time, ms. */
  atMs: number
  durMs: number
  kind: 'note' | 'click'
}

export type FeedbackResult = NoteClass | 'wrong' | 'missed' | 'hit'

export type PracticeEvent =
  | { type: 'started'; startT: number; run: number }
  | {
      type: 'feedback'
      noteId: string | null
      pitch: number
      result: FeedbackResult
      deltaMs?: number
    }
  | { type: 'advance'; group: number | null }
  | { type: 'runEnd'; run: number; score: RunScore }
  | { type: 'stopped' }

export interface PracticeHooks {
  now(): number
  emit(e: PracticeEvent): void
  schedule(out: ScheduledOut[]): void
  cancelScheduled(): void
}

export type Phase = 'idle' | 'countIn' | 'running' | 'summary'

export interface PracticeState {
  phase: Phase
  run: number
  /** Beat the playhead is at (timed modes) or waiting on (wait mode). */
  playheadBeat: number
}

export class PracticeSession {
  readonly msPerBeat: number
  readonly windowMs: number
  /** Notes of the practised hand(s) inside the loop, sorted. */
  readonly practised: ExpectedNote[]
  /** Notes of the other hand inside the loop (for the auto-hand). */
  readonly other: ExpectedNote[]
  readonly groups: NoteGroup[]

  private phase: Phase = 'idle'
  private run = 0
  private startT = 0
  private endT = 0
  private summaryUntil = 0
  private wait: WaitMatcher | null = null
  private timed: TimedMatcher | null = null
  private score: RunScore | null = null

  constructor(
    readonly song: Song,
    readonly opts: PracticeOptions,
    private readonly hooks: PracticeHooks,
  ) {
    this.msPerBeat = beatMs(song.bpm, opts.mode === 'wait' ? 100 : opts.tempoPct)
    this.windowMs = matchWindowMs(song.bpm, opts.tempoPct)
    const { startBeat, endBeat } = opts.loop
    const inLoop = song.notes.filter((n) => n.onsetBeat >= startBeat && n.onsetBeat < endBeat)
    const isPractised = (n: ExpectedNote) => opts.hand === 'BOTH' || n.hand === opts.hand
    this.practised = inLoop.filter(isPractised)
    this.other = inLoop.filter((n) => !isPractised(n))
    const windowBeats = config.midi.chordGroupWindowMs / beatMs(song.bpm)
    this.groups = groupNotes(this.practised, windowBeats)
  }

  getState(): PracticeState {
    return { phase: this.phase, run: this.run, playheadBeat: this.playheadBeat(this.hooks.now()) }
  }

  get lastScore(): RunScore | null {
    return this.score
  }

  /** Begin (or restart) a run. */
  start(): void {
    const now = this.hooks.now()
    this.hooks.cancelScheduled()
    this.run++
    this.score = null
    const { startBeat, endBeat } = this.opts.loop
    const countInBeats = this.opts.countIn && this.opts.mode !== 'wait' ? this.song.beatsPerBar : 0
    this.startT = now + 200 + countInBeats * this.msPerBeat
    this.endT = beatToMs(endBeat, startBeat, this.startT, this.msPerBeat)

    const out: ScheduledOut[] = []
    if (this.opts.mode !== 'wait') {
      if (this.opts.metronome || countInBeats > 0) {
        const firstBeat = countInBeats > 0 ? startBeat - countInBeats : startBeat
        const lastBeat = this.opts.metronome ? endBeat : startBeat
        for (let b = firstBeat; b < lastBeat; b++) {
          const accent =
            (((b - startBeat) % this.song.beatsPerBar) + this.song.beatsPerBar) %
              this.song.beatsPerBar ===
            0
          out.push({
            pitch: config.calibration.metronomePitch,
            velocity: accent
              ? config.calibration.metronomeAccentVelocity
              : config.calibration.metronomeVelocity,
            atMs: beatToMs(b, startBeat, this.startT, this.msPerBeat),
            durMs: config.calibration.metronomeDurationMs,
            kind: 'click',
          })
        }
      }
      const toPlay =
        this.opts.mode === 'listen'
          ? [...this.practised, ...this.other]
          : this.opts.autoHand
            ? this.other
            : []
      for (const n of toPlay) out.push(this.noteOut(n, this.startT))
    }
    if (out.length) this.hooks.schedule(out)

    if (this.opts.mode === 'wait') {
      this.wait = new WaitMatcher(this.groups, config.matching.waitModeChordWindowMs)
      this.timed = null
      this.phase = 'running'
      // Other-hand notes that sound at the very first group.
      this.playOtherAt(this.groups[0]?.onsetBeat ?? startBeat, -Infinity, now)
    } else {
      this.wait = null
      this.timed =
        this.opts.mode === 'practice'
          ? new TimedMatcher(
              this.practised.map((n) => ({
                id: n.id,
                pitch: n.pitch,
                onsetMs: beatToMs(n.onsetBeat, startBeat, this.startT, this.msPerBeat),
              })),
              this.windowMs,
            )
          : null
      this.phase = countInBeats > 0 ? 'countIn' : 'running'
    }
    this.hooks.emit({ type: 'started', startT: this.startT, run: this.run })
  }

  stop(): void {
    this.hooks.cancelScheduled()
    this.phase = 'idle'
    this.wait = null
    this.timed = null
    this.hooks.emit({ type: 'stopped' })
  }

  /** Where the playhead is, in beats, at corrected time `t`. */
  playheadBeat(t: number): number {
    const { startBeat } = this.opts.loop
    switch (this.phase) {
      case 'idle':
        return startBeat
      case 'summary':
        return this.opts.mode === 'wait' ? this.opts.loop.endBeat : this.opts.loop.endBeat
      default:
        if (this.opts.mode === 'wait')
          return this.wait?.current?.onsetBeat ?? this.opts.loop.endBeat
        return msToBeat(t, startBeat, this.startT, this.msPerBeat)
    }
  }

  /** The group the wait-mode cursor is on (null outside wait mode / when done). */
  currentGroup(): NoteGroup | null {
    return this.wait?.current ?? null
  }

  noteOn(pitch: number, _velocity: number, t: number): void {
    if (this.phase !== 'running' && this.phase !== 'countIn') return
    if (this.wait) {
      const prevBeat = this.wait.current?.onsetBeat ?? this.opts.loop.endBeat
      for (const r of this.wait.onNoteOn(pitch, t)) {
        if (r.kind === 'hit')
          this.hooks.emit({ type: 'feedback', noteId: r.noteId, pitch, result: 'hit' })
        else if (r.kind === 'wrong')
          this.hooks.emit({ type: 'feedback', noteId: null, pitch, result: 'wrong' })
        else if (r.kind === 'advance') {
          this.hooks.emit({ type: 'advance', group: r.toGroup })
          const nextBeat = this.wait.current?.onsetBeat ?? this.opts.loop.endBeat
          this.playOtherAt(nextBeat, prevBeat, t)
          if (this.wait.done) this.endRun(t)
        }
      }
    } else if (this.timed) {
      const r = this.timed.onNoteOn(pitch, t)
      if (r.kind === 'hit')
        this.hooks.emit({
          type: 'feedback',
          noteId: r.noteId,
          pitch,
          result: r.cls,
          deltaMs: r.deltaMs,
        })
      else this.hooks.emit({ type: 'feedback', noteId: null, pitch, result: 'wrong' })
    }
  }

  noteOff(_pitch: number, _t: number): void {
    /* durations are not evaluated in the MVP */
  }

  /** Call once per frame. Handles count-in → running, misses, run end, auto-repeat. */
  tick(t: number): void {
    switch (this.phase) {
      case 'countIn':
        if (t >= this.startT) this.phase = 'running'
        return
      case 'running':
        if (this.timed) {
          for (const id of this.timed.tick(t)) {
            const n = this.practised.find((x) => x.id === id)
            this.hooks.emit({
              type: 'feedback',
              noteId: id,
              pitch: n?.pitch ?? 0,
              result: 'missed',
            })
          }
        }
        if (this.opts.mode !== 'wait' && t >= this.endT + this.windowMs) this.endRun(t)
        return
      case 'summary':
        if (this.opts.autoRepeat && t >= this.summaryUntil) this.start()
        return
      default:
        return
    }
  }

  private endRun(t: number): void {
    if (this.wait) {
      this.score = scoreWaitRun(this.wait.stats.hits, this.wait.stats.wrong)
    } else if (this.timed) {
      for (const id of this.timed.finish()) {
        const n = this.practised.find((x) => x.id === id)
        this.hooks.emit({ type: 'feedback', noteId: id, pitch: n?.pitch ?? 0, result: 'missed' })
      }
      this.score = scoreRun({ ...this.timed.stats, windowMs: this.windowMs })
    } else {
      this.score = scoreRun({ expected: 0, hits: 0, extra: 0, missed: 0, deltas: [], windowMs: 1 })
    }
    this.phase = 'summary'
    this.summaryUntil = t + this.opts.summaryMs
    this.hooks.emit({ type: 'runEnd', run: this.run, score: this.score })
  }

  /** Wait mode auto-hand: play other-hand notes with onset in (prevBeat, nextBeat]. */
  private playOtherAt(nextBeat: number, prevBeat: number, t: number): void {
    if (!this.opts.autoHand || this.other.length === 0) return
    const out = this.other
      .filter((n) => n.onsetBeat > prevBeat && n.onsetBeat <= nextBeat)
      .map((n) => ({ ...this.noteOut(n, t), atMs: t + 5 }))
    if (out.length) this.hooks.schedule(out)
  }

  private noteOut(n: ExpectedNote, startT: number): ScheduledOut {
    return {
      pitch: n.pitch,
      velocity: n.velocity,
      atMs: beatToMs(n.onsetBeat, this.opts.loop.startBeat, startT, this.msPerBeat),
      durMs: Math.max(40, n.durBeats * this.msPerBeat * 0.9),
      kind: 'note',
    }
  }
}

/** Default options for a new session on a song. */
export function defaultPracticeOptions(song: Song): PracticeOptions {
  return {
    mode: 'wait',
    hand: 'BOTH',
    tempoPct: config.tempo.startPct,
    loop: { startBeat: 0, endBeat: song.totalBeats },
    metronome: false,
    countIn: true,
    autoHand: true,
    autoRepeat: true,
    summaryMs: 3000,
  }
}
