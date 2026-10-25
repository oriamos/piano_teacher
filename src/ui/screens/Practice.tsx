import { useEffect, useMemo, useState } from 'react'
import { config } from '../../config'
import {
  defaultPracticeOptions,
  type HandSelection,
  type Mode,
  type PracticeOptions,
} from '../../engine/practice'
import type { Song } from '../../engine/types'
import { noteName } from '../../midi/messages'
import type { SongRow } from '../../store/db'
import { getSong, setSplitPitch } from '../../store/songs'
import { PracticeCanvas } from '../components/PracticeCanvas'
import { useIo } from '../io'
import { usePractice } from '../player/usePractice'
import { href } from '../router'

export function Practice({ songId }: { songId: string }) {
  const [row, setRow] = useState<SongRow | null | undefined>(undefined)
  useEffect(() => {
    void getSong(songId).then((r) => setRow(r ?? null))
  }, [songId])

  if (row === undefined) return <main className="screen muted">Loading…</main>
  if (row === null)
    return (
      <main className="screen">
        <p>Song not found.</p>
        <a className="button" href={href({ name: 'library' })}>
          Back to library
        </a>
      </main>
    )
  return <Player row={row} onRowChange={setRow} />
}

function Player({ row, onRowChange }: { row: SongRow; onRowChange: (r: SongRow) => void }) {
  const song = row.song
  const [mode, setMode] = useState<Mode>('wait')
  const [hand, setHand] = useState<HandSelection>('BOTH')
  const [tempoPct, setTempoPct] = useState<number>(config.tempo.startPct)
  const [loopBars, setLoopBars] = useState<[number, number]>([1, Math.min(4, bars(song))])
  const [metronome, setMetronome] = useState(false)
  const [fadeLevel, setFadeLevel] = useState(0)
  const io = useIo()

  const opts = useMemo<PracticeOptions>(
    () => ({
      ...defaultPracticeOptions(song),
      mode,
      hand,
      tempoPct,
      metronome,
      loop: {
        startBeat: (loopBars[0] - 1) * song.beatsPerBar,
        endBeat: loopBars[1] * song.beatsPerBar,
      },
    }),
    [song, mode, hand, tempoPct, metronome, loopBars],
  )
  const { view, frame, start, stop } = usePractice(song, opts)
  const running = view.phase !== 'idle'

  // Piano gestures: two lowest keys = restart, two highest = next (stop for now).
  // Implemented in stage 2 together with the session flow.

  const lookahead = mode === 'wait' ? 4 : Math.max(2.5, 6 * (tempoPct / 100))

  return (
    <main className="practice">
      <header className="practice-bar">
        <a className="button small" href={href({ name: 'library' })} onClick={stop}>
          ‹ Library
        </a>
        <strong className="song-name">{song.title}</strong>

        <Seg
          label="Mode"
          value={mode}
          options={[
            ['listen', 'Listen'],
            ['wait', 'Wait'],
            ['practice', 'Practice'],
          ]}
          onChange={(m) => {
            stop()
            setMode(m)
          }}
        />
        <Seg
          label="Hand"
          value={hand}
          options={[
            ['LH', 'Left'],
            ['BOTH', 'Both'],
            ['RH', 'Right'],
          ]}
          onChange={(h) => {
            stop()
            setHand(h)
          }}
        />
        <label className="field">
          Tempo {tempoPct}%
          <input
            type="range"
            min={config.tempo.minPct}
            max={config.tempo.maxPct}
            step={5}
            value={tempoPct}
            disabled={mode === 'wait'}
            onChange={(e) => {
              stop()
              setTempoPct(Number(e.target.value))
            }}
          />
        </label>
        <label className="field">
          Bars
          <span className="loop-inputs">
            <input
              type="number"
              min={1}
              max={loopBars[1]}
              value={loopBars[0]}
              onChange={(e) => {
                stop()
                setLoopBars([clamp(Number(e.target.value), 1, loopBars[1]), loopBars[1]])
              }}
            />
            –
            <input
              type="number"
              min={loopBars[0]}
              max={bars(song)}
              value={loopBars[1]}
              onChange={(e) => {
                stop()
                setLoopBars([loopBars[0], clamp(Number(e.target.value), loopBars[0], bars(song))])
              }}
            />
            <button
              className="small"
              onClick={() => {
                stop()
                setLoopBars([1, bars(song)])
              }}
            >
              all
            </button>
          </span>
        </label>
        <label className="field check-field">
          <input
            type="checkbox"
            checked={metronome}
            disabled={mode === 'wait'}
            onChange={(e) => {
              stop()
              setMetronome(e.target.checked)
            }}
          />
          Click
        </label>
        <label className="field">
          Fade {fadeLevel}
          <input
            type="range"
            min={0}
            max={config.fading.maxLevel}
            value={fadeLevel}
            onChange={(e) => setFadeLevel(Number(e.target.value))}
          />
        </label>
        {running ? (
          <button className="danger" onClick={stop}>
            Stop
          </button>
        ) : (
          <button className="primary" onClick={start}>
            {mode === 'listen' ? 'Play' : 'Start'}
          </button>
        )}
      </header>

      <div className="stage">
        <PracticeCanvas
          song={song}
          frame={frame}
          loop={opts.loop}
          fadeLevel={fadeLevel}
          lookaheadBeats={lookahead}
        />
        <div className="readout">
          <span>{mode}</span>
          <span>{hand === 'BOTH' ? 'both hands' : hand === 'RH' ? 'right hand' : 'left hand'}</span>
          {mode !== 'wait' && <span>{tempoPct}%</span>}
          <span>run {view.run}</span>
          {view.wrongCount > 0 && <span className="bad">{view.wrongCount} wrong</span>}
          <span className="muted">
            sound: {io.resolved}
            {io.pianoConnected ? ' · piano in' : ' · screen/keys in'}
          </span>
        </div>
        {view.phase === 'countIn' && <div className="overlay countin">count-in</div>}
        {view.phase === 'summary' && view.lastScore && (
          <div className="overlay summary-overlay">
            <div className="big">{Math.round(view.lastScore.acc * 100)}%</div>
            <div className={`verdict ${view.lastScore.verdict}`}>{view.lastScore.verdict}</div>
            <div className="muted">
              {view.lastScore.hits}/{view.lastScore.expected} notes
              {view.lastScore.extra > 0 && ` · ${view.lastScore.extra} wrong`}
              {view.lastScore.missed > 0 && ` · ${view.lastScore.missed} missed`}
              {mode === 'practice' &&
                ` · timing ${Math.round(view.lastScore.timing * 100)}% · mean Δ ${view.lastScore.meanDeltaMs.toFixed(0)} ms`}
            </div>
            <div className="muted">next run in 3 s… (Stop to end)</div>
          </div>
        )}
      </div>

      {song.hands.method === 'split' && (
        <footer className="practice-foot muted">
          Single-track file: hands split at {noteName(song.hands.splitPitch)}.{' '}
          <button
            className="small"
            onClick={() =>
              void setSplitPitch(
                song.id,
                song.hands.method === 'split' ? song.hands.splitPitch - 1 : 60,
              ).then((r) => r && onRowChange(r))
            }
          >
            −
          </button>{' '}
          <button
            className="small"
            onClick={() =>
              void setSplitPitch(
                song.id,
                song.hands.method === 'split' ? song.hands.splitPitch + 1 : 60,
              ).then((r) => r && onRowChange(r))
            }
          >
            +
          </button>
        </footer>
      )}
    </main>
  )
}

function bars(song: Song): number {
  return Math.ceil(song.totalBeats / song.beatsPerBar)
}
function clamp(n: number, lo: number, hi: number): number {
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo
}

function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <div className="field">
      {label}
      <div className="seg">
        {options.map(([v, text]) => (
          <button key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
