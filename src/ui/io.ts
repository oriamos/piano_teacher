/**
 * Input and sound routing for the two modes (piano / no piano).
 *
 * Input: the piano over Web MIDI when present; the on-screen keyboard and
 * the computer keyboard always work and inject into the same stream.
 *
 * Sound: 'auto' uses the piano over MIDI out when an output is selected,
 * otherwise the tablet synth. When the synth is the sound source, every
 * input note is echoed to it so the on-screen keyboard is audible.
 */
import { useEffect, useState } from 'react'
import { MidiInstrument, SilentInstrument, type Instrument } from '../audio/instrument'
import { Synth } from '../audio/synth'
import { midi, type MidiInputEvent } from '../midi/access'
import { attachComputerKeyboard } from '../midi/computerKeyboard'
import { getSetting, setSetting } from '../store/db'

export type SoundSource = 'auto' | 'midi' | 'synth' | 'silent'
export type ResolvedSound = 'midi' | 'synth' | 'silent'

const SOUND_KEY = 'soundSource'

export const synth = new Synth()
let soundSource: SoundSource = 'auto'
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

export function resolveSound(): ResolvedSound {
  if (soundSource === 'auto') return midi.getOutput() ? 'midi' : 'synth'
  return soundSource
}

export function getInstrument(): Instrument {
  const r = resolveSound()
  if (r === 'midi') {
    const out = midi.getOutput()
    if (out) return new MidiInstrument(out)
    return synth
  }
  if (r === 'synth') return synth
  return new SilentInstrument()
}

export function getSoundSource(): SoundSource {
  return soundSource
}

export async function setSoundSource(s: SoundSource): Promise<void> {
  soundSource = s
  await setSetting(SOUND_KEY, s)
  if (resolveSound() === 'synth') await synth.resume()
  notify()
}

/** Call once at startup. */
export async function initIo(): Promise<void> {
  soundSource = await getSetting<SoundSource>(SOUND_KEY, 'auto')
  attachComputerKeyboard()
  midi.onState(notify)
  // Echo input to the synth when the synth is the sound source.
  midi.onInput((e: MidiInputEvent) => {
    if (resolveSound() !== 'synth') return
    if (e.message.type === 'noteOn') synth.noteOn(e.message.pitch, e.message.velocity)
    else if (e.message.type === 'noteOff') synth.release(e.message.pitch)
  })
  // Browsers need a user gesture before audio plays.
  const unlock = () => {
    void synth.resume()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
  void midi.connect()
}

/** React view of the routing: re-renders when the MIDI state or the setting changes. */
export function useIo(): {
  soundSource: SoundSource
  resolved: ResolvedSound
  pianoConnected: boolean
} {
  const [, bump] = useState(0)
  useEffect(() => {
    const l = () => bump((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  const st = midi.getState()
  const pianoConnected = st.status === 'ready' && st.selectedInputId !== null && !st.inputLost
  return { soundSource, resolved: resolveSound(), pianoConnected }
}
