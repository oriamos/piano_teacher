import { describe, expect, it } from 'vitest'
import { toRecording } from './recorder'

describe('toRecording', () => {
  it('rebases time to the first event and maps message types', () => {
    const rec = toRecording(
      [
        { t: 1000.04, message: { type: 'noteOn', channel: 0, pitch: 60, velocity: 90 } },
        { t: 1100.5, message: { type: 'controlChange', channel: 0, controller: 64, value: 127 } },
        { t: 1200, message: { type: 'other', status: 0xfe, data: [] } },
        { t: 1500.26, message: { type: 'noteOff', channel: 0, pitch: 60, velocity: 0 } },
      ],
      'test',
      'a test',
      'piano',
      80,
    )
    expect(rec).toEqual({
      name: 'test',
      description: 'a test',
      source: 'piano',
      bpm: 80,
      events: [
        { t: 0, type: 'on', n: 60, v: 90 },
        { t: 100.5, type: 'cc', n: 64, v: 127 },
        { t: 500.2, type: 'off', n: 60, v: 0 },
      ],
    })
  })
  it('handles an empty recording', () => {
    expect(toRecording([], 'e', 'empty', 'synthetic').events).toEqual([])
  })
})
