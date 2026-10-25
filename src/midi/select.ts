/**
 * Device selection logic, kept pure so it can be unit-tested without a
 * real MIDIAccess object.
 */

export interface PortInfo {
  id: string
  name: string
  manufacturer: string
  state: 'connected' | 'disconnected'
}

/**
 * Pick the port to use automatically.
 *
 * Order of preference:
 * 1. a connected port whose name or manufacturer contains `preferred`
 *    (case-insensitive, e.g. "CASIO USB-MIDI"),
 * 2. the previously selected id if it is still connected,
 * 3. the first connected port,
 * 4. nothing.
 */
export function pickPort(
  ports: readonly PortInfo[],
  preferred: string,
  previousId?: string | null,
): PortInfo | null {
  const connected = ports.filter((p) => p.state === 'connected')
  const needle = preferred.toLowerCase()
  const match = connected.find(
    (p) => p.name.toLowerCase().includes(needle) || p.manufacturer.toLowerCase().includes(needle),
  )
  if (match) return match
  if (previousId) {
    const prev = connected.find((p) => p.id === previousId)
    if (prev) return prev
  }
  return connected[0] ?? null
}
