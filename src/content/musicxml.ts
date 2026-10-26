/**
 * MusicXML → Song (spec M2.1). Pure: uses a small XML parser, no DOM, so it
 * runs in tests and would run in a worker.
 *
 * Handles: parts and staves (piano: staff 1 = right hand, staff 2 = left),
 * divisions, <backup>/<forward> and voices, chords, ties, rests, tuplets
 * (through <duration>), pickup bars, tempo from <sound tempo> or
 * <per-minute>, time signatures, transposing parts. Skips grace notes.
 * Repeats and endings are not expanded (stage 2 may add it).
 */
import { parseXml, XmlElement, XmlText } from '@rgrove/parse-xml'
import type { ExpectedNote, HandAssignment, Song, TrackInfo } from '../engine/types'
import { chooseHandAssignment } from './hands'
import { segmentByDensity } from './segmentation'

export interface MusicXmlOptions {
  id?: string
  title?: string
}

const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

interface RawNote {
  pitch: number
  onsetBeat: number
  durBeats: number
  velocity: number
  /** part index * 10 + staff (1-based) */
  track: number
  tieStart: boolean
  tieStop: boolean
  voice: string
}

/** Parse an (uncompressed) MusicXML document. */
export function importMusicXml(xml: string, opts: MusicXmlOptions = {}): Song {
  const doc = parseXml(xml, { ignoreUndefinedEntities: true })
  const root = doc.root
  if (!root) throw new Error('Not an XML document')
  const score = root.name === 'score-partwise' ? root : child(root, 'score-partwise')
  if (!score)
    throw new Error(
      'Only score-partwise MusicXML is supported (timewise is rare; convert in MuseScore)',
    )

  const title =
    opts.title ??
    text(child(child(score, 'work'), 'work-title')) ??
    text(child(score, 'movement-title')) ??
    'Untitled'
  const composer = children(child(score, 'identification'), 'creator')
    .filter((c) => attr(c, 'type') === 'composer' || !attr(c, 'type'))
    .map((c) => text(c) ?? '')
    .find((s) => s.length > 0)

  const partNames = new Map<string, string>()
  for (const sp of children(child(score, 'part-list'), 'score-part')) {
    partNames.set(attr(sp, 'id') ?? '', text(child(sp, 'part-name')) ?? '')
  }

  let bpm: number | null = null
  let beatsPerBar = 4
  let beatType = 4
  const raw: RawNote[] = []
  const trackNames = new Map<number, string>()
  /** Beat position at the start of each measure, per part; shared across parts in partwise scores. */
  const measureStarts: number[] = []

  children(score, 'part').forEach((part, partIndex) => {
    const partName = partNames.get(attr(part, 'id') ?? '') ?? `Part ${partIndex + 1}`
    let divisions = 1
    let transpose = 0
    let beat = 0 // quarter-note beats from the start of the piece
    children(part, 'measure').forEach((measure, mi) => {
      const measureStart = measureStarts[mi] ?? beat
      if (measureStarts[mi] === undefined) measureStarts[mi] = measureStart
      beat = measureStart
      let cursor = measureStart
      let measureEnd = measureStart

      for (const el of measure.children) {
        if (!(el instanceof XmlElement)) continue
        switch (el.name) {
          case 'attributes': {
            const d = num(child(el, 'divisions'))
            if (d) divisions = d
            const time = child(el, 'time')
            if (time && partIndex === 0 && mi === 0) {
              beatsPerBar = num(child(time, 'beats')) ?? 4
              beatType = num(child(time, 'beat-type')) ?? 4
            }
            const tr = child(el, 'transpose')
            if (tr)
              transpose =
                (num(child(tr, 'chromatic')) ?? 0) + 12 * (num(child(tr, 'octave-change')) ?? 0)
            break
          }
          case 'direction': {
            const s = child(el, 'sound')
            const t = s ? Number(attr(s, 'tempo')) : NaN
            if (bpm === null && Number.isFinite(t) && t > 0) bpm = t
            const metro = child(child(el, 'direction-type'), 'metronome')
            if (bpm === null && metro) {
              const unit = text(child(metro, 'beat-unit')) ?? 'quarter'
              const pm = num(child(metro, 'per-minute'))
              if (pm) bpm = pm * unitToQuarters(unit)
            }
            break
          }
          case 'sound': {
            const t = Number(attr(el, 'tempo'))
            if (bpm === null && Number.isFinite(t) && t > 0) bpm = t
            break
          }
          case 'backup':
            cursor -= (num(child(el, 'duration')) ?? 0) / divisions
            break
          case 'forward':
            cursor += (num(child(el, 'duration')) ?? 0) / divisions
            break
          case 'note': {
            const isChord = !!child(el, 'chord')
            const isGrace = !!child(el, 'grace')
            const dur = (num(child(el, 'duration')) ?? 0) / divisions
            const staff = num(child(el, 'staff')) ?? 1
            const track = partIndex * 10 + staff
            if (!trackNames.has(track))
              trackNames.set(track, staffName(partName, staff, hasStaves(part)))
            const onset = isChord ? lastOnset(raw, track) : cursor
            if (!isGrace && !child(el, 'rest')) {
              const p = child(el, 'pitch')
              if (p) {
                const step = text(child(p, 'step')) ?? 'C'
                const alter = num(child(p, 'alter')) ?? 0
                const octave = num(child(p, 'octave')) ?? 4
                const pitch = 12 * (octave + 1) + (STEP[step] ?? 0) + alter + transpose
                const ties = children(el, 'tie').map((t) => attr(t, 'type'))
                const dyn = Number(attr(el, 'dynamics'))
                raw.push({
                  pitch,
                  onsetBeat: onset,
                  durBeats: dur,
                  velocity: Number.isFinite(dyn) && dyn > 0 ? Math.round((dyn / 100) * 90) : 80,
                  track,
                  tieStart: ties.includes('start'),
                  tieStop: ties.includes('stop'),
                  voice: text(child(el, 'voice')) ?? '1',
                })
              }
            }
            if (!isChord && !isGrace) cursor += dur
            break
          }
          default:
            break
        }
        measureEnd = Math.max(measureEnd, cursor)
      }
      beat = Math.max(measureEnd, measureStart + barBeats(beatsPerBar, beatType))
      // Partial (pickup) bars are shorter: trust the content for the first bar.
      if (mi === 0 && attr(measure, 'implicit') === 'yes') beat = measureEnd
      measureStarts[mi + 1] = Math.max(measureStarts[mi + 1] ?? 0, beat)
    })
  })

  const merged = mergeTies(raw)
  const tracks: TrackInfo[] = [...trackNames.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, name]) => {
      const tn = merged.filter((n) => n.track === index)
      return {
        index,
        name,
        noteCount: tn.length,
        avgPitch: tn.length ? tn.reduce((a, n) => a + n.pitch, 0) / tn.length : 0,
      }
    })
  const hands: HandAssignment = staffHands(tracks) ?? chooseHandAssignment(tracks)

  merged.sort((a, b) => a.onsetBeat - b.onsetBeat || a.pitch - b.pitch)
  const bpb = barBeats(beatsPerBar, beatType)
  const lastEnd = merged.reduce((m, n) => Math.max(m, n.onsetBeat + n.durBeats), 0)
  const totalBeats = Math.max(bpb, Math.ceil(lastEnd / bpb) * bpb)

  const withHands = merged.map((n) => ({
    pitch: n.pitch,
    onsetBeat: round(n.onsetBeat),
    durBeats: round(n.durBeats),
    velocity: n.velocity,
    hand: handFor(hands, n.track, n.pitch),
  }))
  const segments = segmentByDensity(
    withHands.map((n, i) => ({ ...n, id: `n${i}`, segmentId: '' })),
    totalBeats,
    bpb,
  )
  const notes: ExpectedNote[] = withHands.map((n, i) => ({
    ...n,
    id: `n${i}`,
    segmentId:
      segments.find((s) => n.onsetBeat >= s.startBeat && n.onsetBeat < s.endBeat)?.id ??
      segments[segments.length - 1]!.id,
  }))

  const song: Song = {
    id: opts.id ?? `song-${hash(notes.map((n) => `${n.pitch}@${n.onsetBeat}`).join(','))}`,
    title,
    bpm: bpm ?? 100,
    beatsPerBar: bpb,
    totalBeats,
    notes,
    segments,
    hands,
    tracks,
  }
  if (composer) song.composer = composer
  return song
}

