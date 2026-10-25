import { useEffect, useRef, useState } from 'react'
import { config } from '../../config'
import { midi, type MidiInputEvent } from '../../midi/access'
import { toRecording, type TimedMessage } from '../../midi/recorder'

/**
 * Records real device input into a fixture file for the engine's tests
 * (test/fixtures/*.json). Only events from the piano are captured.
 */
export function Recorder() {
  const [recording, setRecording] = useState(false)
  const [count, setCount] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const buffer = useRef<TimedMessage[]>([])

  useEffect(() => {
    if (!recording) return
    return midi.onInput((e: MidiInputEvent) => {
      if (!e.fromDevice) return
      buffer.current.push({ message: e.message, t: e.t })
      setCount(buffer.current.length)
    })
  }, [recording])

  const start = () => {
    buffer.current = []
    setCount(0)
    setRecording(true)
  }
  const stop = () => setRecording(false)

  const download = () => {
    const safe = (name.trim() || 'recording').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()
    const rec = toRecording(
      buffer.current,
      safe,
      description.trim() || 'Recorded on the device-test screen.',
      'piano',
      config.calibration.bpm,
    )
    const blob = new Blob([JSON.stringify(rec, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safe}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="recorder">
      <div className="actions">
        {recording ? (
          <button className="danger" onClick={stop}>
            ■ Stop ({count})
          </button>
        ) : (
          <button onClick={start}>● Record fixture</button>
        )}
        <input
          placeholder="fixture name (e.g. bach-minuet-g-rh-bars-1-4)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="what was played, which mistakes on purpose"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button onClick={download} disabled={recording || count === 0}>
          Download JSON
        </button>
      </div>
      <p className="muted">
        Saves piano input as a <code>test/fixtures</code> recording. Public-domain or original music
        only.
      </p>
    </div>
  )
}
