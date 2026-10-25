import { useCallback, useEffect, useState } from 'react'
import { config } from '../../config'
import { midi, type MidiInputEvent } from '../../midi/access'
import { getLatencyOffset, rawNow } from '../../midi/clock'
import { noteName } from '../../midi/messages'
import { allNotesOff, scheduleNotes } from '../../midi/out'
import { EventLog } from '../components/EventLog'
import { Keyboard } from '../components/Keyboard'
import { Recorder } from '../components/Recorder'
import { useCalibration } from '../hooks/useCalibration'
import { useMidiState } from '../hooks/useMidi'

/** Notes for the "play on piano" check: a C major arpeggio up and back. */
const TEST_PHRASE = [60, 64, 67, 72, 67, 64, 60].map((pitch, i) => ({
  pitch,
  velocity: 88,
  startMs: i * 220,
  durationMs: 180,
}))

interface InputStats {
  count: number
  last: { pitch: number; velocity: number } | null
  maxLatency: number
  avgLatency: number
}

/**
 * Stage 0 screen: prove the hardware chain works.
 *
 * Pass conditions (SPEC.md, stage 0):
 * 1. a note-on from the piano shows up on screen;
 * 2. a note-on sent from the tablet sounds on the piano.
 */
export function DeviceTest() {
  const state = useMidiState()
  const cal = useCalibration()
  const [stats, setStats] = useState<InputStats>({
    count: 0,
    last: null,
    maxLatency: 0,
    avgLatency: 0,
  })
  const [sentPhrase, setSentPhrase] = useState(false)
  const [heard, setHeard] = useState(false)
  const [offset, setOffset] = useState(getLatencyOffset())

  useEffect(() => {
    void midi.connect()
  }, [])

  // Stats from real device input only (the on-screen keyboard does not count for stage 0).
  useEffect(() => {
    let sum = 0
    return midi.onInput((e: MidiInputEvent) => {
      if (!e.fromDevice || e.message.type !== 'noteOn') return
      const m = e.message
      sum += e.handlingLatencyMs
      setStats((s) => ({
        count: s.count + 1,
        last: { pitch: m.pitch, velocity: m.velocity },
        maxLatency: Math.max(s.maxLatency, e.handlingLatencyMs),
        avgLatency: sum / (s.count + 1),
      }))
    })
  }, [])

  const playPhrase = useCallback(() => {
    const out = midi.getOutput()
    if (!out) return
    scheduleNotes(out, TEST_PHRASE, rawNow() + 100)
    setSentPhrase(true)
  }, [])

  const panic = useCallback(() => {
    const out = midi.getOutput()
    if (out) allNotesOff(out)
  }, [])

  const output = state.selectedOutputId
    ? state.outputs.find((p) => p.id === state.selectedOutputId)
    : undefined
  const input = state.selectedInputId
    ? state.inputs.find((p) => p.id === state.selectedInputId)
    : undefined
  const autoPicked = (p?: { name: string; manufacturer: string }) =>
    !!p &&
    `${p.name} ${p.manufacturer}`
      .toLowerCase()
      .includes(config.midi.preferredDeviceName.toLowerCase())

  return (
    <main className="screen">
      <header className="topbar">
        <h1>Piano Teacher</h1>
        <span className="muted">Stage 0 · device test</span>
        <StatusPill status={state.status} inputLost={state.inputLost} />
      </header>

      {state.status === 'unsupported' && (
        <div className="banner error">
          This browser has no Web MIDI. Use Chrome on Android (or desktop Chrome / Edge) over HTTPS
          or localhost.
        </div>
      )}
      {state.status === 'denied' && (
        <div className="banner error">
          MIDI access was denied: {state.error}. Allow MIDI for this site in Chrome and press
          Connect.
          <button onClick={() => void midi.connect()}>Connect</button>
        </div>
      )}
      {state.inputLost && (
        <div className="banner warn">
          The piano disconnected. Check the USB cable; it will reconnect automatically.
        </div>
      )}

      <section className="row ports">
        <label>
          Input
          <select
            value={state.selectedInputId ?? ''}
            onChange={(e) => midi.selectInput(e.target.value || null)}
            disabled={state.status !== 'ready'}
          >
            <option value="">— none —</option>
            {state.inputs.map((p) => (
              <option key={p.id} value={p.id} disabled={p.state !== 'connected'}>
                {p.name} {p.manufacturer && `(${p.manufacturer})`}
                {p.state !== 'connected' && ' — disconnected'}
              </option>
            ))}
          </select>
          {autoPicked(input) && <span className="tag">auto: CASIO</span>}
        </label>
        <label>
          Output
          <select
            value={state.selectedOutputId ?? ''}
            onChange={(e) => midi.selectOutput(e.target.value || null)}
            disabled={state.status !== 'ready'}
          >
            <option value="">— none —</option>
            {state.outputs.map((p) => (
              <option key={p.id} value={p.id} disabled={p.state !== 'connected'}>
                {p.name} {p.manufacturer && `(${p.manufacturer})`}
                {p.state !== 'connected' && ' — disconnected'}
              </option>
            ))}
          </select>
          {autoPicked(output) && <span className="tag">auto: CASIO</span>}
        </label>
        {state.status === 'idle' && <button onClick={() => void midi.connect()}>Connect</button>}
      </section>

      <Keyboard />

      <section className="cards">
        <article className="card">
          <h2>1 · Piano → tablet</h2>
          {stats.last ? (
            <>
              <p className="big">
                {noteName(stats.last.pitch)}{' '}
                <span className="muted">velocity {stats.last.velocity}</span>
              </p>
              <p className="muted">
                {stats.count} note-ons · handling latency avg {stats.avgLatency.toFixed(1)} ms, max{' '}
                {stats.maxLatency.toFixed(1)} ms
              </p>
            </>
          ) : (
            <p className="muted">Waiting for a note from the piano…</p>
          )}
          <Check ok={stats.count > 0} label="note-on from the piano appears on screen" />
        </article>

        <article className="card">
          <h2>2 · Tablet → piano</h2>
          <p className="muted">
            Sends a C major arpeggio to <b>{output?.name ?? 'no output selected'}</b>, scheduled
            with Web MIDI timestamps.
          </p>
          <div className="actions">
            <button className="primary" onClick={playPhrase} disabled={!output}>
              Play on piano
            </button>
            <button onClick={panic} disabled={!output} title="All notes off">
              Silence
            </button>
            <button onClick={() => setHeard(true)} disabled={!sentPhrase}>
              I heard it
            </button>
          </div>
          <Check ok={heard} label="note-on sent from the tablet sounds on the piano" />
        </article>

        <article className="card">
          <h2>3 · Latency calibration</h2>
          <p className="muted">
            {cal.countInBeats} count-in beats, then play any key on each of {cal.taps} beats at{' '}
            {config.calibration.bpm} BPM. The click comes from the piano
            {!output && ' (no output: watch the dot instead)'}.
          </p>
          <div className="actions">
            {cal.state.phase === 'idle' || cal.state.phase === 'done' ? (
              <button className="primary" onClick={cal.start}>
                Start
              </button>
            ) : (
              <button onClick={cal.stop}>Cancel</button>
            )}
            <Metronome
              beat={cal.state.beat}
              measuring={cal.state.phase === 'measuring'}
              active={cal.state.phase === 'countIn' || cal.state.phase === 'measuring'}
            />
            {cal.state.phase === 'measuring' && (
              <span className="muted">
                taps {cal.state.tapsSoFar}/{cal.taps}
              </span>
            )}
          </div>
          {cal.state.result && (
            <CalibrationSummary
              result={cal.state.result}
              onSave={(ms) => {
                cal.save(ms)
                setOffset(ms)
              }}
            />
          )}
          <p className="muted">
            Current offset: <b>{offset.toFixed(1)} ms</b> (subtracted from every timestamp)
          </p>
        </article>
      </section>

      <section className="card">
        <h2>Event log</h2>
        <Recorder />
        <EventLog />
      </section>
    </main>
  )
}

