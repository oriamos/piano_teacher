// Generates the starter songs in public/songs as .mid files.
// Public-domain melodies and one original piece; no copyrighted music.
// Run: node scripts/seed-songs.mjs
import pkg from '@tonejs/midi'
const { Midi } = pkg
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'public', 'songs')
mkdirSync(OUT, { recursive: true })

const N = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
/** "C4", "F#3", "Bb2" → MIDI pitch */
const p = (s) => {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(s)
  const base = N[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
  return 12 * (Number(m[3]) + 1) + base
}

/**
 * seq: array of [noteOrChord, beats] where noteOrChord is "C4" | ["C3","E3"] | null (rest).
 */
function addTrack(midi, name, seq, velocity = 0.8) {
  const track = midi.addTrack()
  track.name = name
  let beat = 0
  for (const [notes, beats] of seq) {
    if (notes !== null) {
      for (const n of Array.isArray(notes) ? notes : [notes]) {
        track.addNote({
          midi: p(n),
          ticks: Math.round(beat * midi.header.ppq),
          durationTicks: Math.round(beats * midi.header.ppq * 0.95),
          velocity,
        })
      }
    }
    beat += beats
  }
  return beat
}

function song({ file, title, bpm, ts = [4, 4], rh, lh }) {
  const midi = new Midi()
  midi.header.setTempo(bpm)
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: ts })
  midi.name = title
  addTrack(midi, 'Right hand', rh, 0.8)
  addTrack(midi, 'Left hand', lh, 0.65)
  writeFileSync(join(OUT, file), Buffer.from(midi.toArray()))
  return { file, title, bpm }
}

// 1. Twinkle Twinkle Little Star (French folk tune "Ah! vous dirai-je, maman", public domain)
const twinkleRH = [
  ['C4', 1],
  ['C4', 1],
  ['G4', 1],
  ['G4', 1],
  ['A4', 1],
  ['A4', 1],
  ['G4', 2],
  ['F4', 1],
  ['F4', 1],
  ['E4', 1],
  ['E4', 1],
  ['D4', 1],
  ['D4', 1],
  ['C4', 2],
  ['G4', 1],
  ['G4', 1],
  ['F4', 1],
  ['F4', 1],
  ['E4', 1],
  ['E4', 1],
  ['D4', 2],
  ['G4', 1],
  ['G4', 1],
  ['F4', 1],
  ['F4', 1],
  ['E4', 1],
  ['E4', 1],
  ['D4', 2],
  ['C4', 1],
  ['C4', 1],
  ['G4', 1],
  ['G4', 1],
  ['A4', 1],
  ['A4', 1],
  ['G4', 2],
  ['F4', 1],
  ['F4', 1],
  ['E4', 1],
  ['E4', 1],
  ['D4', 1],
  ['D4', 1],
  ['C4', 2],
]
const twinkleLH = [
  ['C3', 2],
  ['E3', 2],
  ['F3', 2],
  ['E3', 2],
  ['F3', 2],
  ['C3', 2],
  ['G2', 2],
  ['C3', 2],
  ['C3', 2],
  ['F3', 2],
  ['C3', 2],
  ['G2', 2],
  ['C3', 2],
  ['F3', 2],
  ['C3', 2],
  ['G2', 2],
  ['C3', 2],
  ['E3', 2],
  ['F3', 2],
  ['E3', 2],
  ['F3', 2],
  ['C3', 2],
  ['G2', 2],
  ['C3', 2],
]

// 2. Ode to Joy, theme from Beethoven's 9th (public domain)
const odeRH = [
  ['E4', 1],
  ['E4', 1],
  ['F4', 1],
  ['G4', 1],
  ['G4', 1],
  ['F4', 1],
  ['E4', 1],
  ['D4', 1],
  ['C4', 1],
  ['C4', 1],
  ['D4', 1],
  ['E4', 1],
  ['E4', 1.5],
  ['D4', 0.5],
  ['D4', 2],
  ['E4', 1],
  ['E4', 1],
  ['F4', 1],
  ['G4', 1],
  ['G4', 1],
  ['F4', 1],
  ['E4', 1],
  ['D4', 1],
  ['C4', 1],
  ['C4', 1],
  ['D4', 1],
  ['E4', 1],
  ['D4', 1.5],
  ['C4', 0.5],
  ['C4', 2],
]
const odeLH = [
  ['C3', 2],
  ['G2', 2],
  ['C3', 2],
  ['G2', 2],
  ['C3', 2],
  ['G2', 2],
  ['C3', 1],
  ['G2', 1],
  ['G2', 2],
  ['C3', 2],
  ['G2', 2],
  ['C3', 2],
  ['G2', 2],
  ['C3', 2],
  ['G2', 2],
  ['G2', 2],
  ['C3', 2],
]

// 3. Original: "Evening Study No. 1" — an 8-bar piece written for this project (MIT).
const studyRH = [
  ['E4', 1],
  ['G4', 1],
  ['A4', 1],
  ['B4', 1],
  ['A4', 1],
  ['G4', 1],
  ['E4', 2],
  ['D4', 1],
  ['E4', 1],
  ['G4', 1],
  ['A4', 1],
  ['G4', 2],
  ['E4', 2],
  ['E4', 1],
  ['G4', 1],
  ['A4', 1],
  ['B4', 1],
  ['D5', 1],
  ['B4', 1],
  ['A4', 2],
  ['G4', 1],
  ['A4', 1],
  ['G4', 1],
  ['E4', 1],
  ['D4', 2],
  ['E4', 2],
]
const studyLH = [
  [['E3', 'B3'], 2],
  [['E3', 'B3'], 2],
  [['C3', 'G3'], 2],
  [['C3', 'G3'], 2],
  [['G2', 'D3'], 2],
  [['G2', 'D3'], 2],
  [['D3', 'A3'], 2],
  [['E3', 'B3'], 2],
  [['E3', 'B3'], 2],
  [['E3', 'B3'], 2],
  [['G3', 'D4'], 2],
  [['A3', 'E4'], 2],
  [['C3', 'G3'], 2],
  [['C3', 'G3'], 2],
  [['D3', 'A3'], 2],
  [['E3', 'B3'], 2],
]

const index = [
  song({
    file: 'twinkle-twinkle.mid',
    title: 'Twinkle Twinkle Little Star',
    bpm: 90,
    rh: twinkleRH,
    lh: twinkleLH,
  }),
  song({ file: 'ode-to-joy.mid', title: 'Ode to Joy (Beethoven)', bpm: 100, rh: odeRH, lh: odeLH }),
  song({
    file: 'evening-study-1.mid',
    title: 'Evening Study No. 1 (original)',
    bpm: 84,
    rh: studyRH,
    lh: studyLH,
  }),
]
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n')
console.log('wrote', index.map((s) => s.file).join(', '))
