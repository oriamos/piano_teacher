import { Library } from './screens/Library'
import { Practice } from './screens/Practice'
import { Settings } from './screens/Settings'
import { useRoute } from './router'

export function App() {
  const route = useRoute()
  switch (route.name) {
    case 'practice':
      return <Practice key={route.songId} songId={route.songId} />
    case 'settings':
      return <Settings />
    default:
      return <Library />
  }
}
