import { describe, expect, it } from 'vitest'
import { pickPort, type PortInfo } from './select'

const port = (id: string, name: string, state: PortInfo['state'] = 'connected'): PortInfo => ({
  id,
  name,
  manufacturer: '',
  state,
})

describe('pickPort', () => {
  it('prefers a connected port whose name contains CASIO (any case)', () => {
    const ports = [port('a', 'Midi Through'), port('b', 'Casio USB-MIDI')]
    expect(pickPort(ports, 'CASIO')?.id).toBe('b')
  })
  it('matches on manufacturer too', () => {
    const ports = [{ ...port('a', 'USB-MIDI'), manufacturer: 'CASIO COMPUTER CO.,LTD.' }]
    expect(pickPort(ports, 'casio')?.id).toBe('a')
  })
  it('ignores disconnected ports', () => {
    const ports = [port('a', 'CASIO USB-MIDI', 'disconnected'), port('b', 'Other')]
    expect(pickPort(ports, 'CASIO')?.id).toBe('b')
  })
  it('keeps the previous selection when no preferred port exists', () => {
    const ports = [port('a', 'One'), port('b', 'Two')]
    expect(pickPort(ports, 'CASIO', 'b')?.id).toBe('b')
  })
  it('falls back to the first connected port, or null', () => {
    expect(pickPort([port('x', 'Thing')], 'CASIO')?.id).toBe('x')
    expect(pickPort([], 'CASIO')).toBeNull()
    expect(pickPort([port('x', 'Thing', 'disconnected')], 'CASIO')).toBeNull()
  })
})
