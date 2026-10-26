import { useEffect, useMemo, useState } from 'react'
import { config } from '../../config'
import {
  defaultPracticeOptions,
  type HandSelection,
  type Mode,
  type PracticeOptions,
} from '../../engine/practice'
import { beatMs } from '../../engine/time'
import type { Song } from '../../engine/types'
import { noteName } from '../../midi/messages'
import type { SongRow } from '../../store/db'
import { getSong, setLastSong, setSplitPitch } from '../../store/songs'
import { Icon } from '../components/Icon'
import { PracticeCanvas } from '../components/PracticeCanvas'
import { useIo } from '../io'
import { usePractice } from '../player/usePractice'
import { href } from '../router'

export function Practice({ songId }: { songId: string }) {
  const [row, setRow] = useState<SongRow | null | undefined>(undefined)
  useEffect(() => {
    void getSong(songId).then((r) => {
      setRow(r ?? null)
      if (r) void setLastSong(r.id)
    })
  }, [songId])

  if (row === undefined) return <main className="screen muted">Loading…</main>
  if (row === null)
    return (
      <main className="screen">
        <p>That song is not on this device any more.</p>
        <div className="actions">
          <a className="button" href={href({ name: 'library' })}>
            <Icon name="back" />
            Songs
          </a>
        </div>
      </main>
    )
  return <Player row={row} onRowChange={setRow} />
}

