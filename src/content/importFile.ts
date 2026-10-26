/**
 * One entry point for every file the library accepts. Pure (fflate for .mxl).
 */
import { unzipSync, strFromU8 } from 'fflate'
import type { Song } from '../engine/types'
import { importMidi } from './midiImport'
import { importMusicXml } from './musicxml'

export type SourceType = 'midi' | 'musicxml'

export interface ImportedFile {
  song: Song
  sourceType: SourceType
}

export const ACCEPTED_EXTENSIONS = ['.mid', '.midi', '.musicxml', '.mxl', '.xml'] as const

const NOTATION_IMAGE = /\.(pdf|png|jpe?g|tiff?|bmp|webp|heic)$/i

/**
 * Import a file by name and bytes.
 *
 * @throws Error with a human-readable message when the format is not supported,
 * including the conversion path for scanned or PDF sheet music.
 */
export function importSongFile(fileName: string, data: ArrayBuffer): ImportedFile {
  const name = fileName.toLowerCase()
  const title = fileName.replace(/\.[^.]+$/, '')
  if (name.endsWith('.mid') || name.endsWith('.midi')) {
    const song = importMidi(data)
    return { song: song.title === 'Untitled' ? { ...song, title } : song, sourceType: 'midi' }
  }
  if (name.endsWith('.musicxml') || name.endsWith('.xml')) {
    const song = importMusicXml(strFromU8(new Uint8Array(data)))
    return { song: song.title === 'Untitled' ? { ...song, title } : song, sourceType: 'musicxml' }
  }
  if (name.endsWith('.mxl')) {
    const song = importMusicXml(readMxl(data))
    return { song: song.title === 'Untitled' ? { ...song, title } : song, sourceType: 'musicxml' }
  }
  if (NOTATION_IMAGE.test(name)) {
    throw new Error(
      'This is a picture of the score, not the notes themselves. Open it in MuseScore (free) with ' +
        'File → Import PDF, or in Audiveris, check the result, then export MusicXML (.musicxml or .mxl) and import that.',
    )
  }
  throw new Error(`Unsupported file type. Use ${ACCEPTED_EXTENSIONS.join(', ')}.`)
}

/** A .mxl is a zip; META-INF/container.xml names the score file inside. */
export function readMxl(data: ArrayBuffer): string {
  const files = unzipSync(new Uint8Array(data))
  const container = files['META-INF/container.xml']
  let rootPath: string | null = null
  if (container) {
    const m = /<rootfile[^>]*full-path="([^"]+)"/.exec(strFromU8(container))
    if (m?.[1]) rootPath = m[1]
  }
  if (!rootPath || !files[rootPath]) {
    rootPath =
      Object.keys(files).find((f) => /\.(musicxml|xml)$/i.test(f) && !f.startsWith('META-INF/')) ??
      null
  }
  const score = rootPath ? files[rootPath] : undefined
  if (!score) throw new Error('No MusicXML score found inside the .mxl file')
  return strFromU8(score)
}
