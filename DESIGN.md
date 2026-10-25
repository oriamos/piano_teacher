---
name: Piano Teacher
description: Lacquer and brass. A warm near-black ground like a piano's case, ivory text, one brass accent for the thing to do next, violet for the left hand. Energy comes from scale and colour on the few things that matter, not from glow or chrome.

# Values mirror src/ui/styles.css :root and src/config.ts render colours. CSS is the source of truth.
colors:
  # Surfaces (warm, hue 50)
  ground: 'oklch(17% 0.012 50)' # #140e0b page ground, the lacquer
  lane: 'oklch(14% 0.01 50)' # #0d0806 the note lane behind falling notes
  panel: 'oklch(22% 0.014 50)' # #201915 raised: bars, cards, rows
  control: 'oklch(28% 0.016 50)' # #302722 inputs, secondary buttons
  control-2: 'oklch(34% 0.018 50)' # #403530 hover / pressed
  hairline: 'oklch(40% 0.02 50 / 0.6)' # separators

  # Text (ivory)
  text: 'oklch(95% 0.02 85)' # #f5eee0 16.5:1 on ground
  muted: 'oklch(76% 0.025 70)' # #bcafa0 8.9:1
  faint: 'oklch(62% 0.02 70)' # #8e8479 5.2:1, metadata only

  # Accent
  brass: 'oklch(84% 0.17 90)' # #f5c40d primary action, selection, right hand
  ink: 'oklch(22% 0.03 70)' # #24180a text on brass (10.6:1)

  # Hands
  rh: 'oklch(84% 0.17 90)' # #f5c40d brass
  rh-black: 'oklch(66% 0.14 90)' # #b38d00 on black keys
  lh: 'oklch(74% 0.16 305)' # #c28efb violet
  lh-black: 'oklch(58% 0.16 305)' # #915dc5

  # Feedback (fixed by SPEC.md: green / blue / orange / red)
  hit: 'oklch(80% 0.2 150)' # #3ce074 on time
  early: 'oklch(74% 0.16 250)' # #50b0ff
  late: 'oklch(74% 0.18 50)' # #ff822a
  wrong: 'oklch(66% 0.22 25)' # #fc4447 wrong and missed

  # Keyboard
  key-white: 'oklch(94% 0.012 85)' # #efebe2
  key-black: 'oklch(20% 0.012 50)' # #1b1511

typography:
  family: 'Bricolage Grotesque, system-ui, sans-serif' # self-hosted, OFL, variable (wght 200–800, wdth 75–100)
  scale:
    '12': '0.75rem' # table chrome
    '13': '0.8125rem' # metadata, HUD
    '14': '0.875rem' # controls, labels
    '16': '1rem' # body
    '18': '1.125rem' # row titles
    '22': '1.375rem' # section titles
    '28': '1.75rem' # page title, continue-card title
    '40': '2.5rem' # the verdict word
    '72': '4.5rem' # the accuracy number
  weights: { body: 450, label: 550, title: 700, display: 800 }
  numerals: tabular

spacing:
  base: 4px
  steps: [4, 8, 12, 16, 24, 32, 48]

radius: { control: 10px, card: 14px, pill: 999px }

motion:
  fast: 150ms # feedback, hover
  state: 220ms # segmented switches, chips
  moment: 480ms # the run summary landing
  ease: cubic-bezier(0.16, 1, 0.3, 1)
---

# Design

## The world

The product's mechanism is taking the notes away until you play from memory. The surface a
pianist already knows for that is the instrument: lacquer, ivory, felt, brass. The ground is a
warm near-black (never pure black, never blue-black); text is ivory; the one accent is brass,
used only for the thing to do next (Start, the selected mode, the right hand's notes). The left
hand is violet so the two hands read apart at 60 cm and neither collides with the four fixed
feedback colours.

Energy comes from scale: the song you are about to practise is the biggest thing on the home
screen; the verdict after a run is the biggest thing on the practice screen for three seconds.
Nothing glows. No gradients, no halos, no side stripes, no glyph icons.

## Hierarchy per screen

- **Home / library.** One primary action: continue the last song. Then the list. Import and
  starter songs are secondary.
- **Practice.** The canvas is the page. The bar above it carries the controls in the order
  they are used: where (song, bars) → how (mode, hand) → fine-tuning (tempo, click, fade) →
  Start, pinned right. The HUD over the canvas is quiet metadata. The run summary is the one
  authored moment.
- **Settings.** Sound source, then input without a piano, then the device test as it was.

## Type

One family, Bricolage Grotesque (variable). Width axis for character: titles at wdth 90,
the verdict word at wdth 80 and weight 800. Body 450, labels 550. Tabular numerals wherever
numbers change (tempo, bars, HUD, summary, event log). Headings `text-wrap: balance`.

## Components

- Buttons: 56 px tall. Primary = brass with ink text. Secondary = control surface with ivory
  text, hover one step lighter, active one step darker, focus ring brass 2 px offset 2 px,
  disabled 40 % opacity. Icon buttons are 56 × 56 with an authored 20 px stroke icon.
- Segmented control: panel-coloured track, selected segment brass with ink text, 220 ms.
- Chips (HUD, status): 13 px, control surface, no border.
- Range inputs and checkboxes use `accent-color: brass`.
- Cards are 14 px radius, panel surface, no border and no shadow (one elevation signal).

## Motion

150 ms feedback, 220 ms state. One authored moment: the run summary rises 12 px and the
accuracy number lands from 92 % scale, 480 ms ease-out. The count-in dot pulses at the beat.
`prefers-reduced-motion`: opacity only, no pulse.

## Browser surfaces

Selection brass on ink, caret brass, focus rings brass, scrollbars panel/control, tabular
numerals in tables.