function Player({ row, onRowChange }: { row: SongRow; onRowChange: (r: SongRow) => void }) {
  const song = row.song
  const [mode, setMode] = useState<Mode>('wait')
  const [hand, setHand] = useState<HandSelection>('BOTH')
  const [tempoPct, setTempoPct] = useState<number>(config.tempo.startPct)
  const [loopBars, setLoopBars] = useState<[number, number]>(() => {
    const first = song.segments[0]
    return first ? segBars(first, song) : [1, Math.min(4, bars(song))]
  })
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
  const timed = mode !== 'wait'
  const lookahead = mode === 'wait' ? 4 : Math.max(2.5, 6 * (tempoPct / 100))
  const change =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      stop()
      set(v)
    }

  return (
    <main className="practice">
      <header className="practice-bar">
        <div className="where">
          <a
            className="button small icon quiet"
            href={href({ name: 'library' })}
            onClick={stop}
            aria-label="Back to songs"
          >
            <Icon name="back" />
          </a>
          <strong className="song-name">{song.title}</strong>
          <span className="loop-inputs" aria-label="Bars to loop">
            <input
              type="number"
              min={1}
              max={loopBars[1]}
              value={loopBars[0]}
              aria-label="First bar"
              onChange={(e) =>
                change(setLoopBars)([clamp(Number(e.target.value), 1, loopBars[1]), loopBars[1]])
              }
            />
            <span className="dash">–</span>
            <input
              type="number"
              min={loopBars[0]}
              max={bars(song)}
              value={loopBars[1]}
              aria-label="Last bar"
              onChange={(e) =>
                change(setLoopBars)([
                  loopBars[0],
                  clamp(Number(e.target.value), loopBars[0], bars(song)),
                ])
              }
            />
            <button
              className="small quiet"
              onClick={() => change(setLoopBars)([1, bars(song)])}
              title="Loop the whole song"
            >
              all {bars(song)}
            </button>
          </span>
        </div>

        <div className="controls">
          <div className="group">
            <Seg
              label="Mode"
              value={mode}
              options={[
                ['listen', 'Listen'],
                ['wait', 'Wait'],
                ['practice', 'Practise'],
              ]}
              onChange={change(setMode)}
            />
            <Seg
              label="Hand"
              value={hand}
              options={[
                ['LH', 'Left'],
                ['BOTH', 'Both'],
                ['RH', 'Right'],
              ]}
              onChange={change(setHand)}
            />
          </div>

          <div className="group">
            <label
              className="field"
              title={timed ? 'Percent of the original tempo' : 'Wait mode has no tempo'}
            >
              <span>Tempo</span>
              <input
                type="range"
                min={config.tempo.minPct}
                max={config.tempo.maxPct}
                step={5}
                value={tempoPct}
                disabled={!timed}
                onChange={(e) => change(setTempoPct)(Number(e.target.value))}
              />
              <span className="value">{timed ? `${tempoPct}%` : '—'}</span>
            </label>
            <label className={`toggle ${metronome ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={metronome}
                disabled={!timed}
                onChange={(e) => change(setMetronome)(e.target.checked)}
              />
              Click
            </label>
            <label className="field" title="How much of the notes you see. 4 is a blank screen.">
              <span>Fade</span>
              <input
                type="range"
                min={0}
                max={config.fading.maxLevel}
                value={fadeLevel}
                onChange={(e) => setFadeLevel(Number(e.target.value))}
              />
              <span className="value">{fadeLevel}</span>
            </label>
          </div>
        </div>

        <div className="go">
          {running ? (
            <button className="danger" onClick={stop}>
              <Icon name="stop" filled />
              Stop
            </button>
          ) : (
            <button className="primary" onClick={start}>
              <Icon name="play" filled />
              {mode === 'listen' ? 'Play' : 'Start'}
            </button>
          )}
        </div>
      </header>

      <nav className="segments" aria-label="Segments">
        {song.segments.map((seg) => {
          const [a, b] = segBars(seg, song)
          const on = a === loopBars[0] && b === loopBars[1]
          return (
            <button
              key={seg.id}
              className={`segment ${on ? 'on' : ''}`}
              onClick={() => change(setLoopBars)([a, b])}
              aria-pressed={on}
              title={`Bars ${a}–${b}${seg.difficulty ? ` · difficulty ${seg.difficulty} of 10` : ''}`}
            >
              <span className="n">{seg.index + 1}</span>
              <span className="range">
                {a}–{b}
              </span>
              {seg.difficulty !== undefined && <Diff level={seg.difficulty} />}
            </button>
          )
        })}
      </nav>

      <div className="stage">
        <PracticeCanvas
          song={song}
          frame={frame}
          loop={opts.loop}
          fadeLevel={fadeLevel}
          lookaheadBeats={lookahead}
        />
        <div className="hud" aria-live="polite">
          {hand !== 'LH' && <span className="chip rh">right</span>}
          {hand !== 'RH' && <span className="chip lh">left</span>}
          {timed && <span className="chip plain">{tempoPct}%</span>}
          {view.run > 0 && <span className="chip plain">run {view.run}</span>}
          {view.wrongCount > 0 && <span className="chip bad">{view.wrongCount} wrong</span>}
          <span className="chip plain">{io.resolved === 'midi' ? 'piano' : io.resolved}</span>
        </div>
        {view.phase === 'countIn' && (
          <div
            className="overlay countin"
            style={{ ['--beat-ms' as string]: `${beatMs(song.bpm, tempoPct)}ms` }}
          >
            <span className="beat" />
            count-in
          </div>
        )}
        {view.phase === 'summary' && view.lastScore && (
          <div className="overlay summary">
            <div className="panel" key={view.run}>
              <div className="score">{Math.round(view.lastScore.acc * 100)}%</div>
              <div className={`verdict ${view.lastScore.verdict}`}>
                {verdictWord(view.lastScore.verdict)}
              </div>
              <div className="detail">
                {view.lastScore.hits} of {view.lastScore.expected} notes
                {view.lastScore.extra > 0 && ` · ${view.lastScore.extra} wrong`}
                {view.lastScore.missed > 0 && ` · ${view.lastScore.missed} missed`}
                {timed && ` · timing ${Math.round(view.lastScore.timing * 100)}%`}
                {timed && view.lastScore.hits > 0 && ` · ${signed(view.lastScore.meanDeltaMs)} ms`}
              </div>
              <div className="next">again in 3 s · Stop to end</div>
            </div>
          </div>
        )}
      </div>

      {song.hands.method === 'split' && (
        <footer className="practice-foot">
          <span>
            One-track file. Hands split at {noteName(song.hands.splitPitch)}; everything from there
            up is the right hand.
          </span>
          <button
            className="small quiet"
            aria-label="Move the split one key down"
            onClick={() =>
              void setSplitPitch(song.id, splitOf(song) - 1).then((r) => r && onRowChange(r))
            }
          >
            lower
          </button>
          <button
            className="small quiet"
            aria-label="Move the split one key up"
            onClick={() =>
              void setSplitPitch(song.id, splitOf(song) + 1).then((r) => r && onRowChange(r))
            }
          >
            higher
          </button>
        </footer>
      )}
    </main>
  )
}

function verdictWord(v: 'clean' | 'failed' | 'neither'): string {
  return v === 'clean' ? 'Clean' : v === 'failed' ? 'Not yet' : 'Close'
}
function signed(ms: number): string {
  const r = Math.round(ms)
  return r > 0 ? `+${r}` : String(r)
}
function splitOf(song: Song): number {
  return song.hands.method === 'split' ? song.hands.splitPitch : 60
}
function bars(song: Song): number {
  return Math.ceil(song.totalBeats / song.beatsPerBar)
}
function segBars(seg: { startBeat: number; endBeat: number }, song: Song): [number, number] {
  return [
    Math.floor(seg.startBeat / song.beatsPerBar) + 1,
    Math.ceil(seg.endBeat / song.beatsPerBar),
  ]
}
function Diff({ level }: { level: number }) {
  return (
    <span className="diff" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} className={i < Math.ceil(level / 2) ? 'on' : ''} />
      ))}
    </span>
  )
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
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={v}
          role="radio"
          aria-checked={v === value}
          className={v === value ? 'on' : ''}
          onClick={() => onChange(v)}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
