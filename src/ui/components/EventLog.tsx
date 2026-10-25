import { useEffect, useRef, useState } from 'react'
import { midi, type MidiInputEvent } from '../../midi/access'
import { noteName } from '../../midi/messages'

interface Row {
  id: number
  t: number
  text: string
  velocity: number | null
  latency: number
  fromDevice: boolean
}

const MAX_ROWS = 40

/** Rolling log of incoming MIDI events, flushed to React once per frame. */
export function EventLog() {
  const [rows, setRows] = useState<Row[]>([])
  const buffer = useRef<Row[]>([])
  const frame = useRef(0)
  const counter = useRef(0)

  useEffect(() => {
    const flush = () => {
      frame.current = 0
      if (buffer.current.length === 0) return
      const add = buffer.current
      buffer.current = []
      setRows((prev) => [...add.reverse(), ...prev].slice(0, MAX_ROWS))
    }
    return midi.onInput((e: MidiInputEvent) => {
      buffer.current.push(toRow(e, counter.current++))
      if (!frame.current) frame.current = requestAnimationFrame(flush)
    })
  }, [])

  if (rows.length === 0) {
    return <p className="muted">No MIDI events yet. Press a key on the piano.</p>
  }
  return (
    <table className="log">
      <thead>
        <tr>
          <th>time (s)</th>
          <th>event</th>
          <th>vel</th>
          <th>handling</th>
          <th>src</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{(r.t / 1000).toFixed(3)}</td>
            <td>{r.text}</td>
            <td>{r.velocity ?? ''}</td>
            <td>{r.latency.toFixed(1)} ms</td>
            <td>{r.fromDevice ? 'piano' : 'screen'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function toRow(e: MidiInputEvent, id: number): Row {
  const m = e.message
  let text: string
  let velocity: number | null = null
  switch (m.type) {
    case 'noteOn':
      text = `note on  ${noteName(m.pitch)} (${m.pitch})`
      velocity = m.velocity
      break
    case 'noteOff':
      text = `note off ${noteName(m.pitch)} (${m.pitch})`
      break
    case 'controlChange':
      text = `cc ${m.controller} = ${m.value}${m.controller === 64 ? ' (sustain)' : ''}`
      break
    default:
      text = `status 0x${m.status.toString(16)} [${m.data.join(', ')}]`
  }
  return { id, t: e.t, text, velocity, latency: e.handlingLatencyMs, fromDevice: e.fromDevice }
}
