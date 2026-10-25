# 0001 – Canvas 2D, not WebGL, for the falling notes

Date: 2026-10-24 · Status: accepted

## Context

The practice screen draws up to ~300 note blocks scrolling at 60 fps on a mid-range Android
tablet, plus an 88-key keyboard. The obvious options are DOM elements, Canvas 2D, or WebGL
(directly or through a library).

## Decision

Canvas 2D with `requestAnimationFrame`. One canvas for the notes, one for the keyboard. Layout
maths (`src/render/keyboardLayout.ts`) is pure and shared between the two, and with hit
testing for the on-screen keyboard.

## Consequences

- 300 filled rectangles per frame is far inside Canvas 2D's budget on any tablet from the
  last five years; no shader code to maintain, no context-loss handling.
- Drawing is driven by MIDI events mutating a map and requesting a frame, not by React state,
  which keeps note-on → pixel under the 30 ms target.
- If profiling on the real tablet ever shows dropped frames, the first move is to cull
  off-screen notes and batch by colour, not to switch renderer.
- DOM elements were rejected because 300 animated elements cause layout thrash; WebGL because
  the complexity is not paid for by anything we draw.
