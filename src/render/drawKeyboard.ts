/**
 * Canvas 2D drawing of the virtual keyboard. Pressed keys are tinted by
 * velocity. Kept separate from the layout maths so the maths stays testable.
 */
import type { KeyboardLayout } from './keyboardLayout'

export interface KeyboardTheme {
  white: string
  black: string
  whiteBorder: string
  pressed: string
  /** Pressed colour for the "other" hand (used from stage 1 on). */
  pressedAlt: string
  label: string
}

export const darkKeyboardTheme: KeyboardTheme = {
  white: '#e8e6e1',
  black: '#1a1c22',
  whiteBorder: '#8a8a8a',
  pressed: '#4cc9f0',
  pressedAlt: '#f9a03f',
  label: '#555',
}

export interface PressedKey {
  velocity: number
  /** Optional colour override (e.g. hand colour). */
  color?: string
}

/**
 * Draw the keyboard. `pressed` maps pitch → velocity (and optional colour).
 * Call every animation frame, or whenever `pressed` changes.
 */
export function drawKeyboard(
  ctx: CanvasRenderingContext2D,
  layout: KeyboardLayout,
  pressed: ReadonlyMap<number, PressedKey>,
  theme: KeyboardTheme = darkKeyboardTheme,
  labelC = true,
): void {
  const { width, height } = layout
  ctx.clearRect(0, 0, width, height)

  // White keys first, black keys on top.
  for (const k of layout.keys) {
    if (k.black) continue
    const p = pressed.get(k.pitch)
    ctx.fillStyle = p ? tint(p.color ?? theme.pressed, p.velocity) : theme.white
    ctx.fillRect(k.x, k.y, k.w, k.h)
    ctx.strokeStyle = theme.whiteBorder
    ctx.lineWidth = 1
    ctx.strokeRect(k.x + 0.5, k.y + 0.5, k.w - 1, k.h - 1)
    if (labelC && k.pitch % 12 === 0 && k.w >= 14) {
      ctx.fillStyle = theme.label
      ctx.font = `${Math.max(9, Math.floor(k.w * 0.5))}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`C${Math.floor(k.pitch / 12) - 1}`, k.x + k.w / 2, k.h - 4)
    }
  }
  for (const k of layout.keys) {
    if (!k.black) continue
    const p = pressed.get(k.pitch)
    ctx.fillStyle = p ? tint(p.color ?? theme.pressed, p.velocity) : theme.black
    ctx.fillRect(k.x, k.y, k.w, k.h)
  }
}

/** Mix a colour with its darker self according to velocity (1..127). */
function tint(hex: string, velocity: number): string {
  const v = Math.max(0.35, Math.min(1, velocity / 127))
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${Math.round(r * v)}, ${Math.round(g * v)}, ${Math.round(b * v)})`
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  )
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
