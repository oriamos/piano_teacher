/**
 * Web MIDI connection management: enumeration, auto-selection of the piano,
 * hot-plug, and delivery of parsed input events with corrected timestamps.
 */
import { config } from '../config'
import { eventTime, getLatencyOffset, handlingLatency, rawEventTime, rawNow } from './clock'
import { parseMidiMessage, type MidiMessage } from './messages'
import { pickPort, type PortInfo } from './select'

export type MidiStatus = 'unsupported' | 'idle' | 'requesting' | 'denied' | 'ready'

export interface MidiInputEvent {
  message: MidiMessage
  /** Corrected time (performance.now() minus latency offset). */
  t: number
  /** Uncorrected performance.now()-timeline time, for calibration. */
  tRaw: number
  /** ms between the browser receiving the message and our handler running. */
  handlingLatencyMs: number
  /** Which port it came from. */
  portId: string
  /** False for events synthesised by the on-screen keyboard. */
  fromDevice: boolean
}

export interface MidiState {
  status: MidiStatus
  inputs: PortInfo[]
  outputs: PortInfo[]
  selectedInputId: string | null
  selectedOutputId: string | null
  /** The selected input was connected and has now disappeared. */
  inputLost: boolean
  error?: string | undefined
}

type Listener<T> = (payload: T) => void

/**
 * Owns the single MIDIAccess object for the app.
 *
 * Emits:
 * - `state`: whenever ports or selection change (hot-plug included)
 * - `input`: for every parsed MIDI message from the selected input
 */
export class MidiManager {
  private access: MIDIAccess | null = null
  private boundInput: MIDIInput | null = null
  private state: MidiState = {
    status:
      typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator ? 'idle' : 'unsupported',
    inputs: [],
    outputs: [],
    selectedInputId: null,
    selectedOutputId: null,
    inputLost: false,
  }
  private stateListeners = new Set<Listener<MidiState>>()
  private inputListeners = new Set<Listener<MidiInputEvent>>()

  getState(): MidiState {
    return this.state
  }

  onState(fn: Listener<MidiState>): () => void {
    this.stateListeners.add(fn)
    return () => this.stateListeners.delete(fn)
  }

  onInput(fn: Listener<MidiInputEvent>): () => void {
    this.inputListeners.add(fn)
    return () => this.inputListeners.delete(fn)
  }

  /** Ask the browser for MIDI access (prompts the user once in Chrome). */
  async connect(): Promise<void> {
    if (this.state.status === 'unsupported') return
    if (this.access) return
    this.setState({ status: 'requesting', error: undefined })
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false })
      this.access = access
      access.onstatechange = () => this.refreshPorts()
      this.setState({ status: 'ready' })
      this.refreshPorts()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.setState({ status: 'denied', error: message })
    }
  }

  /** Manually choose an input port (overrides auto-selection until it disconnects). */
  selectInput(id: string | null): void {
    this.setState({ selectedInputId: id, inputLost: false })
    this.bindInput()
  }

  selectOutput(id: string | null): void {
    this.setState({ selectedOutputId: id })
  }

  /** The currently selected MIDIOutput, if any. */
  getOutput(): MIDIOutput | null {
    const id = this.state.selectedOutputId
    if (!this.access || !id) return null
    return this.access.outputs.get(id) ?? null
  }

  /**
   * Feed a message as if it came from the piano. Used by the on-screen
   * keyboard for development without hardware; marked `fromDevice: false`.
   */
  injectMessage(message: MidiMessage): void {
    const tRaw = rawNow()
    this.emitInput({
      message,
      t: tRaw - getLatencyOffset(),
      tRaw,
      handlingLatencyMs: 0,
      portId: 'virtual',
      fromDevice: false,
    })
  }

  private refreshPorts(): void {
    if (!this.access) return
    const inputs = Array.from(this.access.inputs.values()).map(toInfo)
    const outputs = Array.from(this.access.outputs.values()).map(toInfo)

    const prevIn = this.state.selectedInputId
    const pickedIn = pickPort(inputs, config.midi.preferredDeviceName, prevIn)
    const prevInStillThere = inputs.some((p) => p.id === prevIn && p.state === 'connected')
    // Keep a manual choice while it is connected; otherwise fall back to auto-pick.
    const selectedInputId = prevInStillThere ? prevIn : (pickedIn?.id ?? null)
    const inputLost = prevIn !== null && !prevInStillThere && selectedInputId === null

    const prevOut = this.state.selectedOutputId
    const prevOutStillThere = outputs.some((p) => p.id === prevOut && p.state === 'connected')
    const pickedOut = pickPort(outputs, config.midi.preferredDeviceName, prevOut)
    const selectedOutputId = prevOutStillThere ? prevOut : (pickedOut?.id ?? null)

    this.setState({ inputs, outputs, selectedInputId, selectedOutputId, inputLost })
    this.bindInput()
  }

  private bindInput(): void {
    if (!this.access) return
    const id = this.state.selectedInputId
    const next = id ? (this.access.inputs.get(id) ?? null) : null
    if (next === this.boundInput) return
    if (this.boundInput) this.boundInput.onmidimessage = null
    this.boundInput = next
    if (next) {
      next.onmidimessage = (e: MIDIMessageEvent) => {
        if (!e.data) return
        const message = parseMidiMessage(e.data)
        this.emitInput({
          message,
          t: eventTime(e),
          tRaw: rawEventTime(e),
          handlingLatencyMs: handlingLatency(e),
          portId: next.id,
          fromDevice: true,
        })
      }
    }
  }

  private emitInput(ev: MidiInputEvent): void {
    for (const fn of this.inputListeners) fn(ev)
  }

  private setState(patch: Partial<MidiState>): void {
    this.state = { ...this.state, ...patch }
    for (const fn of this.stateListeners) fn(this.state)
  }
}

function toInfo(p: MIDIPort): PortInfo {
  return {
    id: p.id,
    name: p.name ?? '(unnamed)',
    manufacturer: p.manufacturer ?? '',
    state: p.state === 'connected' ? 'connected' : 'disconnected',
  }
}

/** App-wide singleton. */
export const midi = new MidiManager()
