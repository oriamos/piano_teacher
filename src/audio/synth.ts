/**
 * A small Web Audio piano-ish synth for the no-piano mode (ADR 0005).
 *
 * Each note is three detuned-free partials (fundamental, 2nd, 3rd harmonic)
 * with a fast attack and an exponential decay, through one master gain and a
 * gentle low-pass. Not a piano, but clear enough to practise against and to
 * hear a demonstration.
 *
 * Scheduling: corrected time → performance.now() → AudioContext time. The
 * conversion is done at schedule time, so the audio thread fires notes on its
 * own clock regardless of main-thread jank.
 */
import { getLatencyOffset } from '../midi/clock'
import type { Instrument } from './instrument'

interface Voice {
  oscs: OscillatorNode[]
  gain: GainNode
  /** Audio-time at which the voice is fully released. */
  endsAt: number
}

export class Synth implements Instrument {
  readonly kind = 'synth' as const
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private scheduled: Voice[] = []
  private held = new Map<number, Voice>()

  /** Must be called from a user gesture once (autoplay policy). */
  async resume(): Promise<void> {
    const ctx = this.context()
    if (ctx.state !== 'running') await ctx.resume()
  }

  private context(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' })
      const lp = this.ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 4200
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.5
      this.master.connect(lp).connect(this.ctx.destination)
    }
    return this.ctx
  }

  /** Corrected ms → AudioContext seconds. */
  private audioTime(atMs: number): number {
    const ctx = this.context()
    const rawMs = atMs + getLatencyOffset()
    return Math.max(ctx.currentTime, ctx.currentTime + (rawMs - performance.now()) / 1000)
  }

  private voice(pitch: number, velocity: number, at: number): Voice {
    const ctx = this.context()
    const gain = ctx.createGain()
    const freq = 440 * 2 ** ((pitch - 69) / 12)
    const v = Math.max(0.05, Math.min(1, velocity / 127))
    const peak = 0.22 * v * v + 0.05 * v
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.006)
    // Piano-like decay: fast at first, then a long tail; higher notes die sooner.
    const tail = Math.max(0.6, 3.2 - (pitch - 40) * 0.03)
    gain.gain.exponentialRampToValueAtTime(peak * 0.35, at + 0.25)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + tail)
    gain.connect(this.master as GainNode)

    const partials: [number, number, OscillatorType][] = [
      [1, 1, 'triangle'],
      [2, 0.35, 'sine'],
      [3, 0.12, 'sine'],
    ]
    const oscs = partials.map(([mult, amp, type]) => {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.value = freq * mult
      const g = ctx.createGain()
      g.gain.value = amp
      osc.connect(g).connect(gain)
      osc.start(at)
      osc.stop(at + tail + 0.05)
      return osc
    })
    return { oscs, gain, endsAt: at + tail + 0.05 }
  }

  private releaseVoice(voice: Voice, at: number): void {
    const g = voice.gain.gain
    g.cancelScheduledValues(at)
    g.setValueAtTime(Math.max(0.0001, g.value), at)
    g.exponentialRampToValueAtTime(0.0001, at + 0.12)
    for (const o of voice.oscs) o.stop(at + 0.15)
    voice.endsAt = at + 0.15
  }

  play(pitch: number, velocity: number, atMs: number, durMs: number): void {
    const at = this.audioTime(atMs)
    const voice = this.voice(pitch, velocity, at)
    this.releaseVoice(voice, at + durMs / 1000)
    this.scheduled.push(voice)
    this.gc()
  }

  noteOn(pitch: number, velocity: number): void {
    const ctx = this.context()
    this.release(pitch)
    this.held.set(pitch, this.voice(pitch, velocity, ctx.currentTime))
  }

  release(pitch: number): void {
    const v = this.held.get(pitch)
    if (!v) return
    this.held.delete(pitch)
    this.releaseVoice(v, this.context().currentTime)
  }

  allOff(): void {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    for (const v of this.scheduled) {
      v.gain.gain.cancelScheduledValues(now)
      v.gain.gain.setValueAtTime(0.0001, now)
      for (const o of v.oscs) {
        try {
          o.stop(now)
        } catch {
          /* already stopped */
        }
      }
    }
    this.scheduled = []
    for (const p of [...this.held.keys()]) this.release(p)
  }

  private gc(): void {
    const now = this.ctx?.currentTime ?? 0
    if (this.scheduled.length > 64) this.scheduled = this.scheduled.filter((v) => v.endsAt > now)
  }
}
