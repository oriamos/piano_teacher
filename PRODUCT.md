# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite, React, TypeScript, PWA. Decided in SPEC.md before any visual work.

## Users

Adults in a closed group of friends (up to ~20) who had a few piano lessons as children and
want to finish whole songs now. Primary scene: sitting at a Casio digital piano, an Android
tablet on the music stand about 60 cm from the eyes, usually in the evening at home. Hands are
on the keys most of the time, so the screen is read, not touched, during practice.

## Product Purpose

Teach whole songs to mastery: both hands, at the original tempo, from memory. Build a
repertoire that survives, through spaced reviews. Success is measured in minutes-to-mastery
per segment and in segments still playable weeks later. A daily 20–30 minute session the app
builds by itself (stage 3).

## Positioning

A falling-notes player that works to make itself unnecessary: visual aids fade over five
levels until the screen is blank, and mastery is defined as playing with no screen. Reading
staff notation is explicitly not a goal; neither is gamification.

## Operating Context

- The piano makes all sound (the player's notes and the app's demonstrations over MIDI out);
  the tablet is silent in piano mode. Without a piano, the app's own synth plays.
- Practice happens in short segments (2–4 bars) looped many times; runs end with a 3-second
  summary and continue by themselves.
- Basic actions are piano gestures (two lowest keys = restart, two highest = next) so the
  hands never leave the keyboard.
- Landscape only. Chrome on Android, installed as a PWA; also used on a laptop in no-piano
  mode during development.

## Capabilities and Constraints

- Modes: Listen, Wait, Practice (fixed tempo 40–100 %); Performance mode later.
- Per-note feedback colours are fixed by SPEC.md: green on time, blue early, orange late, red
  wrong, a blinking key for a miss. Right-hand and left-hand colours must differ from each
  other and from the feedback colours.
- Touch targets at least 56 dp. Dark, high-contrast screen because of viewing distance.
- Numbers that matter to the player: tempo percent, accuracy percent, bar numbers, timing
  deviation in ms.
- No points, badges, leaderboards. The streak and "reviews due" are information, not a game.
- Open questions recorded in SPEC.md: piano model, tablet model, the five starter songs.
  UI language is English for now (public repository); Hebrew is an open question.

## Brand Commitments

- Name: Piano Teacher (working title). No logo yet; the icon is a stylised keyboard.
- Voice: a good teacher: direct, warm, specific. Never cute for its own sake.
- Licence: MIT; all assets original or permissively licensed. Fonts must be self-hosted and
  OFL/Apache.

## Evidence on Hand

- Three bundled public-domain starter songs in `public/songs/` (Twinkle Twinkle, Ode to Joy,
  and an original study). No real recordings from the piano yet; no screenshots of real use.
- No testimonials, no user data, no benchmarks. Nothing of that kind may be invented.

## Product Principles

1. Every feature must shorten the time to mastering a segment.
2. Feedback within one frame of the key press; nothing on the network during play.
3. The app decides what to practise next; the player just starts.
4. Aids fade, memory stays: the target is playing without the screen.
5. Progress is the reward: tempo rising, segments turning mastered, reviews spacing out.

## Accessibility & Inclusion

Readable at 60 cm (large type, ≥ 4.5:1 text contrast). Colour is never the only code for
feedback: wrong notes also flash the key, misses blink, and the summary states counts in words.
Keyboard-operable on desktop. Respect `prefers-reduced-motion`.
