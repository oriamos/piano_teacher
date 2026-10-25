import { useCallback, useEffect, useRef, useState } from 'react'
import type { Song } from '../../engine/types'
import type { SongRow } from '../../store/db'
import {
  addBuiltinSongs,
  getLastSong,
  importMidiFile,
  listSongs,
  removeSong,
} from '../../store/songs'
import { Icon } from '../components/Icon'
import { navigate } from '../router'

/**
 * Home: the song to continue, then the rest. One primary action per state.
 */
export function Library() {
  const [songs, setSongs] = useState<SongRow[] | null>(null)
  const [last, setLast] = useState<SongRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const [rows, lastRow] = await Promise.all([listSongs(), getLastSong()])
    setSongs(rows)
    setLast(lastRow ?? rows[0] ?? null)
  }, [])

  useEffect(() => {
    let alive = true
    void Promise.all([listSongs(), getLastSong()]).then(([rows, lastRow]) => {
      if (!alive) return
      setSongs(rows)
      setLast(lastRow ?? rows[0] ?? null)
    })
    return () => {
      alive = false
    }
  }, [])

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await work()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return
    void run(async () => {
      for (const f of Array.from(files)) await importMidiFile(f)
    })
  }

  const open = (id: string) => navigate({ name: 'practice', songId: id })

  return (
    <main className="screen">
      <input
        ref={fileInput}
        type="file"
        accept=".mid,.midi,audio/midi"
        multiple
        hidden
        onChange={(e) => onFiles(e.target.files)}
      />
      {error && <div className="banner error">{error}</div>}

      {songs === null ? (
        <>
          <div className="skeleton" style={{ height: 132 }} />
          <div className="skeleton" />
          <div className="skeleton" />
        </>
      ) : songs.length === 0 ? (
        <section className="empty">
          <div>
            <h2>Start with a song you already know.</h2>
            <p>
              Three public-domain tunes come with the app. Add them, or import a MIDI file of your
              own. Everything stays on this device.
            </p>
          </div>
          <div className="actions">
            <button
              className="primary large"
              disabled={busy}
              onClick={() => void run(addBuiltinSongs)}
            >
              <Icon name="plus" />
              Add the starter songs
            </button>
            <button disabled={busy} onClick={() => fileInput.current?.click()}>
              Import .mid
            </button>
          </div>
        </section>
      ) : (
        <>
          {last && (
            <section className="continue" aria-label="Continue">
              <div>
                <div className="kicker-free-title">{last.title}</div>
                <div className="meta">
                  <SongMeta song={last.song} difficulty={last.difficulty} />
                </div>
              </div>
              <button className="primary large" onClick={() => open(last.id)}>
                <Icon name="play" filled />
                Practise
              </button>
            </section>
          )}

          <div className="screen-head">
            <h2>All songs</h2>
            <div className="actions">
              <button className="small" disabled={busy} onClick={() => fileInput.current?.click()}>
                Import .mid
              </button>
              <button
                className="small quiet"
                disabled={busy}
                onClick={() => void run(addBuiltinSongs)}
              >
                Add starter songs
              </button>
            </div>
          </div>

          <ul className="song-list">
            {songs.map((s) => (
              <li key={s.id} className="song-row">
                <div className="song-main" onClick={() => open(s.id)}>
                  <div className="song-title">{s.title}</div>
                  <div className="song-meta">
                    <SongMeta song={s.song} difficulty={s.difficulty} />
                  </div>
                </div>
                <button className="small" onClick={() => open(s.id)}>
                  Practise
                </button>
                <button
                  className="small icon quiet"
                  aria-label={`Remove ${s.title}`}
                  title="Remove"
                  onClick={() => {
                    if (confirm(`Remove "${s.title}" from this device?`))
                      void run(() => removeSong(s.id))
                  }}
                >
                  <Icon name="close" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}

function SongMeta({ song, difficulty }: { song: Song; difficulty: number }) {
  const bars = Math.ceil(song.totalBeats / song.beatsPerBar)
  return (
    <>
      <span>
        {bars} bars · {song.bpm} BPM
      </span>
      <span
        className="diff"
        title={`difficulty ${difficulty} of 10`}
        aria-label={`difficulty ${difficulty} of 10`}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} className={i < Math.ceil(difficulty / 2) ? 'on' : ''} />
        ))}
      </span>
      <span>{song.hands.method === 'track' ? 'two tracks' : 'split by pitch'}</span>
    </>
  )
}
