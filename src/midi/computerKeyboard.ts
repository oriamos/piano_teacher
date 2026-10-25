/**
 * QWERTY → MIDI for development on a laptop (no-piano mode).
 *
 * Layout (like most DAWs): A W S E D F T G Y H U J K O L P ; ' = C D E F G A B C D E
 * starting at C4; Z / X shift the octave down / up.
 */
import { midi } from './access'

const KEYS: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
  Quote: 17,
}

let base = 60
const down = new Map<string, number>()

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  return (
    !!t &&
    (t.tagName === 'INPUT' ||
      t.tagName === 'TEXTAREA' ||
      t.tagName === 'SELECT' ||
      t.isContentEditable)
  )
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return
  if (e.code === 'KeyZ') {
    base = Math.max(24, base - 12)
    return
  }
  if (e.code === 'KeyX') {
    base = Math.min(96, base + 12)
    return
  }
  const off = KEYS[e.code]
  if (off === undefined || down.has(e.code)) return
  const pitch = base + off
  down.set(e.code, pitch)
  midi.injectMessage({ type: 'noteOn', channel: 0, pitch, velocity: e.shiftKey ? 110 : 80 })
  e.preventDefault()
}

function onKeyUp(e: KeyboardEvent): void {
  const pitch = down.get(e.code)
  if (pitch === undefined) return
  down.delete(e.code)
  midi.injectMessage({ type: 'noteOff', channel: 0, pitch, velocity: 0 })
}

/** Start listening. Returns a function that stops. */
export function attachComputerKeyboard(target: Window = window): () => void {
  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)
  return () => {
    target.removeEventListener('keydown', onKeyDown)
    target.removeEventListener('keyup', onKeyUp)
    down.clear()
  }
}