function StatusPill({ status, inputLost }: { status: string; inputLost: boolean }) {
  const text = inputLost
    ? 'piano disconnected'
    : status === 'ready'
      ? 'Web MIDI ready'
      : status === 'requesting'
        ? 'requesting access…'
        : status
  const cls =
    inputLost || status === 'denied' || status === 'unsupported'
      ? 'bad'
      : status === 'ready'
        ? 'good'
        : ''
  return <span className={`pill ${cls}`}>{text}</span>
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className={`check ${ok ? 'ok' : ''}`}>
      <span className="box">{ok ? '✓' : ''}</span> {label}
    </p>
  )
}

function Metronome({
  beat,
  measuring,
  active,
}: {
  beat: number
  measuring: boolean
  active: boolean
}) {
  if (!active) return null
  return (
    <span className={`dot ${beat % 2 === 0 ? 'on' : ''} ${measuring ? 'measuring' : ''}`}>
      {beat >= 0 ? (measuring ? beat - config.calibration.countInBeats + 1 : '·') : ''}
    </span>
  )
}

function CalibrationSummary({
  result,
  onSave,
}: {
  result: ReturnType<typeof useCalibration>['state']['result'] & object
  onSave: (ms: number) => void
}) {
  const enough = result.deltas.length >= Math.ceil(config.calibration.taps / 2)
  return (
    <div className="summary">
      <p>
        {result.deltas.length} taps accepted
        {result.rejected > 0 && `, ${result.rejected} ignored as outliers`}. Mean{' '}
        <b>{result.meanMs.toFixed(1)} ms</b>, median {result.medianMs.toFixed(1)} ms, spread ±
        {result.sdMs.toFixed(1)} ms.
      </p>
      {enough ? (
        <button className="primary" onClick={() => onSave(Math.round(result.meanMs))}>
          Save {Math.round(result.meanMs)} ms as offset
        </button>
      ) : (
        <p className="muted">Too few taps to trust. Run it again.</p>
      )}
    </div>
  )
}
