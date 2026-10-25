import { useCallback, useEffect, useRef } from 'react'
import { config } from '../../config'
import { midi, type MidiInputEvent } from '../../midi/access'
import { drawKeyboard, type PressedKey } from '../../render/drawKeyboard'
import { hitTest, keyboardLayout, type KeyboardLayout } from '../../render/keyboardLayout'

interface Props {
  /** Allow clicking/touching keys to inject synthetic notes (dev without a piano). */
  clickable?: boolean
  height?: number
}

/**
 * The virtual keyboard. Highlights keys as MIDI events arrive, drawing on the
 * next animation frame rather than through React state so a key press never
 * waits for a render.
 */
export function Keyboard({ clickable = true, height = 140 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layoutRef = useRef<KeyboardLayout | null>(null)
  const pressed = useRef(new Map<number, PressedKey>())
  const frame = useRef(0)
  const touched = useRef(new Map<number, number>()) // pointerId -> pitch

  const redraw = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current
      const layout = layoutRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !layout || !ctx) return
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawKeyboard(ctx, layout, pressed.current)
    })
  }, [])

  // Resize handling: recompute the layout and the backing store.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      layoutRef.current = keyboardLayout(
        w,
        h,
        config.midi.lowestPitch,
        config.midi.highestPitch,
        config.render.blackKeyHeightRatio,
        config.render.blackKeyWidthRatio,
      )
      redraw()
    })
    ro.observe(canvas)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame.current)
    }
  }, [redraw])

  // MIDI → pressed map → redraw.
  useEffect(() => {
    return midi.onInput((e: MidiInputEvent) => {
      const m = e.message
      if (m.type === 'noteOn') pressed.current.set(m.pitch, { velocity: m.velocity })
      else if (m.type === 'noteOff') pressed.current.delete(m.pitch)
      else return
      redraw()
    })
  }, [redraw])

  const pitchAt = (ev: React.PointerEvent<HTMLCanvasElement>): number | null => {
    const layout = layoutRef.current
    const canvas = canvasRef.current
    if (!layout || !canvas) return null
    const r = canvas.getBoundingClientRect()
    return hitTest(layout, ev.clientX - r.left, ev.clientY - r.top)
  }

  const onDown = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    if (!clickable) return
    const pitch = pitchAt(ev)
    if (pitch === null) return
    touched.current.set(ev.pointerId, pitch)
    // Velocity from vertical position: lower on the key = harder.
    const layout = layoutRef.current
    const r = canvasRef.current?.getBoundingClientRect()
    const y = r && layout ? (ev.clientY - r.top) / layout.height : 0.7
    const velocity = Math.round(40 + 87 * Math.min(1, Math.max(0, y)))
    midi.injectMessage({ type: 'noteOn', channel: 0, pitch, velocity })
  }
  const onUp = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const pitch = touched.current.get(ev.pointerId)
    if (pitch === undefined) return
    touched.current.delete(ev.pointerId)
    midi.injectMessage({ type: 'noteOff', channel: 0, pitch, velocity: 0 })
  }

  return (
    <canvas
      ref={canvasRef}
      className="keyboard"
      style={{ height }}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
      aria-label="Virtual piano keyboard"
    />
  )
}
