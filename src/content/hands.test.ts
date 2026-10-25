import { describe, expect, it } from 'vitest'
import { chooseHandAssignment, handOf } from './hands'

const t = (index: number, name: string, avgPitch: number, noteCount = 10) => ({
  index,
  name,
  avgPitch,
  noteCount,
})

describe('chooseHandAssignment', () => {
  it('splits by pitch with a single track', () => {
    expect(chooseHandAssignment([t(0, 'Piano', 60)])).toEqual({ method: 'split', splitPitch: 60 })
    expect(chooseHandAssignment([t(0, 'Piano', 60), t(1, 'empty', 0, 0)])).toEqual({
      method: 'split',
      splitPitch: 60,
    })
  })
  it('uses the higher track as RH', () => {
    expect(chooseHandAssignment([t(0, '', 48), t(1, '', 70)])).toEqual({
      method: 'track',
      rhTracks: [1],
      lhTracks: [0],
    })
  })
  it('trusts track names over pitch', () => {
    expect(chooseHandAssignment([t(0, 'Left hand', 72), t(1, 'Right hand', 50)])).toEqual({
      method: 'track',
      rhTracks: [1],
      lhTracks: [0],
    })
  })
  it('puts all lower tracks in LH with three or more tracks', () => {
    expect(chooseHandAssignment([t(0, '', 40), t(1, '', 75), t(2, '', 55)])).toEqual({
      method: 'track',
      rhTracks: [1],
      lhTracks: [2, 0],
    })
  })
})

describe('handOf', () => {
  it('follows the assignment', () => {
    expect(handOf({ method: 'split', splitPitch: 60 }, 0, 60)).toBe('RH')
    expect(handOf({ method: 'split', splitPitch: 60 }, 0, 59)).toBe('LH')
    expect(handOf({ method: 'track', rhTracks: [1], lhTracks: [0] }, 1, 30)).toBe('RH')
    expect(handOf({ method: 'track', rhTracks: [1], lhTracks: [0] }, 5, 30)).toBe('LH')
  })
})
