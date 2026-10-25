/**
 * Falling notes on Canvas 2D (ADR 0001).
 *
 * The keyboard sits at the bottom; a note reaches the keyboard line when the
 * playhead reaches its onset. Time runs top to bottom: `y = keyboardY −
 * (onsetBeat − playhead) · pxPerBeat`, height = durBeats · pxPerBeat.
 *
 * Colours: hand colour until the note gets feedback, then the feedback colour.
 * Fade levels (docs/algorithms.md §6): stage 1 implements 0 and 1; the others
 * arrive with stage 2 but the hook is here.
 */
import type { ExpectedNote } from '../engine/types'
import type { KeyboardLayout } from './keyboardLayout'

export type NoteFeedback = 'hit' | 'precise' | 'early' | 'late' | 'wrong' | 'missed'

export interface FallingNotesTheme {
  rh: string
  lh: string
  rhBlack: string
  lhBlack: string
  feedback: Record<NoteFeedback, string>
  playhead: string
  barLine: string
  beatLine: string
  text: string
}

/** Values mirror DESIGN.md. */
export const darkFallingTheme: FallingNotesTheme = {
  rh: '#f5c40d',
  lh: '#c28efb',
  rhBlack: '#b38d00',
  lhBlack: '#915dc5',
  feedback: {
    hit: '#3ce074',
    precise: '#3ce074',
    early: '#50b0ff',
    late: '#ff822a',
    wrong: '#fc4447',
    missed: '#fc4447',
  },
  playhead: 'rgba(245, 238, 224, 0.45)',
  barLine: 'rgba(245, 238, 224, 0.16)',
  beatLine: 'rgba(245, 238, 224, 0.06)',
  text: '#8e8479',
}

export interface FallingNotesOptions {
  /** Beats visible above the keyboard line. */
  lookaheadBeats: number
  /** Beats visible below the line (notes that already passed). */
  historyBeats: number
  beatsPerBar: number
  fadeLevel: number
  /** Range to draw; notes outside are skipped. */
  startBeat: number
  endBeat: number
  /** Current wait-mode group onset, for highlighting; null in timed modes. */
  waitingAtBeat: number | null
  /** Monotonic time for blinking, ms. */
  nowMs: number
}

/**
 * Draw the notes into the rectangle (0,0)–(width,keyboardY). The keyboard is
 * drawn separately below `keyboardY` by `drawKeyboard`.
 */
export function drawFallingNotes(
  ctx: CanvasRenderingContext2D,
  layout: KeyboardLayout,
  notes: readonly ExpectedNote[],
  playheadBeat: number,
  keyboardY: number,
  feedback: ReadonlyMap<string, NoteFeedback>,
  opts: FallingNotesOptions,
  theme: FallingNotesTheme = darkFallingTheme,
): void {
  const width = layout.width
  const pxPerBeat = keyboardY / (opts.lookaheadBeats + opts.historyBeats)
  const lineY = keyboardY - opts.historyBeats * pxPerBeat
  const yOf = (beat: number) => lineY - (beat - playheadBeat) * pxPerBeat

  ctx.clearRect(0, 0, width, keyboardY)

  // Grid: beat and bar lines.
  const firstBeat = Math.floor(playheadBeat - opts.historyBeats)
  const lastBeat = Math.ceil(playheadBeat + opts.lookaheadBeats)
  ctx.lineWidth = 1
  for (let b = firstBeat; b <= lastBeat; b++) {
    const isBar = ((b % opts.beatsPerBar) + opts.beatsPerBar) % opts.beatsPerBar === 0
    const y = Math.round(yOf(b)) + 0.5
    ctx.strokeStyle = isBar ? theme.barLine : theme.beatLine
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
    if (isBar && b >= 0) {
      ctx.fillStyle = theme.text
      ctx.font = '12px system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.fillText(String(b / opts.beatsPerBar + 1), 6, y - 2)
    }
  }
  // Loop bounds.
  for (const b of [opts.startBeat, opts.endBeat]) {
    const y = Math.round(yOf(b)) + 0.5
    ctx.strokeStyle = theme.playhead
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
    ctx.setLineDash([])
  }

  if (opts.fadeLevel >= 4) {
    drawPlayhead(ctx, width, lineY, theme)
    return
  }

  const blink = Math.floor(opts.nowMs / 150) % 2 === 0
  for (const n of notes) {
    if (n.onsetBeat < opts.startBeat || n.onsetBeat >= opts.endBeat) continue
    const top = yOf(n.onsetBeat + n.durBeats)
    const bottom = yOf(n.onsetBeat)
    if (bottom < 0 || top > keyboardY) continue
    const key = layout.byPitch.get(n.pitch)
    if (!key) continue

    const fb = feedback.get(n.id)
    let color: string
    if (fb === 'missed') color = blink ? theme.feedback.missed : 'rgba(252, 68, 71, 0.35)'
    else if (fb) color = theme.feedback[fb]
    else
      color =
        n.hand === 'RH'
          ? key.black
            ? theme.rhBlack
            : theme.rh
          : key.black
            ? theme.lhBlack
            : theme.lh

    // Level 2: notes vanish in the lower half of the lookahead.
    let alpha = 1
    if (opts.fadeLevel === 2 && !fb) {
      const progress = (lineY - bottom) / (opts.lookaheadBeats * pxPerBeat) // 1 far, 0 at the line
      alpha = Math.max(0, Math.min(1, (progress - 0.45) / 0.15))
    }
    if (opts.fadeLevel === 3 && !fb && !isPhraseStart(n, notes, opts.beatsPerBar)) alpha = 0
    if (alpha === 0) continue

    const x = key.x + 1
    const w = key.w - 2
    const h = Math.max(4, bottom - top - 2)
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    roundRect(ctx, x, Math.max(0, top), w, Math.min(h, keyboardY - Math.max(0, top)), 3)
    ctx.fill()
    if (opts.waitingAtBeat !== null && Math.abs(n.onsetBeat - opts.waitingAtBeat) < 1e-6 && !fb) {
      ctx.strokeStyle = '#f5eee0'
      ctx.lineWidth = 2
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
  drawPlayhead(ctx, width, lineY, theme)
}

function drawPlayhead(
  ctx: CanvasRenderingContext2D,
  width: number,
  lineY: number,
  theme: FallingNotesTheme,
): void {
  ctx.strokeStyle = theme.playhead
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, lineY)
  ctx.lineTo(width, lineY)
  ctx.stroke()
}

/** First note of a bar counts as a phrase start (stage 2 will use real phrase detection). */
function isPhraseStart(
  n: ExpectedNote,
  notes: readonly ExpectedNote[],
  beatsPerBar: number,
): boolean {
  const bar = Math.floor(n.onsetBeat / beatsPerBar)
  const first = notes.find(
    (m) => m.hand === n.hand && Math.floor(m.onsetBeat / beatsPerBar) === bar,
  )
  return first === n
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}
