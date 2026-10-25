import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Recording } from '../src/engine/types'

const DIR = join(__dirname, 'fixtures')

describe('MIDI fixtures', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json'))

  it('exist', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const f of files) {
    it(`${f} is a well-formed recording`, () => {
      const rec = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Recording
      expect(rec.name).toBe(f.replace(/\.json$/, ''))
      expect(['piano', 'synthetic']).toContain(rec.source)
      expect(rec.description.length).toBeGreaterThan(10)
      let prev = -Infinity
      const open = new Set<number>()
      for (const e of rec.events) {
        expect(e.t).toBeGreaterThanOrEqual(prev)
        prev = e.t
        expect(['on', 'off', 'cc']).toContain(e.type)
        expect(e.n).toBeGreaterThanOrEqual(0)
        expect(e.n).toBeLessThanOrEqual(127)
        expect(e.v).toBeGreaterThanOrEqual(0)
        expect(e.v).toBeLessThanOrEqual(127)
        if (e.type === 'on') open.add(e.n)
        if (e.type === 'off') {
          expect(open.has(e.n)).toBe(true)
          open.delete(e.n)
        }
      }
      expect([...open]).toEqual([])
    })
  }
})
