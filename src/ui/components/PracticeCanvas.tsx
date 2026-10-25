import { useEffect, useRef } from 'react'
import { config } from '../../config'
import { midi, type MidiInputEvent } from '../../midi/access'
import { now } from '../../midi/clock'
import type { Song } from '../../engine/types'
import { darkKeyboardTheme, drawKeyboard, type PressedKey } from '../../render/drawKeyboard'
import { drawFallingNotes } from '../../render/fallingNotes'
import { hitTest, keyboardLayout, type KeyboardLayout } from '../../render/keyboardLayout'
import type { FrameState } from '../player/usePractice'

interface Props {
  song: Song
  frame: FrameState
  loop: { startBeat: number; endBeat: number }
  fadeLevel: number
  lookaheadBeats: number
}

/** Falling notes above, keyboard below, on one canvas, redrawn every frame. */
export function PracticeCanvas({ song, frame, loop, fadeLevel, lookaheadBeats }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layoutRef = useRef<KeyboardLayout | null>(null)
  const keyboardY = useRef(0)
  const pressed = useRef(new Map<number, PressedKey>())
  const touched = useRef(new Map<number, number>())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      const kbH = Math.max(90, Math.min(160, h * 0.22))
      keyboardY.current = h - kbH
      layoutRef.current = keyboardLayout(
        w,
        kbH,
        config.midi.lowestPitch,
        config.midi.highestPitch,
        config.render.blackKeyHeightRatio,
        config.render.blackKeyWidthRatio,
      )
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    return midi.onInput((e: MidiInputEvent) => {
      const m = e.message
      if (m.type === 'noteOn') pressed.current.set(m.pitch, { velocity: m.velocity })
      else if (m.type === 'noteOff') pressed.current.delete(m.pitch)
    })
  }, [])

  useEffect(() => {
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const canvas = canvasRef.current
      const layout = layoutRef.current
      const ctx = canvas?.getContext('2d')
      const f = frame
      if (!canvas || !layout || !ctx) return
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const t = now()
      drawFallingNotes(ctx, layout, song.notes, f.playheadBeat, keyboardY.current, f.feedback, {
        lookaheadBeats,
        historyBeats: Math.max(0.5, lookaheadBeats * 0.15),
        beatsPerBar: song.beatsPerBar,
        fadeLevel,
        startBeat: loop.startBeat,
        endBeat: loop.endBeat,
        waitingAtBeat: f.waitingAtBeat,
        nowMs: t,
      })
      // Keyboard: pressed keys coloured by feedback (wrong = red flash), targets outlined at level 0.
      const pressedView = new Map<number, PressedKey>()
      for (const [pitch, p] of pressed.current) {
        const wrongAt = f.wrongFlashes.get(pitch)
        const isWrong = wrongAt !== undefined && t - wrongAt < 400
        const color = isWrong
          ? '#ff5d5d'
          : f.targets.has(pitch) || fadeLevel > 0
            ? '#3ddc84'
            : undefined
        pressedView.set(pitch, color ? { velocity: p.velocity, color } : p)
      }
      const targets = new Map<number, string>()
      if (fadeLevel === 0)
        for (const [pitch, hand] of f.targets)
          targets.set(
            pitch,
            hand === 'RH' ? config.render.rightHandColor : config.render.leftHandColor,
          )
      ctx.save()
      ctx.translate(0, keyboardY.current)
      drawKeyboard(ctx, layout, pressedView, darkKeyboardTheme, true, targets)
      ctx.restore()
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [song, frame, loop, fadeLevel, lookaheadBeats])

  const pitchAt = (ev: React.PointerEvent<HTMLCanvasElement>): number | null => {
    const layout = layoutRef.current
    const r = canvasRef.current?.getBoundingClientRect()
    if (!layout || !r) return null
    return hitTest(layout, ev.clientX - r.left, ev.clientY - r.top - keyboardY.current)
  }
  const onDown = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const pitch = pitchAt(ev)
    if (pitch === null) return
    touched.current.set(ev.pointerId, pitch)
    midi.injectMessage({ type: 'noteOn', channel: 0, pitch, velocity: 90 })
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
      className="practice-canvas"
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
    />
  )
}
