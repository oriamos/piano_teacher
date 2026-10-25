# Architecture decision records

One short file per significant decision, in the format _context → decision → consequences_.
Numbered in order; never edited after the fact – write a new one that supersedes it.

| #    | Decision                                                                                  |
| ---- | ----------------------------------------------------------------------------------------- |
| 0001 | Canvas 2D, not WebGL, for the falling notes                                               |
| 0002 | Local-first: practice logic on the tablet, server for sync                                |
| 0003 | The piano is the only sound source                                                        |
| 0004 | Timestamps come from `performance.now()` and Web MIDI, never `Date.now()` or `setTimeout` |
