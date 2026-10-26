import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { zipSync, strToU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { importSongFile } from './importFile'

const dir = join(__dirname, '..', '..', 'test', 'fixtures', 'songs')
const xml = readFileSync(join(dir, 'evening-study-1.musicxml'), 'utf8')
const mid = readFileSync(join(dir, 'evening-study-1.mid'))
const toBuf = (u: Uint8Array) =>
  u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer

describe('importSongFile', () => {
  it('dispatches on extension', () => {
    expect(importSongFile('x.mid', toBuf(mid)).sourceType).toBe('midi')
    expect(importSongFile('x.musicxml', toBuf(strToU8(xml))).sourceType).toBe('musicxml')
  })
  it('opens compressed .mxl via META-INF/container.xml', () => {
    const container = `<?xml version="1.0"?><container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>`
    const mxl = zipSync({ 'META-INF/container.xml': strToU8(container), 'score.xml': strToU8(xml) })
    const r = importSongFile('study.mxl', toBuf(mxl))
    expect(r.sourceType).toBe('musicxml')
    expect(r.song.notes).toHaveLength(58)
  })
  it('falls back to the first xml file inside an .mxl without a container', () => {
    const mxl = zipSync({ 'piece.musicxml': strToU8(xml) })
    expect(importSongFile('p.mxl', toBuf(mxl)).song.title).toContain('Evening Study')
  })
  it('explains the conversion path for PDF and image scores', () => {
    expect(() => importSongFile('score.pdf', new ArrayBuffer(0))).toThrow(/MuseScore/)
    expect(() => importSongFile('score.jpg', new ArrayBuffer(0))).toThrow(/MusicXML/)
  })
  it('rejects unknown types', () => {
    expect(() => importSongFile('a.txt', new ArrayBuffer(0))).toThrow(/Unsupported/)
  })
})
