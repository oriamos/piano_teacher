import { useIo } from '../io'
import { href, type Route } from '../router'
import { Icon } from './Icon'

/** The frame shared by the library and settings screens. */
export function AppBar({ current }: { current: Route['name'] }) {
  const io = useIo()
  return (
    <header className="app-bar">
      <a className="wordmark" href={href({ name: 'library' })}>
        <span className="mark">
          <Icon name="piano" size={16} />
        </span>
        Piano Teacher
      </a>
      <span className={`chip ${io.pianoConnected ? 'good' : 'plain'}`}>
        {io.pianoConnected ? 'piano connected' : 'no piano · screen and keys'}
      </span>
      <nav>
        <a
          href={href({ name: 'library' })}
          aria-current={current === 'library' ? 'page' : undefined}
        >
          Songs
        </a>
        <a
          href={href({ name: 'settings' })}
          aria-current={current === 'settings' ? 'page' : undefined}
        >
          Settings
        </a>
      </nav>
    </header>
  )
}
