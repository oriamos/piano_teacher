import { useCallback, useEffect, useRef, useState } from 'react'
import { config } from '../../config'
import { midi, type MidiInputEvent } from '../../midi/access'
import { beatTimes, computeOffset, type CalibrationResult } from '../../midi/calibration'
import { rawNow, setLatencyOffset } from '../../midi/clock'
import { scheduleNotes, type ScheduledNote } from '../../midi/out'

export type CalibrationPhase = 'idle' | 'countIn' | 'measuring' | 'done'

export interface CalibrationState {
  phase: CalibrationPhase
  /** Beat index currently sounding (for the visual metronome). -1 before start. */
  beat: number
  tapsSoFar: number
  result: CalibrationResult | null
  /** True when the clicks were sent to the piano; false = visual metronome only. */
  clicksOnPiano: boolean
}

const c = config.calibration
const beatMs = 60000 / c.bpm

/**
 * Runs one calibration pass: count-in, then `taps` metronome beats. Every
 * note-on during the measured window counts as a tap. The clicks are
 * scheduled on the piano over MIDI out; a visual beat indicator runs as well
 * for the case where no output is selected.
 */
export function useCalibration() {
  const [state, setState] = useState<CalibrationState>({
    phase: 'idle',
    beat: -1,
    tapsSoFar: 0,
    result: null,
    clicksOnPiano: false,
  })
  const run = useRef<{ startAt: number; measured: number[]; taps: number[] } | null>(null)
  const raf = useRef(0)

  // Collect taps from the MIDI stream (device or on-screen keyboard).
  useEffect(() => {
    return midi.onInput((e: MidiInputEvent) => {
      const r = run.current
      if (!r || e.message.type !== 'noteOn') return
      const first = r.measured[0] as number
      const last = r.measured[r.measured.length - 1] as number
      if (e.tRaw < first - beatMs / 2 || e.tRaw > last + beatMs / 2) return
      r.taps.push(e.tRaw)
      setState((s) => ({ ...s, tapsSoFar: r.taps.length }))
    })
  }, [])

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current)
    run.current = null
    setState((s) => ({ ...s, phase: 'idle', beat: -1 }))
  }, [])

  const start = useCallback(() => {
    const startAt = rawNow() + 400
    const totalBeats = c.countInBeats + c.taps
    const all = beatTimes(startAt, c.bpm, totalBeats)
    const measured = all.slice(c.countInBeats)
    run.current = { startAt, measured, taps: [] }

    const output = midi.getOutput()
    if (output) {
      const notes: ScheduledNote[] = all.map((t, i) => ({
        pitch: c.metronomePitch,
        velocity: i === c.countInBeats ? c.metronomeAccentVelocity : c.metronomeVelocity,
        startMs: t - startAt,
        durationMs: c.metronomeDurationMs,
        channel: c.metronomeChannel,
      }))
      scheduleNotes(output, notes, startAt)
    }
    setState({ phase: 'countIn', beat: -1, tapsSoFar: 0, result: null, clicksOnPiano: !!output })

    const endAt = (all[all.length - 1] as number) + beatMs
    const tick = () => {
      const now = rawNow()
      const r = run.current
      if (!r) return
      if (now >= endAt) {
        const result = computeOffset(r.taps, r.measured, c.maxTapDeviationMs)
        run.current = null
        setState((s) => ({ ...s, phase: 'done', beat: -1, result }))
        return
      }
      const beat = Math.floor((now - startAt) / beatMs)
      setState((s) => {
        const phase: CalibrationPhase = beat >= c.countInBeats ? 'measuring' : 'countIn'
        return s.beat === beat && s.phase === phase ? s : { ...s, beat, phase }
      })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const save = useCallback((ms: number) => {
    setLatencyOffset(ms)
    try {
      localStorage.setItem(config.storage.latencyOffsetKey, String(ms))
    } catch {
      /* private mode etc. — the in-memory offset still applies */
    }
  }, [])

  return { state, start, stop, save, beatMs, countInBeats: c.countInBeats, taps: c.taps }
}

/** Restore a previously saved offset at startup. Returns the value applied. */
export function loadSavedOffset(): number {
  try {
    const v = Number(localStorage.getItem(config.storage.latencyOffsetKey))
    if (Number.isFinite(v)) {
      setLatencyOffset(v)
      return v
    }
  } catch {
    /* ignore */
  }
  return 0
}
