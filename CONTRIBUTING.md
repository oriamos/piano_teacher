# Contributing

Thanks for looking. This is a small project with one hard rule: **every feature must shorten
the time until a passage is mastered.** If a change does not do that, it does not go in, no
matter how nice it is.

## Setup

```bash
npm install
npm run dev        # dev server
npm run check      # everything CI runs: format, lint, typecheck, tests, build
```

Node 20+ and Chrome (desktop is fine for most work; the practice screen must also be checked on
a real Android tablet over HTTPS before a stage is called done – see README "Running on the
tablet").

## Tests

```bash
npm test             # once
npm run test:watch   # watch mode
```

- The engine (`src/engine`) is pure TypeScript and is tested only through Vitest against
  recordings in `test/fixtures/`. Every engine change needs a test; a bug fix starts with a
  fixture that reproduces it.
- `npm run typecheck` compiles the engine a second time **without the DOM lib**
  (`tsconfig.engine.json`). If your engine code needs `window`, `performance` or `navigator`,
  it belongs somewhere else.
- `test/engine-boundaries.test.ts` fails if the engine imports from `ui`, `render`, `store`,
  `sync`, `react` or `dexie`.

## Adding a MIDI fixture

1. Open the device-test screen with the piano connected.
2. **Record fixture** → play the passage (include the mistakes you want the test to catch) →
   **Stop** → fill in a name and a description that says which mistakes are deliberate →
   **Download JSON**.
3. Drop the file into `test/fixtures/`. `test/fixtures.test.ts` validates its shape.
4. Only original melodies or public-domain works (Bach, Mozart, folk songs). Nothing under
   copyright, ever.

## Design

`DESIGN.md` is the visual system; `src/ui/styles.css` is its source of truth (the tokens in
the front matter mirror `:root`). New UI uses the existing tokens, components and spacing
steps. The rules worth repeating: one primary action per screen, no glow or gradients, no
glyph icons (add a path to `src/ui/components/Icon.tsx`), every control has hover, focus,
active and disabled states, touch targets ≥ 56 px, text contrast ≥ 4.5:1, motion respects
`prefers-reduced-motion`. Hand and feedback colours in `src/config.ts` and the render themes
must stay in step with DESIGN.md.

## Code style

- Prettier and ESLint are the style guide; `npm run format` before committing.
- Every public function in `engine`, `midi` and `content` has a TSDoc comment, with a short
  `@example` where the behaviour is not obvious.
- Every numeric threshold lives in `src/config.ts`, never inline.
- Timing: `performance.now()` through `src/midi/clock.ts`; never `Date.now()` (lint-enforced).
- MIDI out: the `timestamp` argument of `MIDIOutput.send`; never `setTimeout`.
- Work order inside a stage: `engine` with tests first, then `render`, then `ui`.

## Commits and pull requests

- Small, focused commits with an imperative subject line: `engine: score runs by median
timing`, `ui: add A–B loop control`. Prefix with the area (`engine`, `midi`, `render`, `ui`,
  `content`, `store`, `docs`, `ci`).
- Update `CHANGELOG.md` under _Unreleased_ in the same PR.
- A stage is **done** when: tests pass, the pass condition in SPEC.md holds on real hardware,
  README / docs / CHANGELOG are updated, CI is green.
- Fill in the PR template. CI runs format check, lint, typecheck, tests and build.

## Reference apps and licensing

`docs/ui-reference.md` records which interaction patterns we take from Synthesia, Flowkey,
Melodics, Simply Piano and Duolingo. The rules are binding:

- Never decompile their binaries or extract code, assets (icons, sounds, fonts, art) or song
  content. The patterns are visible from ordinary use; that is all we need.
- All code and assets here are original. Only permissively licensed (MIT / Apache / BSD)
  dependencies.
- Neothesia is GPLv3: read it for ideas, never copy from it.

## Secrets

None in the repo. `.env.example` only. The Supabase anon key may ship to the client (RLS
protects the data); the `service_role` key must never appear anywhere.
