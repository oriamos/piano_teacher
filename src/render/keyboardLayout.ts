/**
 * Geometry of the virtual keyboard (pure maths, no canvas).
 *
 * The layout is computed once per resize and shared by the keyboard drawer,
 * the falling-notes renderer (which needs each pitch's x position) and hit
 * testing for the on-screen keyboard.
 */
import { isBlackKey } from '../midi/messages'

export interface KeyRect {
  pitch: number
  black: boolean
  x: number
  y: number
  w: number
  h: number
}

export interface KeyboardLayout {
  lo: number
  hi: number
  width: number
  height: number
  whiteKeyWidth: number
  keys: KeyRect[]
  /** Quick lookup by pitch. */
  byPitch: Map<number, KeyRect>
}

/**
 * Lay out the keys from `lo` to `hi` (inclusive) in a box of `width` × `height`.
 *
 * White keys share the width equally. Each black key is centred on the
 * boundary between its two white neighbours, which is accurate enough for
 * highlighting and for lining up falling notes.
 *
 * @example keyboardLayout(1040, 120).keys.filter(k => !k.black).length // 52 for an 88-key piano
 */
export function keyboardLayout(
  width: number,
  height: number,
  lo = 21,
  hi = 108,
  blackHeightRatio = 0.62,
  blackWidthRatio = 0.58,
): KeyboardLayout {
  const whites: number[] = []
  for (let p = lo; p <= hi; p++) if (!isBlackKey(p)) whites.push(p)
  const ww = width / Math.max(1, whites.length)
  const bw = ww * blackWidthRatio
  const bh = height * blackHeightRatio

  const keys: KeyRect[] = []
  const byPitch = new Map<number, KeyRect>()
  let whiteIndex = 0
  for (let p = lo; p <= hi; p++) {
    let rect: KeyRect
    if (isBlackKey(p)) {
      // Centre on the right edge of the previous white key.
      const boundaryX = whiteIndex * ww
      rect = { pitch: p, black: true, x: boundaryX - bw / 2, y: 0, w: bw, h: bh }
    } else {
      rect = { pitch: p, black: false, x: whiteIndex * ww, y: 0, w: ww, h: height }
      whiteIndex++
    }
    keys.push(rect)
    byPitch.set(p, rect)
  }
  return { lo, hi, width, height, whiteKeyWidth: ww, keys, byPitch }
}

/** The pitch under (x, y), black keys taking precedence. Null if outside. */
export function hitTest(layout: KeyboardLayout, x: number, y: number): number | null {
  if (x < 0 || y < 0 || x > layout.width || y > layout.height) return null
  for (const k of layout.keys) {
    if (k.black && x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h) return k.pitch
  }
  for (const k of layout.keys) {
    if (!k.black && x >= k.x && x < k.x + k.w) return k.pitch
  }
  return null
}
