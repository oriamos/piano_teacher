import { getSoundSource, setSoundSource, useIo, type SoundSource } from '../io'
import { DeviceTest } from './DeviceTest'

export function Settings() {
  const io = useIo()
  const sources: [SoundSource, string][] = [
    ['auto', 'Auto'],
    ['midi', 'Piano'],
    ['synth', 'Tablet synth'],
    ['silent', 'Silent'],
  ]
  return (
    <>
      <main className="screen">
        <div className="screen-head">
          <h1>Settings</h1>
        </div>
        <section className="card">
          <h2>Sound</h2>
          <p>
            Demonstrations, the click and the other hand play here. Auto means the piano when a MIDI
            output is connected, otherwise the tablet. Now playing through{' '}
            <b>
              {io.resolved === 'midi'
                ? 'the piano'
                : io.resolved === 'synth'
                  ? 'the tablet synth'
                  : 'nothing'}
            </b>
            .
          </p>
          <div className="seg" role="radiogroup" aria-label="Sound source">
            {sources.map(([v, text]) => (
              <button
                key={v}
                role="radio"
                aria-checked={getSoundSource() === v}
                className={getSoundSource() === v ? 'on' : ''}
                onClick={() => void setSoundSource(v)}
              >
                {text}
              </button>
            ))}
          </div>
        </section>
        <section className="card">
          <h2>Playing without a piano</h2>
          <p>
            Tap the keyboard on screen, or on a computer type{' '}
            <code>A W S E D F T G Y H U J K O L P ; '</code> for C4 upwards. <code>Z</code> and{' '}
            <code>X</code> move an octave down and up; hold Shift for a louder note.
          </p>
        </section>
      </main>
      <DeviceTest />
    </>
  )
}