/** Staff 1 → RH, staff 2 → LH when a part has two staves (the piano case). */
function staffHands(tracks: TrackInfo[]): HandAssignment | null {
  const rh = tracks.filter((t) => t.index % 10 === 1 && tracks.some((u) => u.index === t.index + 1))
  if (rh.length === 0) return null
  const rhTracks = rh.map((t) => t.index)
  const lhTracks = tracks.filter((t) => !rhTracks.includes(t.index)).map((t) => t.index)
  return { method: 'track', rhTracks, lhTracks }
}

function handFor(h: HandAssignment, track: number, pitch: number): 'RH' | 'LH' {
  if (h.method === 'split') return pitch >= h.splitPitch ? 'RH' : 'LH'
  return h.rhTracks.includes(track)
    ? 'RH'
    : h.lhTracks.includes(track)
      ? 'LH'
      : pitch >= 60
        ? 'RH'
        : 'LH'
}

/** Join tied notes into one note with the summed duration. */
function mergeTies(raw: RawNote[]): RawNote[] {
  const out: RawNote[] = []
  const open = new Map<string, RawNote>() // key: track/voice/pitch
  const sorted = [...raw].sort((a, b) => a.onsetBeat - b.onsetBeat)
  for (const n of sorted) {
    const key = `${n.track}/${n.voice}/${n.pitch}`
    const prev = open.get(key)
    if (n.tieStop && prev && Math.abs(prev.onsetBeat + prev.durBeats - n.onsetBeat) < 1e-6) {
      prev.durBeats += n.durBeats
      if (!n.tieStart) open.delete(key)
      continue
    }
    const copy = { ...n }
    out.push(copy)
    if (n.tieStart) open.set(key, copy)
    else open.delete(key)
  }
  return out
}

