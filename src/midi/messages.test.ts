import { describe, expect, it } from 'vitest'
import { controlChange, isBlackKey, noteName, noteOff, noteOn, parseMidiMessage } from './messages'

describe('parseMidiMessage', () => {
  it('parses note-on', () => {
    expect(parseMidiMessage([0x90, 60, 100])).toEqual({
      type: 'noteOn',
      channel: 0,
      pitch: 60,
      velocity: 100,
    })
  })
  it('treats note-on with velocity 0 as note-off (running-status keyboards)', () => {
    expect(parseMidiMessage([0x91, 60, 0])).toEqual({
      type: 'noteOff',
      channel: 1,
      pitch: 60,
      velocity: 0,
    })
  })
  it('parses note-off', () => {
    expect(parseMidiMessage(new Uint8Array([0x80, 21, 64]))).toEqual({
      type: 'noteOff',
      channel: 0,
      pitch: 21,
      velocity: 64,
    })
  })
  it('parses sustain pedal (CC64)', () => {
    expect(parseMidiMessage([0xb0, 64, 127])).toEqual({
      type: 'controlChange',
      channel: 0,
      controller: 64,
      value: 127,
    })
  })
  it('passes through unknown messages', () => {
    expect(parseMidiMessage([0xfe])).toEqual({ type: 'other', status: 0xfe, data: [] })
    expect(parseMidiMessage([0xc0, 5])).toEqual({ type: 'other', status: 0xc0, data: [5] })
  })
})

describe('message builders', () => {
  it('build correct bytes and clamp to 7 bits', () => {
    expect(noteOn(60, 100)).toEqual([0x90, 60, 100])
    expect(noteOn(60, 300, 3)).toEqual([0x93, 60, 127])
    expect(noteOff(60, 15)).toEqual([0x8f, 60, 0])
    expect(controlChange(64, 127)).toEqual([0xb0, 64, 127])
  })
})

describe('noteName / isBlackKey', () => {
  it('names the 88 keys', () => {
    expect(noteName(21)).toBe('A0')
    expect(noteName(60)).toBe('C4')
    expect(noteName(61)).toBe('C#4')
    expect(noteName(108)).toBe('C8')
  })
  it('knows black keys', () => {
    expect([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71].map(isBlackKey)).toEqual([
      false,
      true,
      false,
      true,
      false,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
    ])
  })
})
