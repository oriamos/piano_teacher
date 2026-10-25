/**
 * Spec rule 1: `engine` imports nothing from `ui`, `render`, or the browser.
 * tsconfig.engine.json enforces the DOM part at type level; this test checks
 * the import graph so a stray `import … from '../ui/…'` fails CI.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ENGINE_DIR = join(__dirname, '..', 'src', 'engine')
const FORBIDDEN = [/['"]\.\.\/(ui|render|store|sync)\//, /['"](react|react-dom|dexie)['"]/]

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []
  })
}

describe('engine boundaries', () => {
  it('engine files do not import ui/render/store/sync or browser libraries', () => {
    const offenders: string[] = []
    for (const file of walk(ENGINE_DIR)) {
      const src = readFileSync(file, 'utf8')
      for (const re of FORBIDDEN) if (re.test(src)) offenders.push(`${file}: ${re}`)
    }
    expect(offenders).toEqual([])
  })
})