function lastOnset(raw: RawNote[], track: number): number {
  for (let i = raw.length - 1; i >= 0; i--) if (raw[i]!.track === track) return raw[i]!.onsetBeat
  return 0
}

function hasStaves(part: XmlElement): boolean {
  for (const m of children(part, 'measure'))
    for (const a of children(m, 'attributes')) if ((num(child(a, 'staves')) ?? 1) > 1) return true
  return false
}

function staffName(partName: string, staff: number, multi: boolean): string {
  if (!multi) return partName
  return `${partName} · ${staff === 1 ? 'right hand' : staff === 2 ? 'left hand' : `staff ${staff}`}`
}

/** Beats per bar measured in quarter notes. */
function barBeats(beats: number, beatType: number): number {
  return Math.max(1, Math.round(((beats * 4) / beatType) * 100) / 100)
}

function unitToQuarters(unit: string): number {
  switch (unit) {
    case 'half':
      return 2
    case 'eighth':
      return 0.5
    case 'whole':
      return 4
    case '16th':
      return 0.25
    default:
      return 1
  }
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000
}

/* ---------- tiny XML helpers ---------- */
function child(el: XmlElement | null | undefined, name: string): XmlElement | null {
  if (!el) return null
  for (const c of el.children) if (c instanceof XmlElement && c.name === name) return c
  return null
}
function children(el: XmlElement | null | undefined, name: string): XmlElement[] {
  if (!el) return []
  return el.children.filter((c): c is XmlElement => c instanceof XmlElement && c.name === name)
}
function text(el: XmlElement | null): string | null {
  if (!el) return null
  const t = el.children
    .filter((c): c is XmlText => c instanceof XmlText)
    .map((c) => c.text)
    .join('')
    .trim()
  return t.length ? t : null
}
function num(el: XmlElement | null): number | null {
  const t = text(el)
  if (t === null) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
function attr(el: XmlElement | null, name: string): string | null {
  return el?.attributes[name] ?? null
}

function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
