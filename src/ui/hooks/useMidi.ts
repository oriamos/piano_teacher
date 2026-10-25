import { useEffect, useState } from 'react'
import { midi, type MidiInputEvent, type MidiState } from '../../midi/access'

/** Subscribe a component to the MIDI manager's state. */
export function useMidiState(): MidiState {
  const [state, setState] = useState<MidiState>(() => midi.getState())
  useEffect(() => midi.onState(setState), [])
  return state
}

/**
 * Subscribe to input events without re-rendering per note. The handler runs
 * on the MIDI event itself (outside React's render cycle), which is what the
 * <30ms latency requirement needs.
 */
export function useMidiInput(handler: (e: MidiInputEvent) => void): void {
  useEffect(() => midi.onInput(handler), [handler])
}
