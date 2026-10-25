import { getSoundSource, setSoundSource, useIo, type SoundSource } from '../io'
import { href } from '../router'
import { DeviceTest } from './DeviceTest'

export function Settings() {
  const io = useIo()
  return (
    <>
      <main className="screen">
        <header className="topbar">
          <h1>Settings</h1>
          <a className="button" href={href({ name: 'library' })}>
            ‹ Library
          </a>
        </header>
        <section className="card">
          <h2>Sound</h2>
          <p className="muted">
            Where demonstrations, the metronome and the other hand are played. "Auto" uses the piano
            when a MIDI output is connected and the tablet's own synth otherwise. Now:{' '}
            <b>{io.resolved}</b>.
          </p>
          <div className="seg">
            {(
              [
                ['auto', 'Auto'],
                ['midi', 'Piano (MIDI out)'],
                ['synth', 'Tablet synth'],
                ['silent', 'Silent'],
              ] as [SoundSource, string][]
            ).map(([v, text]) => (
              <button
                key={v}
                className={getSoundSource() === v ? 'on' : ''}
                onClick={() => void setSoundSource(v)}
              >
                {text}
              </button>
            ))}
          </div>
        </section>
        <section className="card">
          <h2>Input without a piano</h2>
          <p className="muted">
            Tap the on-screen keyboard, or on a computer use the keys A W S E D F T G Y H U J K O L
            P ; ' (C4 upwards); Z / X shift the octave; hold Shift for a harder velocity. With the
            synth as the sound source these are audible.
          </p>
        </section>
      </main>
      <DeviceTest />
    </>
  )
}
