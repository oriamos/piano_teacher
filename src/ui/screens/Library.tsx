import { useCallback, useEffect, useRef, useState } from 'react'
import type { SongRow } from '../../store/db'
import { addBuiltinSongs, importMidiFile, listSongs, removeSong } from '../../store/songs'
import { href, navigate } from '../router'

export function Library() {
  const [songs, setSongs] = useState<SongRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = useCallback(() => listSongs().then(setSongs), [])
  useEffect(() => {
    let alive = true
    void listSongs().then((rows) => {
      if (alive) setSongs(rows)
    })
    return () => {
      alive = false
    }
  }, [])

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    try {
      for (const f of Array.from(files)) await importMidiFile(f)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const onBuiltins = async () => {
    setBusy(true)
    setError(null)
    try {
      await addBuiltinSongs()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <header className="topbar">
        <h1>Library</h1>
        <span className="muted">stage 1 · basic player</span>
        <a className="button" href={href({ name: 'settings' })}>
          Settings
        </a>
      </header>

      <section className="actions">
        <input
          ref={fileInput}
          type="file"
          accept=".mid,.midi,audio/midi"
          multiple
          hidden
          onChange={(e) => void onFiles(e.target.files)}
        />
        <button className="primary" onClick={() => fileInput.current?.click()} disabled={busy}>
          Import .mid
        </button>
        <button onClick={() => void onBuiltins()} disabled={busy}>
          Add starter songs
        </button>
        <span className="muted">MusicXML import arrives with stage 2.</span>
      </section>
      {error && <div className="banner error">{error}</div>}

      {songs === null ? (
        <p className="muted">Loading…</p>
      ) : songs.length === 0 ? (
        <section className="card">
          <p>No songs yet. Import a MIDI file, or add the starter songs (public-domain tunes).</p>
        </section>
      ) : (
        <ul className="song-list">
          {songs.map((s) => (
            <li key={s.id} className="card song-row">
              <div
                className="song-main"
                onClick={() => navigate({ name: 'practice', songId: s.id })}
              >
                <div className="song-title">{s.title}</div>
                <div className="muted">
                  {s.song.bpm} BPM · {s.song.totalBeats / s.song.beatsPerBar} bars ·{' '}
                  {s.song.notes.length} notes · difficulty {s.difficulty}/10 · hands by{' '}
                  {s.song.hands.method}
                </div>
              </div>
              <button
                className="primary"
                onClick={() => navigate({ name: 'practice', songId: s.id })}
              >
                Practise
              </button>
              <button
                onClick={() => {
                  if (confirm(`Remove "${s.title}"?`)) void removeSong(s.id).then(refresh)
                }}
                title="Remove"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
