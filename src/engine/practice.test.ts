import { describe, expect, it } from 'vitest'
import {
  defaultPracticeOptions,
  PracticeSession,
  type PracticeEvent,
  type ScheduledOut,
} from './practice'
import { makeSong, note } from './testUtils'

/** A fake clock + event sink. */
function harness() {
  let t = 0
  const events: PracticeEvent[] = []
  const scheduled: ScheduledOut[][] = []
  let cancels = 0
  const hooks = {
    now: () => t,
    emit: (e: PracticeEvent) => events.push(e),
    schedule: (o: ScheduledOut[]) => scheduled.push(o),
    cancelScheduled: () => cancels++,
  }
  return {
    hooks,
    events,
    scheduled,
    get cancels() {
      return cancels
    },
    set(time: number) {
      t = time
    },
  }
}

// One bar: C E G C' in the right hand, a C2 whole note in the left. 120 bpm → 500 ms/beat.
const song = makeSong(
  [note(60, 0), note(64, 1), note(67, 2), note(72, 3), note(36, 0, 4, 'LH')],
  120,
)

describe('PracticeSession – wait mode', () => {
  it('advances per group, plays the other hand, scores the run', () => {
    const h = harness()
    const s = new PracticeSession(
      song,
      { ...defaultPracticeOptions(song), mode: 'wait', hand: 'RH' },
      h.hooks,
    )
    expect(s.groups.map((g) => g.notes[0]!.pitch)).toEqual([60, 64, 67, 72])
    expect(s.other.map((n) => n.pitch)).toEqual([36])

    s.start()
    expect(s.getState().phase).toBe('running')
    expect(s.playheadBeat(0)).toBe(0)
    // The LH note at beat 0 is played when the cursor arrives at group 0.
    expect(h.scheduled.flat().map((o) => o.pitch)).toEqual([36])

    s.noteOn(61, 100, 10)
    expect(h.events.at(-1)).toMatchObject({ type: 'feedback', result: 'wrong', pitch: 61 })
    s.noteOn(60, 100, 20)
    expect(h.events.at(-2)).toMatchObject({ type: 'feedback', result: 'hit' })
    expect(h.events.at(-1)).toMatchObject({ type: 'advance', group: 1 })
    expect(s.playheadBeat(50)).toBe(1)

    s.noteOn(64, 100, 30)
    s.noteOn(67, 100, 40)
    s.noteOn(72, 100, 50)
    const end = h.events.find((e) => e.type === 'runEnd')
    expect(end).toMatchObject({ type: 'runEnd', run: 1 })
    expect(end && end.type === 'runEnd' ? end.score : null).toMatchObject({
      hits: 4,
      extra: 1,
      verdict: 'neither',
    })
    expect(s.getState().phase).toBe('summary')

    // Auto-repeat after the summary.
    h.set(50 + 3000)
    s.tick(3050)
    expect(s.getState()).toMatchObject({ phase: 'running', run: 2 })
  })

  it('does not run a count-in in wait mode', () => {
    const h = harness()
    const s = new PracticeSession(song, { ...defaultPracticeOptions(song), mode: 'wait' }, h.hooks)
    s.start()
    expect(h.scheduled.flat().filter((o) => o.kind === 'click')).toEqual([])
  })
})

describe('PracticeSession – practice (timed) mode', () => {
  it('counts in, schedules the metronome and the other hand, scores timing', () => {
    const h = harness()
    const opts = {
      ...defaultPracticeOptions(song),
      mode: 'practice' as const,
      hand: 'RH' as const,
      tempoPct: 100,
      metronome: true,
    }
    const s = new PracticeSession(song, opts, h.hooks)
    s.start()
    expect(s.getState().phase).toBe('countIn')
    const startT = 200 + 4 * 500 // 200ms lead + one bar count-in
    expect(h.events[0]).toEqual({ type: 'started', startT, run: 1 })

    const out = h.scheduled.flat()
    const clicks = out.filter((o) => o.kind === 'click')
    expect(clicks).toHaveLength(8) // 4 count-in + 4 in the bar
    expect(clicks[0]!.atMs).toBe(200)
    expect(clicks[4]!.atMs).toBe(startT)
    const lh = out.filter((o) => o.kind === 'note')
    expect(lh).toEqual([expect.objectContaining({ pitch: 36, atMs: startT })])

    s.tick(startT)
    expect(s.getState().phase).toBe('running')
    expect(s.playheadBeat(startT + 500)).toBe(1)

    s.noteOn(60, 90, startT + 20) // precise
    s.noteOn(64, 90, startT + 500 - 90) // early
    s.noteOn(67, 90, startT + 1000 + 100) // late
    // 72 at beat 3 is never played → missed after its window closes
    s.tick(startT + 1500 + 126)
    const results = h.events
      .filter((e) => e.type === 'feedback')
      .map((e) => (e.type === 'feedback' ? e.result : ''))
    expect(results).toEqual(['precise', 'early', 'late', 'missed'])

    s.tick(startT + 2000 + 200)
    const end = h.events.find((e) => e.type === 'runEnd')
    expect(end && end.type === 'runEnd' ? end.score : null).toMatchObject({
      hits: 3,
      missed: 1,
      expected: 4,
    })
  })

  it('listen mode schedules every note of both hands and nothing is matched', () => {
    const h = harness()
    const s = new PracticeSession(
      song,
      { ...defaultPracticeOptions(song), mode: 'listen', countIn: false, tempoPct: 50 },
      h.hooks,
    )
    s.start()
    const notes = h.scheduled.flat().filter((o) => o.kind === 'note')
    expect(notes.map((o) => o.pitch).sort((a, b) => a - b)).toEqual([36, 60, 64, 67, 72])
    expect(notes.find((o) => o.pitch === 64)!.atMs).toBe(200 + 1000) // 50 % tempo → 1000 ms/beat
    s.noteOn(60, 90, 300)
    expect(h.events.filter((e) => e.type === 'feedback')).toEqual([])
  })

  it('respects the loop range', () => {
    const h = harness()
    const s = new PracticeSession(
      song,
      {
        ...defaultPracticeOptions(song),
        mode: 'practice',
        loop: { startBeat: 2, endBeat: 4 },
        countIn: false,
      },
      h.hooks,
    )
    expect(s.practised.map((n) => n.pitch)).toEqual([67, 72])
    s.start()
    expect(s.playheadBeat(200)).toBe(2)
  })

  it('stop cancels scheduled output', () => {
    const h = harness()
    const s = new PracticeSession(
      song,
      { ...defaultPracticeOptions(song), mode: 'listen' },
      h.hooks,
    )
    s.start()
    s.stop()
    expect(h.cancels).toBe(2) // once on start, once on stop
    expect(s.getState().phase).toBe('idle')
    expect(h.events.at(-1)).toEqual({ type: 'stopped' })
  })
})
