import { useEffect, useState } from 'react'

export type Route =
  { name: 'library' } | { name: 'practice'; songId: string } | { name: 'settings' }

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/')
  if (parts[0] === 'practice' && parts[1])
    return { name: 'practice', songId: decodeURIComponent(parts[1]) }
  if (parts[0] === 'settings') return { name: 'settings' }
  return { name: 'library' }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'practice':
      return `#/practice/${encodeURIComponent(route.songId)}`
    case 'settings':
      return '#/settings'
    default:
      return '#/'
  }
}

export function navigate(route: Route): void {
  location.hash = href(route)
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash))
  useEffect(() => {
    const on = () => setRoute(parseRoute(location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
