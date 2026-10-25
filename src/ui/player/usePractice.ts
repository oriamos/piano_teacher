/**
 * Browser adapter for the pure PracticeSession: wires MIDI input, the
 * instrument, the corrected clock and an animation-frame tick, and exposes
 * what the React screen needs. Per-note feedback lives in a Map read by the
 * canvas each frame, not in React state.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Instrument } from '../../audio/instrument'
import { now } from '../../midi/clock'
import { midi, type MidiInputEvent } from '../../midi/access'
import {
  PracticeSession,
  type PracticeEvent,
  type PracticeOptions,
  type Phase,
} from '../../engine/practice'
import type { RunScore } from '../../engine/scoring'
import type { Song } from '../../engine/types'
import type { NoteFeedback } from '../../render/fallingNotes'
import { getInstrument } from '../io'

export interface PracticeView {
  phase: Phase
  run: number
  lastScore: RunScore | null
  /** Wrong notes in the current run, for the corner readout. */
  wrongCount: number
}

export interface FrameState {
  playheadBeat: number
  waitingAtBeat: number | null
  /** Pitches the cursor is waiting on (fade level 0 keyboard targets). */
  targets: Map<number, 'RH' | 'LH'>
  feedback: Map<string, NoteFeedback>
  /** Pitches of wrong notes to flash, with the time they were played. */
  wrongFlashes: Map<number, number>
}

export function usePractice(song: Song, opts: PracticeOptions) {
  const [view, setView] = useState<PracticeView>({
    phase: 'idle',
    run: 0,
    lastScore: null,
    wrongCount: 0,
  })
  // Mutable containers read by the canvas each frame (not React state, not refs:
  // they are created once and mutated from MIDI callbacks and the tick).
  const [frame] = useState<FrameState>(() => ({
    playheadBeat: opts.loop.startBeat,
    waitingAtBeat: null,
    targets: new Map(),
    feedback: new Map(),
    wrongFlashes: new Map(),
  }))
  const [instrument] = useState<{ current: Instrument | null }>(() => ({ current: null }))

  const session = useMemo(
    () => createSession(song, opts, frame, instrument, setView),
    [song, opts, frame, instrument],
  )

  // Input → session.
  useEffect(() => {
    return midi.onInput((e: MidiInputEvent) => {
      const m = e.message
      if (m.type === 'noteOn') session.noteOn(m.pitch, m.velocity, e.t)
      else if (m.type === 'noteOff') session.noteOff(m.pitch, e.t)
    })
  }, [session])

  // Frame tick: session.tick + derived frame state.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const t = now()
      session.tick(t)
      const f = frame
      f.playheadBeat = session.playheadBeat(t)
      const g = session.currentGroup()
      f.waitingAtBeat = g && session.getState().phase === 'running' ? g.onsetBeat : null
      f.targets.clear()
      if (g) for (const n of g.notes) f.targets.set(n.pitch, n.hand)
      const st = session.getState()
      setView((v) => (v.phase === st.phase ? v : { ...v, phase: st.phase }))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      session.stop()
    }
  }, [session, frame])

  const start = useCallback(() => session.start(), [session])
  const stop = useCallback(() => session.stop(), [session])

  return { view, frame, start, stop, session }
}

/**
 * Build the session with its browser hooks. Lives outside the hook so the
 * closures that touch refs are created here, not during render.
 */
function createSession(
  song: Song,
  opts: PracticeOptions,
  frame: FrameState,
  instrument: { current: Instrument | null },
  setView: React.Dispatch<React.SetStateAction<PracticeView>>,
): PracticeSession {
  const hooks = {
    now,
    emit: (e: PracticeEvent) => {
      const f = frame
      switch (e.type) {
        case 'started':
          f.feedback.clear()
          f.wrongFlashes.clear()
          setView((v) => ({ ...v, phase: 'running', run: e.run, wrongCount: 0 }))
          break
        case 'feedback':
          if (e.noteId) f.feedback.set(e.noteId, e.result === 'hit' ? 'hit' : e.result)
          if (e.result === 'wrong') {
            f.wrongFlashes.set(e.pitch, now())
            setView((v) => ({ ...v, wrongCount: v.wrongCount + 1 }))
          }
          break
        case 'runEnd':
          setView((v) => ({ ...v, phase: 'summary', lastScore: e.score }))
          break
        case 'stopped':
          setView((v) => ({ ...v, phase: 'idle' }))
          break
        default:
          break
      }
    },
    schedule: (out: { pitch: number; velocity: number; atMs: number; durMs: number }[]) => {
      const inst = instrument.current ?? (instrument.current = getInstrument())
      for (const o of out) inst.play(o.pitch, o.velocity, o.atMs, o.durMs)
    },
    cancelScheduled: () => {
      instrument.current?.allOff()
      instrument.current = getInstrument()
    },
  }
  return new PracticeSession(song, opts, hooks)
}
